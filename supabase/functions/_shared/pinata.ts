// How cracked the class piñata is. Pure on purpose: course-class-quiz (the
// room's screen) and course-pulse (each phone) both call it, and the frontend
// verifier executes it — one formula, one threshold, nowhere else.
//
// Damage is CORRECT answers, not answers given. The old formula counted every
// answer, so the piñata burst whether or not the class knew anything; the
// threshold came down from 85 to 70 to keep a real class within reach of it.

/** Bursts below 100% so a couple of students who never start cannot keep the
 *  piñata whole for a room that did the work. */
export const BURST_PERCENT = 70;

export function pinataState(input: {
  correct: number;
  started: number;
  questionCount: number;
  closedReason?: string | null;
}) {
  const questionCount = Math.max(1, Math.floor(Number(input.questionCount) || 0) || 1);
  const started = Math.max(0, Math.floor(Number(input.started) || 0));
  const correct = Math.max(0, Math.floor(Number(input.correct) || 0));
  const total = Math.max(1, started) * questionCount;
  const percent = started === 0 ? 0 : Math.max(0, Math.min(100, Math.floor((100 * correct) / total)));
  const burst = percent >= BURST_PERCENT || input.closedReason === "everyone";
  return { correct, total, percent, burst };
}
