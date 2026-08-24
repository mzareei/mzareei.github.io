// Turning finished quiz attempts into places.
//
// Ranked on score_final, which is correctness alone. It used to fold in a speed
// bonus — this comment used to say a faster correct answer "wins on its own and
// no separate tiebreak rule is needed" — and both stopped being true when the
// room clock landed. Every student now gets the same forty seconds on the same
// question, so speed measured nothing about the student; it moved out of the
// grade and into candy, and maxSpeedBonusPercent is 0, so score_final equals
// score_percent for every attempt graded since.
//
// What that changes here: equal correctness is now a genuine tie rather than
// something the bonus quietly separated. Ties share a place, deliberately.
// submitted_at only orders students WITHIN a shared place, so the display is
// stable rather than arbitrary — it is not a tiebreak, and turning it into one
// would re-introduce "the same answers right, ranked lower", which is the
// reading removing the speed bonus was meant to prevent.
//
// Only finished work is ranked. A student who opened the quiz and abandoned it
// is not ranked last — they are not ranked at all, and the "of 24" a student
// reads is the number of people who actually finished.
//
// "Finished" takes two conditions, not one: a submitted/late status, and at
// least one real answer (progress_answered > 0). Before the quiz counted every
// dealt question toward the grade, an abandoned attempt simply never reached a
// submitted status, so the status filter alone was enough. Now it does reach
// that status — the professor's rule that a blank question is a wrong answer
// requires it — so progress_answered is what still tells "abandoned" apart
// from "graded zero on purpose". Only the ranking is affected; the grade
// itself, and the gradebook, still see the real 0%.
//
// Pure: no Deno, no database. The verifier imports and executes it.
import { SUBMITTED_STATUSES } from "./quiz-close.ts";

export const PODIUM_PLACES = 3;

export interface RankableAttempt {
  profile_id: string;
  status: string;
  score_final: number | null;
  submitted_at: string | null;
  progress_answered: number | null;
}

export interface RankedAttempt extends RankableAttempt {
  rank: number;
}

function scoreOf(attempt: RankableAttempt): number {
  return Number(attempt?.score_final ?? 0) || 0;
}

function submittedMillis(attempt: RankableAttempt): number {
  const parsed = attempt?.submitted_at ? new Date(attempt.submitted_at).getTime() : NaN;
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

/** Finished attempts, best first, with equal scores sharing a place. */
export function rankAttempts(attempts: RankableAttempt[]): RankedAttempt[] {
  const finished = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) =>
      SUBMITTED_STATUSES.includes(String(attempt?.status)) &&
      Number(attempt?.progress_answered ?? 0) > 0
    );

  const sorted = [...finished].sort((left, right) => {
    const byScore = scoreOf(right) - scoreOf(left);
    if (byScore !== 0) return byScore;
    return submittedMillis(left) - submittedMillis(right);
  });

  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((attempt, index) => {
    const score = scoreOf(attempt);
    // Standard competition ranking: two students at #2 are followed by #4, so
    // the number a student reads is genuinely "how many did better".
    if (lastScore === null || score !== lastScore) {
      lastRank = index + 1;
      lastScore = score;
    }
    return { ...attempt, rank: lastRank };
  });
}

/**
 * The podium.
 *
 * Everyone holding a place inside the cut, which means a tie spanning third
 * puts four students on it. Truncating to exactly three would silently drop a
 * student who earned the same score as the one being celebrated.
 */
export function podiumCut(ranked: RankedAttempt[], places = PODIUM_PLACES): RankedAttempt[] {
  return (Array.isArray(ranked) ? ranked : []).filter((entry) => entry.rank <= places);
}

/** One student's own place, or null if they did not finish. */
export function rankOf(
  ranked: RankedAttempt[],
  profileId: string
): { rank: number; of: number; is_top3: boolean } | null {
  const rows = Array.isArray(ranked) ? ranked : [];
  const mine = rows.find((entry) => String(entry.profile_id) === String(profileId));
  if (!mine) return null;
  return { rank: mine.rank, of: rows.length, is_top3: mine.rank <= PODIUM_PLACES };
}
