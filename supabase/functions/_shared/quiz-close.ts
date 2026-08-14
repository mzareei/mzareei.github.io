// When a running end-of-class quiz should close itself, and why.
//
// The professor used to close it by hand, which meant it stayed open while he
// was answering a question at the front of the room. Two conditions end it
// now: the clock runs out, or everyone who is actually in the room has
// submitted.
//
// The completeness denominator is CHECK-INS, never the roster.
// section_enrollments includes every absent student, so "everyone has
// finished" would be unreachable against it — the same mistake pitfall
// "`enrolled` is the roster, not the room" (docs/07-pitfalls.md) records for
// the pulse questions, where counting the full roster inflated the room past
// the number of people who could actually answer.
//
// The decision is pure so it can be executed by the verifier; the one function
// that touches the database is kept at the bottom and does no deciding.

export const OPEN_INSTANCE_STATES = ["open", "live", "paused"];
export const SUBMITTED_STATUSES = ["submitted", "late"];
/** How long after the deadline a submission already in progress is still taken. */
export const GRACE_SECONDS = 60;

/**
 * A count alone is not enough to call the room "finished": if the professor
 * starts the quiz while people are still checking in — a late QR, a make-up
 * session — `present` can sit at a handful while twenty more are about to
 * scan in. A couple of quick submissions then satisfy `submitted >= present`
 * seconds later and close a quiz almost nobody in the room has seen.
 *
 * The pulse questions hit this exact shape of bug first and fixed it with a
 * floor: `EVERYONE_ANSWERED_FLOOR_MS` in `src/features/live/autoReveal.ts`,
 * and pitfall "`enrolled` is the roster, not the room" (docs/07-pitfalls.md)
 * records it as "guard the completeness rule with a floor as well."
 *
 * Sixty seconds here, not the pulse's ten: a student tapping straight through
 * a quiz can legitimately finish a twelve-question quiz in well under a
 * minute, so ten seconds would not actually cover this case the way it
 * covers a single pulse question.
 */
export const EVERYONE_CLOSE_FLOOR_MS = 60_000;

export type QuizCloseReason = "time" | "everyone";

function millis(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Which of the two conditions ended a quiz that is already closed. Derived
 * rather than stored: it drives one line of text on the professor's screen and
 * nothing later depends on it, so it does not earn a column.
 */
export function closeReasonFor(
  input: { presentCount: number; submittedCount: number }
): QuizCloseReason {
  const present = Math.max(0, Number(input?.presentCount) || 0);
  const submitted = Math.max(0, Number(input?.submittedCount) || 0);
  return present > 0 && submitted >= present ? "everyone" : "time";
}

/** The reason to close this instance right now, or null to leave it running. */
export function decideQuizClose(input: {
  state: string;
  startsAt: string | null;
  endsAt: string | null;
  presentCount: number;
  submittedCount: number;
  now: Date;
}): QuizCloseReason | null {
  if (!OPEN_INSTANCE_STATES.includes(String(input?.state))) return null;

  const present = Math.max(0, Number(input?.presentCount) || 0);
  const submitted = Math.max(0, Number(input?.submittedCount) || 0);
  const now = input?.now instanceof Date ? input.now.getTime() : Date.now();

  // A missing or unparseable start time must never wedge the quiz open
  // forever, so it reads as "open long enough" rather than "just started" —
  // the same POSITIVE_INFINITY treatment autoRevealReason gives a null
  // openedAtMs.
  const startsAt = millis(input?.startsAt);
  const openFor = startsAt === null ? Number.POSITIVE_INFINITY : now - startsAt;

  // Checked first so a room that finishes exactly as the clock expires is told
  // the true and kinder reason. An EMPTY room must never read as a finished
  // one — without the `present > 0` guard the quiz would close in the same
  // second the professor started it. The floor guards the case the empty-room
  // check misses: a handful of people present with more still checking in,
  // where a couple of quick submissions could otherwise satisfy the count
  // within the first few seconds.
  if (present > 0 && submitted >= present && openFor >= EVERYONE_CLOSE_FLOOR_MS) {
    return "everyone";
  }

  // The floor applies only to the everyone-branch. A reached deadline always
  // closes the quiz, whether or not it has been open long enough for the
  // completeness count to be trusted.
  const endsAt = millis(input?.endsAt);
  if (endsAt !== null && now >= endsAt) return "time";

  return null;
}

/**
 * Whether a submission arriving after the deadline is still taken.
 *
 * The instance closes exactly at `ends_at` so student screens move on to the
 * exit ticket without waiting. This grace lives in the submit path alone: work
 * already begun gets finished, but `started_at` after the deadline means the
 * attempt was never legitimately open and gets no grace at all.
 */
export function withinSubmitGrace(input: {
  endsAt: string | null;
  startedAt: string | null;
  now: Date;
}): boolean {
  const endsAt = millis(input?.endsAt);
  if (endsAt === null) return false;
  const startedAt = millis(input?.startedAt);
  if (startedAt === null || startedAt >= endsAt) return false;
  const now = input?.now instanceof Date ? input.now.getTime() : Date.now();
  return now <= endsAt + GRACE_SECONDS * 1000;
}

/**
 * Counts the room and the submissions, decides, and writes the close.
 *
 * Called from BOTH polls — the instructor's status poll and every student's
 * live poll — so whichever arrives first ends the quiz. A professor whose
 * laptop is asleep, or whose Run Class tab was reloaded, does not hold a quiz
 * open over a room that has finished.
 *
 * Returns the instance state as it now stands plus the counts, so callers can
 * report them without querying again.
 */
export async function maybeAutoCloseInstance(
  // deno-lint-ignore no-explicit-any
  db: any,
  instance: {
    id: string;
    state: string;
    starts_at: string | null;
    ends_at: string | null;
    class_session_id: string | null;
  },
  classDateFor: () => string
): Promise<{ state: string; present: number; submitted: number; closed_reason: QuizCloseReason | null }> {
  const [{ count: present }, { data: attempts, error }] = await Promise.all([
    instance.class_session_id
      ? db.from("class_attendance").select("id", { count: "exact", head: true })
          .eq("class_session_id", instance.class_session_id)
          .eq("attendance_date", classDateFor())
      : Promise.resolve({ count: 0 }),
    db.from("student_attempts").select("id, status").eq("activity_instance_id", instance.id)
  ]);
  if (error) throw error;

  const submitted = (attempts || [])
    .filter((row: { status: string }) => SUBMITTED_STATUSES.includes(String(row.status)))
    .length;
  const presentCount = present ?? 0;

  const reason = decideQuizClose({
    state: String(instance.state),
    startsAt: instance.starts_at,
    endsAt: instance.ends_at,
    presentCount,
    submittedCount: submitted,
    now: new Date()
  });

  if (!reason) {
    return {
      state: String(instance.state),
      present: presentCount,
      submitted,
      closed_reason: OPEN_INSTANCE_STATES.includes(String(instance.state))
        ? null
        : closeReasonFor({ presentCount, submittedCount: submitted })
    };
  }

  const { error: updateError } = await db
    .from("activity_instances")
    .update({ state: "closed", updated_at: new Date().toISOString() })
    .eq("id", instance.id)
    .in("state", OPEN_INSTANCE_STATES);
  if (updateError) throw updateError;

  return { state: "closed", present: presentCount, submitted, closed_reason: reason };
}
