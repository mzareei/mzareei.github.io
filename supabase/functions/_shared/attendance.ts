// Scanning the class QR code is what puts a student in the room.
//
// The check lives here rather than in one function because a student reaches a
// live class through three different doors — the pulse answer, the end-of-class
// quiz, and the reflection — and a gate that only covers one of them is not a
// gate. If this guard is ever relaxed, relax it in one place.
//
// The attendance row is written by course-session-join when the code is
// scanned, and by an instructor using "Mark present" in the class record when a
// student's phone dies. Both are real check-ins as far as this is concerned.
//
// Since migration 0048 a class may hold more than one row per student: a lecture
// paused today and finished next week is one class with two days in a room.
// Anything reading this table must expect a list, not a row.

/**
 * Class days are Monterrey days. Not the server's UTC — a 7pm class is already
 * "tomorrow" in UTC, which would file an evening lecture under the wrong date —
 * and not the browser's, because a professor travelling must not relabel a day
 * the room already lived through.
 */
export const CLASS_TIME_ZONE = "America/Monterrey";

/** The `YYYY-MM-DD` class day an instant belongs to. */
export function classDateFor(iso?: string | Date): string {
  const at = iso ? new Date(iso) : new Date();
  // 'en-CA' formats as YYYY-MM-DD, which is the shape the date column wants.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLASS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(at);
}

export async function loadCheckInAt(
  // deno-lint-ignore no-explicit-any
  db: any,
  classSessionId: string,
  profileId: string
): Promise<string | null> {
  // A class taught over two days has two rows for a student who came to both,
  // so this can no longer be a maybeSingle() — that would throw on exactly the
  // student who attended most. The earliest scan answers "when did they first
  // join this class", which is what lateness is measured from and what the
  // live-screen gate needs.
  const { data, error } = await db
    .from("class_attendance")
    .select("checked_in_at")
    .eq("class_session_id", classSessionId)
    .eq("profile_id", profileId)
    .order("checked_in_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const first = (data || [])[0];
  return first ? String(first.checked_in_at) : null;
}

/** Every day this student was in the room for this class, ascending. */
export async function loadAttendanceDays(
  // deno-lint-ignore no-explicit-any
  db: any,
  classSessionId: string,
  profileId: string
): Promise<string[]> {
  const { data, error } = await db
    .from("class_attendance")
    .select("attendance_date")
    .eq("class_session_id", classSessionId)
    .eq("profile_id", profileId)
    .order("attendance_date", { ascending: true });
  if (error) throw error;
  return (data || []).map((row: { attendance_date: string }) =>
    String(row.attendance_date));
}

/**
 * Refuses a student who never checked in. Deliberately a no-op when there is no
 * class session to check against: standalone activities that were never part of
 * a live class have no QR code to scan, and must not become unreachable.
 */
export async function assertCheckedIn(
  // deno-lint-ignore no-explicit-any
  db: any,
  classSessionId: string | null | undefined,
  profileId: string
): Promise<void> {
  if (!classSessionId) return;
  const checkedInAt = await loadCheckInAt(db, String(classSessionId), profileId);
  if (!checkedInAt) {
    throw new Error("Scan the class QR code to join this class before taking part.");
  }
}
