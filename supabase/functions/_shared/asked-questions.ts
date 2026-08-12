// Questions a class has already answered on their phones during the lecture.
//
// The end-of-class quiz draws from the same bank the pulse checks draw from,
// so without this filter a question pushed as a live pulse comes back verbatim
// in the quiz twenty minutes later. Prof. Zareei's rule: a question asked in
// class is spent for that class's quiz.
//
// Scope is one class session, deliberately. The same question is fair game for
// a different group, or for the same lecture taught next semester — "already
// asked" is a fact about this room today, not about the question.
//
// Both sides of the quiz have to agree on the pool or the counts drift apart:
// course-class-quiz sizes the instance (question_count) at "Start the quiz",
// and course-activity-attempt selects the actual rows per attempt. If only one
// applied the filter, a student would see "3 of 10" and run out at 5.

import { adminClient } from "./client.ts";

type Db = ReturnType<typeof adminClient>;

/** Question ids pushed as a pulse round in this class session, in any state —
 *  a question that was opened and then closed early was still put in front of
 *  the room, so it is spent either way. */
export async function askedQuestionIds(
  db: Db,
  classSessionId: unknown
): Promise<Set<string>> {
  const sessionId = String(classSessionId || "").trim();
  if (!sessionId) return new Set();

  const { data, error } = await db
    .from("pulse_rounds")
    .select("question_id")
    .eq("class_session_id", sessionId);
  if (error) throw error;

  return new Set(
    (data || [])
      .map((row) => String((row as { question_id?: unknown }).question_id || ""))
      .filter(Boolean)
  );
}

/** Drop the spent questions — unless that would leave nothing to ask.
 *
 *  A short bank whose every question was used as a pulse check would otherwise
 *  produce a zero-question quiz, which reads to the room as a broken platform.
 *  Repeating a question is a much smaller failure than having no quiz at all,
 *  so an empty result falls back to the full pool. */
export function withoutAsked<T>(
  items: T[],
  asked: Set<string>,
  idOf: (item: T) => string
): T[] {
  if (!asked.size) return items;
  const remaining = items.filter((item) => !asked.has(idOf(item)));
  return remaining.length ? remaining : items;
}
