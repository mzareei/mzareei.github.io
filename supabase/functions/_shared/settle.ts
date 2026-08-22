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

import { windowFor, candyFor } from "./rounds.ts";

export interface SettleQuestion {
  id: string;
  correctOptionId: string | null;
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
}): { candy: number; correctCount: number; settledThrough: number } {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const answers = input.answers || {};
  const times = input.answerTimes || {};

  let candy = 0;
  let correctCount = 0;
  let settledThrough = -1;

  for (let k = 0; k < questions.length; k += 1) {
    const window = windowFor(input.startedAt, k, input.questionCount);
    // Still open — nothing about this round is decided yet.
    if (input.now < window.answerEnd) break;
    settledThrough = k;

    const question = questions[k];
    const chosen = answers[question.id];
    const stamped = Number(times[question.id]);
    const answeredInTime =
      Boolean(chosen) && Number.isFinite(stamped) && stamped < window.answerEnd;
    if (!answeredInTime) continue;

    const correct = Boolean(question.correctOptionId) && chosen === question.correctOptionId;
    if (correct) correctCount += 1;
    candy += candyFor({ correct, msIntoRound: stamped - window.answerStart });
  }

  return { candy, correctCount, settledThrough };
}
