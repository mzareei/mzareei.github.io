// How long one quiz question is worth, and how long a whole quiz should run.
//
// The old table gave an easy question 20 seconds. A room reading its second
// language cannot take in a prompt, four options and a decision in 20 seconds,
// and the professor watched them run out. The floor is 30; only a genuinely
// long question earns 45.
//
// Length, not the generator's difficulty tag, decides. A hard question can be
// one line ("Which of these is NOT symmetric?") and an easy one can be a
// paragraph of scenario — the tag measures how hard it is to answer, and this
// measures how long it takes to READ. Reading is what runs out the clock.
//
// Pure on purpose: no Deno, no database, no imports. Both edge functions call
// it, and the Node verifier in the frontend repo imports and executes it.

export const BASE_SECONDS = 30;
export const LONG_SECONDS = 45;
/** Prompt + options, in characters, past which a question is "long". */
export const LONG_THRESHOLD_CHARS = 320;
/** Slack on the whole quiz for the student whose phone was slow to open it. */
export const CUSHION_SECONDS = 120;
export const MIN_TOTAL_SECONDS = 60;
export const MAX_TOTAL_SECONDS = 3600;

export interface TimedQuestion {
  prompt?: string | null;
  prompt_es?: string | null;
  options?: Array<{ option_text?: string | null; option_text_es?: string | null }> | null;
}

function lengthOf(value: unknown): number {
  return typeof value === "string" ? value.length : 0;
}

/**
 * Characters a student has to read to answer, in whichever language reads
 * longer. Spanish runs 15-20% longer than English, so measuring only English
 * would quietly give the Spanish reader of a borderline question less time
 * than the rule intends.
 */
export function readingLoad(question: TimedQuestion): number {
  const options = Array.isArray(question?.options) ? question.options : [];
  const english = lengthOf(question?.prompt)
    + options.reduce((sum, option) => sum + lengthOf(option?.option_text), 0);
  const spanish = lengthOf(question?.prompt_es)
    + options.reduce((sum, option) => sum + lengthOf(option?.option_text_es), 0);
  return Math.max(english, spanish);
}

export function secondsForQuestion(question: TimedQuestion): number {
  return readingLoad(question) > LONG_THRESHOLD_CHARS ? LONG_SECONDS : BASE_SECONDS;
}

/**
 * What to put on the clock for a quiz of `questionCount` questions drawn from
 * `pool`.
 *
 * Sized for the WORST case — the student who happens to draw every long
 * question — not the average. The quiz also closes the moment every student
 * present has submitted, so in a normal class the clock never runs out at all
 * and an over-generous total costs nothing. An under-generous one cuts a
 * student off mid-question. The asymmetry only points one way.
 */
export function estimateTotalSeconds(pool: TimedQuestion[], questionCount: number): number {
  const questions = Array.isArray(pool) ? pool : [];
  const count = Math.max(0, Math.floor(Number(questionCount) || 0));
  const longest = questions
    .map(secondsForQuestion)
    .sort((a, b) => b - a)
    .slice(0, count || questions.length);
  // The cushion is slack on top of real question time. An empty pool has no
  // question time to pad, so it must clamp straight to the floor rather than
  // reporting the bare cushion as if that were a legitimate quiz length.
  const cushion = longest.length > 0 ? CUSHION_SECONDS : 0;
  const total = longest.reduce((sum, seconds) => sum + seconds, 0) + cushion;
  return Math.min(MAX_TOTAL_SECONDS, Math.max(MIN_TOTAL_SECONDS, total));
}
