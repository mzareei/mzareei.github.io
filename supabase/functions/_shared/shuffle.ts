// A real shuffle, and the quiz's difficulty mix.
//
// The old `values.sort(() => Math.random() - 0.5)` is not a shuffle: the
// comparator is inconsistent, so the result is measurably biased and a student
// who notices "the answer is rarely first" is reading a real signal. Fisher-Yates
// is the fix, and the verifier proves the old approach fails the same test.
//
// Pure on purpose: no Deno, no database. The Node verifier imports and runs it.

/** Fisher-Yates. Returns a new array; the input is never mutated. */
export function shuffle<T>(values: T[]): T[] {
  const out = Array.isArray(values) ? [...values] : [];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

export interface Tiered {
  difficulty?: string | null;
}

/** The class quiz is always ten questions: four easy, three medium, three hard. */
export const QUOTA = { easy: 4, medium: 3, hard: 3 } as const;

export type Quota = { easy: number; medium: number; hard: number };

/**
 * Deal `quota` questions from `pool`, shuffled within each tier and then
 * shuffled again as a whole so no two students meet the same difficulty order.
 *
 * A tier that cannot fill its share backfills from whatever is left rather than
 * serving a short quiz — a class that is thin on hard questions still gets ten.
 */
export function dealQuestions<T extends Tiered>(pool: T[], quota: Quota = QUOTA): T[] {
  const all = Array.isArray(pool) ? pool : [];
  const want = Math.max(0, (quota.easy || 0) + (quota.medium || 0) + (quota.hard || 0));
  if (want === 0 || all.length === 0) return [];

  const tiers: Record<string, T[]> = { easy: [], medium: [], hard: [] };
  const other: T[] = [];
  for (const question of all) {
    const bucket = tiers[String(question.difficulty)];
    if (bucket) bucket.push(question);
    else other.push(question);
  }

  const picked: T[] = [];
  const leftovers: T[] = [];
  for (const tier of ["easy", "medium", "hard"] as const) {
    const shuffled = shuffle(tiers[tier]);
    picked.push(...shuffled.slice(0, quota[tier] || 0));
    leftovers.push(...shuffled.slice(quota[tier] || 0));
  }

  // Backfill a short tier from every question not already dealt.
  const spare = shuffle([...leftovers, ...shuffle(other)]);
  while (picked.length < want && spare.length > 0) picked.push(spare.shift() as T);

  // Shuffle the whole hand so the order is not easy-then-medium-then-hard.
  return shuffle(picked);
}
