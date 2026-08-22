// What a student has earned so far.
//
// A round is settled once its answering window has passed. Settling happens on
// READ — when the room's screen polls, or when a phone polls — because a
// student who answers round 3 and then puts the phone down would otherwise
// never trigger the grading of round 3.
//
// Recomputed from scratch on every call rather than accumulated, so two callers
// landing in the same millisecond cannot double-count. `settledThrough` is a
// cursor for reporting, never a guard against re-running the maths.
//
// Pure on purpose: no Deno, no database. The Node verifier imports and runs it.

import { windowFor, candyFor, roundIsOpen } from "./rounds.ts";

export interface SettleQuestion {
  id: string;
  correctOptionId: string | null;
}

/**
 * One closed round, decided. The totals travel with this list because both read
 * surfaces need a single round on its own: the room's screen counts who got the
 * round that just closed right, and a phone reveals its own result during the
 * break. Recomputing "answered in time" at those two call sites would put the
 * rule in three places, across two services that deploy independently — the
 * same reason the per-question seconds are decided on the server, not the phone.
 *
 * Only rounds whose answering window has passed ever appear here. The reveal on
 * a student's phone is built from this list, so a round that is still taking
 * answers must never carry its own answer key.
 */
export interface SettledRound {
  index: number;
  questionId: string;
  correctOptionId: string | null;
  /** The server saw this student's answer inside the round's window. */
  answered: boolean;
  correct: boolean;
  candy: number;
}

/**
 * Was this answer committed before its round stopped taking them? The one test
 * that separates an answer from a guess made after the break revealed the key,
 * and therefore the only thing standing between the reveal and a forged grade.
 *
 * `stampedAt` is the SERVER's time of first arrival (report_progress stamps it
 * and never overwrites it), so a phone cannot claim to have been early.
 */
export function answeredInWindow(input: {
  startedAt: number;
  index: number;
  questionCount: number;
  chosen: string | null | undefined;
  stampedAt: unknown;
}): boolean {
  if (!input.chosen) return false;
  const stamped = Number(input.stampedAt);
  if (!Number.isFinite(stamped)) return false;
  // answersCloseAt, not answerEnd: the countdown the student sees ends at
  // answerEnd, and ANSWER_GRACE_MS after it covers the flight time of a ping
  // already in the air. See the invariant on those constants — this grace is
  // only safe because the reveal cannot arrive inside it.
  return stamped < windowFor(input.startedAt, input.index, input.questionCount).answersCloseAt;
}

/**
 * What this student actually committed, one entry per dealt question in dealt
 * order, with `null` where nothing arrived in time.
 *
 * This is what the GRADE is computed from. Before this existed, submit_attempt
 * graded the array the phone sent, and the break's reveal handed every phone
 * the correct option id — so the whole score was there for the taking by any
 * client that substituted the revealed values into an otherwise honest payload.
 */
export function committedAnswers(input: {
  startedAt: number;
  questionCount: number;
  /** In dealt order — index k is round k for THIS student. */
  questionIds: string[];
  answers: Record<string, string>;
  answerTimes: Record<string, number>;
}): Array<{ question_id: string; selected_option_id: string | null }> {
  const questionIds = Array.isArray(input.questionIds) ? input.questionIds : [];
  const answers = input.answers || {};
  const times = input.answerTimes || {};
  return questionIds.map((questionId, index) => {
    const chosen = answers[questionId];
    const inWindow = answeredInWindow({
      startedAt: input.startedAt,
      index,
      questionCount: input.questionCount,
      chosen,
      stampedAt: times[questionId]
    });
    return { question_id: questionId, selected_option_id: inWindow ? String(chosen) : null };
  });
}

/**
 * Which of these incoming answers the server may accept, and when.
 *
 * A student may change their mind while the round is still taking answers, and
 * not after. The break shows every phone its round's correct option, and
 * report_progress pins an answer's timestamp to the FIRST one it saw — so
 * without this test a crafted ping sent during the break could rewrite the
 * stored answer to the revealed one while keeping the early stamp, and collect
 * on it in both candy and grade. A question the server has never seen an answer
 * for is always accepted: it arrives with a fresh stamp, which the window test
 * then judges on its own merits.
 */
export function acceptableAnswers(input: {
  startedAt: number;
  questionCount: number;
  now: number;
  /** In dealt order — index k is round k for THIS student. */
  questionIds: string[];
  stored: Record<string, string>;
  incoming: Record<string, string>;
}): Record<string, string> {
  const indexOf = new Map((input.questionIds || []).map((id, index) => [id, index]));
  const stored = input.stored || {};
  const out: Record<string, string> = {};
  for (const [questionId, option] of Object.entries(input.incoming || {})) {
    const index = indexOf.get(questionId);
    const isChange = Boolean(stored[questionId]) && stored[questionId] !== option;
    if (isChange && index !== undefined && !roundIsOpen(input.startedAt, index, input.questionCount, input.now)) {
      continue;
    }
    out[questionId] = option;
  }
  return out;
}

