// The room clock.
//
// Before this, every phone ran its own countdown from the moment its student
// tapped "Let's go", so no two students were ever on the same question and the
// room's screen played to an audience of one. Now the activity instance's
// started_at is the only anchor: round k takes answers for ANSWER_SECONDS from
// started_at + k*ROUND_SECONDS, then the room breaks for BREAK_SECONDS while
// every phone reveals its own answer and every eye goes to the screen.
//
// This module also owns what "fast" means, because "fast" is measured against
// the round's start and nothing else should get to define it.
//
// Pure on purpose: no Deno, no database. The Node verifier imports and runs it.

import { CUSHION_SECONDS, MIN_TOTAL_SECONDS, MAX_TOTAL_SECONDS } from "./question-timing.ts";

export const ANSWER_SECONDS = 40;
export const BREAK_SECONDS = 10;
export const ROUND_SECONDS = ANSWER_SECONDS + BREAK_SECONDS;

/** Answer correctly inside this many seconds of the round and the candy doubles. */
export const GOLDEN_SECONDS = 20;

export const CANDY_CORRECT = 1;
export const CANDY_GOLDEN = 2;

const ANSWER_MS = ANSWER_SECONDS * 1000;
const ROUND_MS = ROUND_SECONDS * 1000;

export type RoundPhase = "answering" | "break" | "done";

export interface RoundWindow {
  /** 0-based round index. Clamped into range; never negative. */
  index: number;
  phase: RoundPhase;
  /** ms epoch */
  answerStart: number;
  answerEnd: number;
  breakEnd: number;
}

const clampCount = (value: number) => Math.max(1, Math.floor(Number(value) || 0) || 1);

/** The absolute window for one round. */
export function windowFor(startedAt: number, index: number, questionCount: number): RoundWindow {
  const count = clampCount(questionCount);
  const k = Math.max(0, Math.min(count - 1, Math.floor(Number(index) || 0)));
  const answerStart = startedAt + k * ROUND_MS;
  return {
    index: k,
    phase: "answering",
    answerStart,
    answerEnd: answerStart + ANSWER_MS,
    breakEnd: answerStart + ROUND_MS
  };
}

/** Is this round still taking answers? The question `report_progress` asks
 *  before letting a student change an answer they already committed. */
export function roundIsOpen(startedAt: number, index: number, questionCount: number, now: number): boolean {
  return Number(now) < windowFor(startedAt, index, questionCount).answerEnd;
}

/** Where the room is right now. A phone that slept through four rounds lands
 *  on the live one in a single call, not one advance per tick. */
export function roundAt(startedAt: number, now: number, questionCount: number): RoundWindow {
  const count = clampCount(questionCount);
  const elapsed = Number(now) - Number(startedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return windowFor(startedAt, 0, count);

  const raw = Math.floor(elapsed / ROUND_MS);
  if (raw >= count) {
    const finished = windowFor(startedAt, count - 1, count);
    return { ...finished, phase: "done" };
  }
  const window = windowFor(startedAt, raw, count);
  const within = elapsed - raw * ROUND_MS;
  return { ...window, phase: within < ANSWER_MS ? "answering" : "break" };
}

/**
 * What a student earned on one question. Speed pays here and NOWHERE else —
 * candy is the race, and the grade counts correctness only.
 *
 * `msIntoRound` is measured server-side from the round's start to the arrival of
 * the student's first answer for that question. A null means the server never
 * saw an answer in time, which is worth no bonus even if the answer was right.
 */
export function candyFor(input: { correct: boolean; msIntoRound: number | null }): number {
  if (!input.correct) return 0;
  const ms = input.msIntoRound;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return CANDY_CORRECT;
  return ms < GOLDEN_SECONDS * 1000 ? CANDY_GOLDEN : CANDY_CORRECT;
}

/** What to put on the instance's clock: every round, plus the existing cushion
 *  for the student whose phone was slow to open. */
export function totalSecondsFor(questionCount: number): number {
  const count = Math.max(0, Math.floor(Number(questionCount) || 0));
  const total = count > 0 ? count * ROUND_SECONDS + CUSHION_SECONDS : 0;
  return Math.min(MAX_TOTAL_SECONDS, Math.max(MIN_TOTAL_SECONDS, total));
}
