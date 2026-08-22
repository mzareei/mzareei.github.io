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
    // is described. The break's reveal reads `rounds`.
    if (input.now < window.answerEnd) break;
    settledThrough = k;

    const question = questions[k];
    const chosen = answers[question.id];
    const stamped = Number(times[question.id]);
    const answeredInTime =
      Boolean(chosen) && Number.isFinite(stamped) && stamped < window.answerEnd;
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