/** The last round whose answering window has closed; -1 before the first one.
 *  While the room is answering, that is the round before the live one; during a
 *  break — and once the quiz is done — it is the live index itself. */
export function closedRoundIndex(
  round: { index: number; answersCloseAt: number } | null | undefined,
  now: number
): number {
  if (!round) return -1;
  // A round is closed for REPORTING once it can no longer take an answer, not
  // when its countdown hits zero. Those are two seconds apart, and reporting a
  // round as settled while an answer for it could still land would break the
  // one thing settleRoom's room total rests on: settled means final.
  return Number(now) >= round.answersCloseAt ? round.index : round.index - 1;
}

/** The question ids an attempt was dealt, in dealt order — index k is round k
 *  for that student. */
export function dealtQuestionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((question) => String((question as Record<string, unknown> | null)?.id || ""))
    .filter(Boolean);
}

/** A jsonb object read back as question id -> option id. */
export function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = String(entry || "");
  return out;
}

/** A jsonb object read back as question id -> ms epoch. */
export function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = Number(entry);
  return out;
}

/** question id -> correct option id, from `question_options` rows already
 *  filtered to is_correct. A bank question with two options flagged correct
 *  would otherwise be graded differently depending on row order, and the room's
 *  screen and the phone would then disagree about the same answer: first one
 *  wins, everywhere, every call. */
export function correctOptionMap(rows: Array<{ id: unknown; question_id: unknown }> | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  (rows || []).forEach((option) => {
    const questionId = String(option?.question_id || "");
    if (!questionId || map.has(questionId)) return;
    map.set(questionId, String(option?.id || ""));
  });
  return map;
}

/** The dealt questions in the shape settleAttempt and committedAnswers want,
 *  cut to the room's round count. `windowFor` clamps an index past the last
 *  round, so an eleventh question in a ten-round room would be graded against
 *  round ten's window — the count that bounds this array and the count passed
 *  beside it have to be one number. */
export function settleQuestions(
  questionsJson: unknown,
  correctByQuestion: Map<string, string>,
  questionCount: number
): SettleQuestion[] {
  return dealtQuestionIds(questionsJson)
    .slice(0, Math.max(0, Math.floor(Number(questionCount) || 0)))
    .map((id) => ({ id, correctOptionId: correctByQuestion.get(id) ?? null }));
}

export function settleAttempt(input: {
  startedAt: number;
  now: number;
  questionCount: number;
  /** In dealt order — index k is round k for THIS student. */
  questions: SettleQuestion[];
  answers: Record<string, string>;
  /** question id -> ms epoch the server first saw an answer for it. */
  answerTimes: Record<string, number>;
  settledThrough: number;
}): { candy: number; correctCount: number; settledThrough: number; rounds: SettledRound[] } {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const answers = input.answers || {};
  const times = input.answerTimes || {};

  let candy = 0;
  let correctCount = 0;
  let settledThrough = -1;
  const rounds: SettledRound[] = [];

  for (let k = 0; k < questions.length; k += 1) {
    const window = windowFor(input.startedAt, k, input.questionCount);
    // Still open — nothing about this round is decided yet, and nothing about it
    // is described. The break's reveal reads `rounds`. The test is
    // answersCloseAt rather than answerEnd so that "settled" means no answer for
    // this round can arrive any more; otherwise a round could be settled at
    // 40.0s and change at 41.5s, and two callers reading a second apart would
    // report different totals.
    if (input.now < window.answersCloseAt) break;
    settledThrough = k;

    const question = questions[k];
    const chosen = answers[question.id];
    const stamped = Number(times[question.id]);
    // The same test the grade uses. One definition, so a change to what counts
    // as "in time" can never move the candy without moving the score.
    const answeredInTime = answeredInWindow({
      startedAt: input.startedAt,
      index: k,
      questionCount: input.questionCount,
      chosen,
      stampedAt: times[question.id]
    });
    const correct =
      answeredInTime && Boolean(question.correctOptionId) && chosen === question.correctOptionId;
    const earned = answeredInTime
      ? candyFor({ correct, msIntoRound: stamped - window.answerStart })
      : 0;

    if (correct) correctCount += 1;
    candy += earned;
    rounds.push({
      index: k,
      questionId: question.id,
      correctOptionId: question.correctOptionId,
      answered: answeredInTime,
      correct,
      candy: earned
    });
  }

  return { candy, correctCount, settledThrough, rounds };
}
