// Settling a whole room, once, for whoever asks first.
//
// Two surfaces read the race: course-class-quiz's `race` (the room's screen)
// and course-pulse (every phone, every three seconds). They both report the
// piñata, which is the room's correct answers over the room's questions — one
// number that must not depend on which door you look through. It did: `race`
// settled every attempt and summed the fresh results, while a phone settled
// only its own and summed everyone else's stored column, so at the instant a
// round closed the screen could read eight points ahead of the phone in a
// student's hand. The break is exactly when both are being looked at together.
//
// So both callers come here instead. The rule is: settle every attempt whose
// stored cursor is behind the last closed round, plus any the caller needs
// per-round detail for, then report the room's total from the merged result.
//
// That total is caller-independent, and provably so. An attempt whose
// settled_through already covers the last closed round has a stored count that
// no re-settle can change: report_progress stamps an answer's arrival with the
// SERVER's clock, so an answer that counts was in the database before its
// window shut, and a round once settled is settled for good. Fresh where it
// matters, stored where stored is already exact, same number either way.
//
// The behind-check is also what keeps this cheap for thirty phones: right
// after a round closes the first poll to arrive settles the room, and every
// poll in the rest of that three-second window finds nothing left to do.

import { settleAttempt, settleQuestions, stringMap, numberMap, correctOptionMap, dealtQuestionIds } from "./settle.ts";

type SettleResult = ReturnType<typeof settleAttempt>;

/** The light columns a caller has already loaded for the whole room. */
export interface RoomAttempt {
  id: unknown;
  candy?: unknown;
  correct_count?: unknown;
  settled_through?: unknown;
}

export interface SettledRoom {
  /** Per-attempt detail, for the attempts this call actually settled. */
  results: Map<string, SettleResult>;
  /** Correct answers in the room — the piñata's numerator, identical for
   *  every caller reading the same database state. */
  correctInRoom: number;
  /** This attempt's candy, settled if it was settled, stored if it was already
   *  exact. */
  candyFor(attemptId: string): number;
  correctFor(attemptId: string): number;
}

export async function settleRoom(
  // deno-lint-ignore no-explicit-any
  db: any,
  input: {
    rows: RoomAttempt[];
    /** Attempt ids whose per-round detail the caller needs: every racer for the
     *  room's screen, just the caller's own for a phone. */
    needDetailFor: string[];
    startedAt: number;
    now: number;
    questionCount: number;
    /** The last round whose window has closed; -1 before the first one. */
    closedIndex: number;
  }
): Promise<SettledRoom> {
  const rows = input.rows || [];
  const stored = new Map(rows.map((row) => [String(row.id), row]));
  const wanted = new Set(input.needDetailFor.map(String).filter((id) => stored.has(id)));
  for (const row of rows) {
    if (Number(row.settled_through ?? -1) < input.closedIndex) wanted.add(String(row.id));
  }

  const results = new Map<string, SettleResult>();
  const merged = (attemptId: string, pick: (result: SettleResult) => number, column: "candy" | "correct_count") => {
    const result = results.get(attemptId);
    if (result) return pick(result);
    return Math.max(0, Number(stored.get(attemptId)?.[column] ?? 0));
  };
  const room = (): number => rows.reduce(
    (sum, row) => sum + merged(String(row.id), (result) => result.correctCount, "correct_count"),
    0
  );

  if (!wanted.size || !Number.isFinite(input.startedAt)) {
    return {
      results,
      correctInRoom: room(),
      candyFor: (id) => merged(id, (result) => result.candy, "candy"),
      correctFor: (id) => merged(id, (result) => result.correctCount, "correct_count")
    };
  }

  // The frozen deal, the saved answers and the server's stamps — only for the
  // attempts that need work. This is the heavy read (a deal carries every
  // prompt and option), which is why it never runs for the whole room on a
  // poll that has nothing to settle.
  const ids = Array.from(wanted);
  const { data: heavy, error: heavyError } = await db
    .from("student_attempts")
    .select("id, questions_json, progress_answers, round_answer_times, settled_through, candy, correct_count")
    .in("id", ids);
  if (heavyError) throw heavyError;
  const heavyRows = heavy || [];

  // One query for the answer key of every question dealt to those attempts.
  // Thirty phones deal out of the same small bank, so the deduplicated list is
  // a few dozen rows however big the class is — and it never leaves the server
  // except through the break's reveal.
  const questionIds = Array.from(new Set(
    heavyRows.flatMap((row: Record<string, unknown>) => dealtQuestionIds(row.questions_json))
  )).filter(Boolean);
  let correctByQuestion = new Map<string, string>();
  if (questionIds.length) {
    const { data: options, error: optionError } = await db
      .from("question_options")
      .select("id, question_id")
      .in("question_id", questionIds)
      .eq("is_correct", true);
    if (optionError) throw optionError;
    correctByQuestion = correctOptionMap(options);
  }

  const changed: Array<{ id: string; result: SettleResult }> = [];
  for (const row of heavyRows as Record<string, unknown>[]) {
    const id = String(row.id);
    const result = settleAttempt({
      startedAt: input.startedAt,
      now: input.now,
      questionCount: input.questionCount,
      questions: settleQuestions(row.questions_json, correctByQuestion, input.questionCount),
      answers: stringMap(row.progress_answers),
      answerTimes: numberMap(row.round_answer_times),
      settledThrough: Number(row.settled_through ?? -1)
    });
    results.set(id, result);
    const moved = Number(row.candy ?? 0) !== result.candy
      || Number(row.correct_count ?? 0) !== result.correctCount
      || Number(row.settled_through ?? -1) !== result.settledThrough;
    if (moved) changed.push({ id, result });
  }

  await storeSettled(db, changed);

  return {
    results,
    correctInRoom: room(),
    candyFor: (id) => merged(id, (result) => result.candy, "candy"),
    correctFor: (id) => merged(id, (result) => result.correctCount, "correct_count")
  };
}

/**
 * Store the rows whose numbers moved, and only those — a three-second poll
 * rewriting the whole class every tick would be pure noise. No `updated_at`:
 * settling is the server's bookkeeping, not an edit the student made.
 *
 * Deliberately NOT fatal. Every number this writes was just recomputed from
 * scratch and is already in the response; the column is the record kept for an
 * attempt whose phone has gone quiet, and the next poll rewrites it anyway.
 * Throwing here would put a 500 on the professor's display in front of the
 * class over a write nothing reads as truth. A missing migration still fails
 * loudly — the read above selects the same columns.
 */
async function storeSettled(
  // deno-lint-ignore no-explicit-any
  db: any,
  changed: Array<{ id: string; result: { candy: number; correctCount: number; settledThrough: number } }>
) {
  if (!changed.length) return;
  const writes = await Promise.all(changed.map(({ id, result }) =>
    db
      .from("student_attempts")
      .update({ candy: result.candy, correct_count: result.correctCount, settled_through: result.settledThrough })
      .eq("id", id)
      .then(
        (outcome: { error: unknown }) => outcome?.error ?? null,
        (thrown: unknown) => thrown
      )
  ));
  const failed = writes.find(Boolean);
  if (failed) console.error("settle write failed; the numbers stand, the record lags", failed);
}
