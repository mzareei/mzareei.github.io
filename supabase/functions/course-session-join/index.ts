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
  constructor(message: string, readonly status: number) {
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
    return json({ error: message }, { status });
  }
});

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
