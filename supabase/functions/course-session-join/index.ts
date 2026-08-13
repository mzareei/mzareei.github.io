import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import {
  assertCourseEmailAllowed,
  assertProfileMatchesAuthEmail
} from "../_shared/identity.ts";
import { classDateFor } from "../_shared/attendance.ts";
import { loadOrClaimProfile } from "../_shared/profile-claim.ts";

type Db = ReturnType<typeof adminClient>;

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) throw new HttpError("Sign in is required.", 401);

    const body = await request.json().catch(() => ({}));
    if (body.action !== "join") {
      throw new HttpError("Unknown action.", 400);
    }

    const db = adminClient();
    const profile = await loadActiveProfile(db, token);
    const joinCode = cleanJoinCode(body.join_code);

    const { data: session, error: sessionError } = await db
      .from("class_sessions")
      .select("id, course_id, section_id, title, state")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new HttpError("That class code is not valid.", 404);
    if (["cancelled", "closed"].includes(String(session.state))) {
      throw new HttpError("That class is closed.", 409);
    }

    const { data: enrollment, error: enrollmentError } = await db
      .from("section_enrollments")
      .select("id")
      .eq("section_id", session.section_id)
      .eq("profile_id", profile.id)
      .eq("role", "student")
      .eq("status", "active")
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (!enrollment) {
      throw new HttpError("You are not enrolled in the group for this class.", 403);
    }

    const { data: section, error: sectionError } = await db
      .from("course_sections")
      .select("section_code")
      .eq("id", session.section_id)
      .maybeSingle();
    if (sectionError) throw sectionError;
    if (!section) throw new Error("The class group could not be loaded.");

    await assertPinClaimed(db, profile, session);

    const checkedInAt = await recordCheckIn(db, session, String(profile.id));

    return json({
      session_id: session.id,
      title: session.title,
      section_code: section.section_code,
      state: session.state,
      joined: true,
      checked_in_at: checkedInAt
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Unable to join the class.";
    const code = error instanceof HttpError ? error.code : undefined;
    return json(code ? { error: message, error_code: code } : { error: message }, { status });
  }
});

/**
 * Every student needs a PIN, and the scan is the only place one can be claimed.
 *
 * The sign-in screen cannot enforce this. A student who signed in before PIN
 * sign-in existed still holds a Supabase session — those persist in the phone's
 * storage and refresh themselves indefinitely — and the app only shows the
 * sign-in screen to somebody signed *out*. So in the second real class most of
 * the room scanned the QR code and walked straight past the PIN they were
 * supposed to choose, while the handful who happened to be signed out set one.
 * Left alone, each of those sessions eventually lapses and strands that student
 * mid-class with no PIN to get back in.
 *
 * The gate therefore lives on the scan, which is the one thing every student in
 * the room does regardless of what state their session is in. A student who
 * already has a PIN never sees it.
 *
 * Two deliberate ways out, because a gate a student cannot pass is worse than no
 * gate at all — the same failure as pitfall #70, a state with no exit:
 *
 *  - `claim_student_pin` (0051) refuses unless the class is `live`, so a scan
 *    against a `paused` class must not be gated; the student could neither join
 *    nor claim.
 *  - Claiming is keyed on the student ID. A rostered profile without one cannot
 *    claim, so it is let through and recorded instead of being locked out of a
 *    lecture over a roster gap.
 */
async function assertPinClaimed(
  db: Db,
  profile: { id: string; student_identifier?: string | null },
  session: { id: string; course_id: string; state: string }
) {
  if (String(session.state) !== "live") return;

  // Read `pin_set_at`, never `pin_hash`: whether a PIN exists is all this needs
  // to know, and the hash has no business leaving the database.
  const { data, error } = await db
    .from("profiles")
    .select("pin_set_at")
    .eq("id", profile.id)
    .maybeSingle();
  if (error) throw error;
  if (data?.pin_set_at) return;

  if (!profile.student_identifier) {
    await noteUngatedJoin(db, session, String(profile.id));
    return;
  }

  throw new HttpError(
    "Set your PIN to join this class.",
    409,
    "pin_required"
  );
}

/** A student let past the PIN gate because the roster has no ID to claim
 *  against. Worth a record so the gap is fixable from the People screen rather
 *  than being invisible until the same student is stranded later. */
async function noteUngatedJoin(
  db: Db,
  session: { id: string; course_id: string },
  profileId: string
) {
  try {
    await db.from("audit_log").insert({
      course_id: session.course_id,
      actor_profile_id: profileId,
      target_type: "profile",
      target_id: profileId,
      action: "student_pin_gate_skipped",
      metadata: {
        class_session_id: session.id,
        note: "Joined without a PIN: the roster has no student ID to claim one against."
      }
    });
  } catch {
    // Never block a join over a note about the join.
  }
}

/**
 * The scan IS the attendance record. There is one QR code and one check-in per
 * class *day*: `ignoreDuplicates` means a student who re-scans after a page
 * reload, or halfway through the hour, keeps the arrival time they actually
 * arrived at — while a scan on a later day, when a paused class resumes,
 * records that day separately rather than being discarded as a duplicate.
 *
 * A failure here must never block the join. Being unable to write a row is an
 * attendance problem the professor can fix from the class record; refusing to
 * let a student into a live lecture over it is a teaching problem they cannot.
 */
async function recordCheckIn(
  db: Db,
  session: { id: string; course_id: string; section_id: string },
  profileId: string
): Promise<string | null> {
  try {
    const today = classDateFor();
    // Scoped to today: the maybeSingle() is safe again because the new unique
    // constraint guarantees at most one row per session, profile AND day.
    const { data: existing } = await db
      .from("class_attendance")
      .select("checked_in_at")
      .eq("class_session_id", session.id)
      .eq("profile_id", profileId)
      .eq("attendance_date", today)
      .maybeSingle();
    if (existing) return String(existing.checked_in_at);

    const checkedInAt = new Date().toISOString();
    const { error } = await db.from("class_attendance").upsert(
      {
        course_id: session.course_id,
        class_session_id: session.id,
        section_id: session.section_id,
        profile_id: profileId,
        checked_in_at: checkedInAt,
        attendance_date: today,
        source: "qr"
      },
      {
        onConflict: "class_session_id,profile_id,attendance_date",
        ignoreDuplicates: true
      }
    );
    if (error) throw error;
    return checkedInAt;
  } catch {
    return null;
  }
}

function bearerToken(value: string | null): string {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanJoinCode(value: unknown): string {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    throw new HttpError("That class code is not valid.", 400);
  }
  return code;
}

// A student can arrive here before the app has ever loaded its course context —
// scanning the class QR on a first-ever sign-in does exactly that, which was
// every student in the first real class. Claiming the profile here means "you
// are in the wrong group" is only ever said when it is true, instead of being
// what a brand-new account is told.
async function loadActiveProfile(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) {
    throw new HttpError("Invalid or expired session.", 401);
  }
  const email = userData.user.email || "";
  await assertCourseEmailAllowed(db, email);

  const profile = await loadOrClaimProfile(db, { id: userData.user.id, email });
  if (!profile || String(profile.status) !== "active") {
    throw new HttpError("No active course profile is linked to this account.", 403);
  }
  assertProfileMatchesAuthEmail(profile, email);
  return profile;
}
