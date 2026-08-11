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

export async function loadCheckInAt(
  // deno-lint-ignore no-explicit-any
  db: any,
  classSessionId: string,
  profileId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("class_attendance")
    .select("checked_in_at")
    .eq("class_session_id", classSessionId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? String(data.checked_in_at) : null;
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
