// How cracked the class piñata is. Pure on purpose: course-class-quiz (the
// room's screen) and course-pulse (each phone) both call it, and the frontend
// verifier executes it — one formula, one threshold, nowhere else.

/** Bursts before 100% so a couple of students who never start cannot keep the
 *  piñata whole for a room that did the work. */
export const BURST_PERCENT = 85;

export function pinataState(input: {
  hits: number;
  started: number;
  questionCount: number;
  closedReason?: string | null;
}) {
  const questionCount = Math.max(1, Math.floor(Number(input.questionCount) || 0) || 1);
  const started = Math.max(0, Math.floor(Number(input.started) || 0));
  const hits = Math.max(0, Math.floor(Number(input.hits) || 0));
  const total = Math.max(1, started) * questionCount;
  const percent = started === 0 ? 0 : Math.max(0, Math.min(100, Math.floor((100 * hits) / total)));
  const burst = percent >= BURST_PERCENT || input.closedReason === "everyone";
  return { hits, total, percent, burst };
}
