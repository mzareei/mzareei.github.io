// The class record: everything that happened to every student in one class.
//
// Two tables, deliberately kept apart:
//   - Attendance and engagement — was the student in the room, and did they
//     respond when asked. Correctness plays no part.
//   - Class grading — did they get the answers right.
// Conflating the two makes both harder to defend when a student disputes one.
//
// Grades are computed in _shared/class-grade.ts and nowhere else. The browser
// renders the breakdown this function returns; it never recalculates, so there
// is exactly one implementation of the formula to keep correct.
import { adminClient } from "../_shared/client.ts";
import { classDateFor } from "../_shared/attendance.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
// The grading rule, the roster-wide loaders and the gradebook write all live in
// _shared/class-grade.ts — the exit ticket and the session close post grades too
// now, and an edge function cannot import another edge function.
import {
  classGradingRows,
  gradingWeights,
  laterOf,
  loadPulse,
  loadQuiz,
  loadReflections,
  loadRoster,
  postClassGradesQuietly,
  quizPhaseRan,
  round2
} from "../_shared/class-grade.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const profile = await loadProfileForToken(db, token);
    const roles = await loadRoles(db, courseId, String(profile.id));
    const isTeacher = roles.some((role) => teacherRoles.includes(role));
    const isInstructor = roles.some((role) => instructorRoles.includes(role));
    const isGlobalOwner = roles.includes("platform_owner");
    if (!isTeacher) throw new Error("The class record is not allowed for this role.");

    const sessionId = cleanUuid(body.class_session_id, "class session id");
    const session = await loadSession(db, courseId, sessionId);

    if (!isGlobalOwner) {
      const permitted = await loadPermittedSectionIds(db, String(profile.id), courseId);
      if (!permitted.includes(String(session.section_id))) {
        throw new Error("You are not allowed to open the record for this class section.");
      }
    }

    switch (body.action) {
      case "attendance":
        return json(await attendanceTable(db, session));
      case "grading":
        return json(await gradingTable(db, session, String(profile.id)));
      case "mark_present": {
        if (!isInstructor) throw new Error("Marking attendance is not allowed for this role.");
        return json(await markPresent(db, session, String(profile.id), body));
      }
      case "override": {
        if (!isInstructor) throw new Error("Overriding a grade is not allowed for this role.");
        return json(await recordOverride(db, session, String(profile.id), body));
      }
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = (error as Error)?.message || "Unable to load the class record.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

// ------------------------------------------------------------------ plumbing

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("No active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadRoles(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => String(row.role));
}

async function loadPermittedSectionIds(db: Db, profileId: string, courseId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("section_id, course_sections!inner(course_id)")
    .eq("profile_id", profileId)
    .in("role", ["instructor", "teaching_assistant"])
    .eq("status", "active")
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  return Array.from(new Set((data || []).map((row) => String(row.section_id))));
}

type ClassSession = {
  id: string;
  course_id: string;
  section_id: string;
  sequence_number: number;
  title: string;
  state: string;
  planned_date: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  late_after_minutes: number;
};

async function loadSession(db: Db, courseId: string, sessionId: string): Promise<ClassSession> {
  const { data, error } = await db
    .from("class_sessions")
    .select(
      "id, course_id, section_id, sequence_number, title, state, planned_date, actual_start_at, actual_end_at, late_after_minutes"
    )
    .eq("id", sessionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That class session was not found.");
  return data as ClassSession;
}

// ---------------------------------------------------------------- attendance

/**
 * Present / Late / Left early / Absent, derived on read rather than stored, so
 * correcting a session's start time corrects every status with it.
 *
 * "Left early" only means the student stopped producing evidence before the end
 * of class. It is a prompt to look, not an accusation.
 */
function attendanceStatus(input: {
  checkedInAt: string | null;
  startedAt: string | null;
  lateAfterMinutes: number;
  hasQuizAttempt: boolean;
  hasReflection: boolean;
  // When the class never reached its end-of-class phase (no attempts, no
  // reflections from anyone), the absence of end-of-class evidence says nothing
  // about any individual student — without this guard a class cut short marks
  // the whole room "left early".
  endOfClassRan: boolean;
}) {
  if (!input.checkedInAt) return "absent";
  if (input.endOfClassRan && !input.hasQuizAttempt && !input.hasReflection) return "left_early";
  if (!input.startedAt) return "present";
  const graceMs = Math.max(0, Number(input.lateAfterMinutes || 0)) * 60_000;
  const late = new Date(input.checkedInAt).getTime() - new Date(input.startedAt).getTime() > graceMs;
  return late ? "late" : "present";
}

async function attendanceTable(db: Db, session: ClassSession) {
  const roster = await loadRoster(db, String(session.section_id));
  const [attendance, pulse, quiz, reflections] = await Promise.all([
    loadAttendance(db, session.id),
    loadPulse(db, session.id),
    loadQuiz(db, session.id),
    loadReflections(db, session.id)
  ]);

  // Whether this class genuinely ran its end-of-class quiz. A merely opened
  // attempt does not count — when a class is cut short a couple of students
  // always open the quiz in the last seconds; only a submitted attempt or an
  // answered question proves the phase happened for the room.
  const endOfClassRan = quizPhaseRan(quiz);

  const rows = roster.map((student) => {
    const record = attendance.get(student.profile_id) || null;
    const answers = pulse.answersByProfile.get(student.profile_id) || [];
    const attempt = quiz.attemptsByProfile.get(student.profile_id) || null;
    const reflection = reflections.get(student.profile_id) || null;

    let lastActivity: string | null = record?.checked_in_at ?? null;
    for (const answer of answers) lastActivity = laterOf(lastActivity, answer.answered_at);
    lastActivity = laterOf(lastActivity, attempt?.submitted_at ?? null);
    lastActivity = laterOf(lastActivity, reflection);

    return {
      ...student,
      checked_in_at: record?.checked_in_at ?? null,
      check_in_source: record?.source ?? null,
      check_in_note: record?.note ?? null,
      // Every day they were in the room for this class. One entry is the normal
      // case; two means the class was paused and finished on another day.
      attendance_days: record?.days ?? [],
      status: attendanceStatus({
        checkedInAt: record?.checked_in_at ?? null,
        startedAt: session.actual_start_at,
        lateAfterMinutes: session.late_after_minutes,
        hasQuizAttempt: Boolean(attempt),
        hasReflection: Boolean(reflection),
        endOfClassRan
      }),
      pulse_responses: answers.length,
      // Of the questions actually pushed, how many did they answer. Correctness
      // is irrelevant here — that lives in the grading table. With no questions
      // pushed this is null, not 0: a professor who asked nothing has not
      // discovered a room full of disengaged students.
      engagement_percent: pulse.roundCount
        ? Math.round((answers.length / pulse.roundCount) * 100)
        : null,
      last_activity_at: lastActivity
    };
  });

  return {
    session: sessionHeader(session),
    pulse_rounds_pushed: pulse.roundCount,
    rows
  };
}

function sessionHeader(session: ClassSession) {
  return {
    class_session_id: session.id,
    section_id: session.section_id,
    sequence_number: session.sequence_number,
    title: session.title,
    state: session.state,
    planned_date: session.planned_date,
    actual_start_at: session.actual_start_at,
    actual_end_at: session.actual_end_at,
    late_after_minutes: session.late_after_minutes
  };
}

// One entry per student, folding however many days they attended into the facts
// the table needs: when they first arrived, how they were recorded, and which
// days they were in the room. Since 0048 a paused-and-resumed class has two rows
// per student who came to both — building a Map straight from the rows would
// silently keep whichever happened to come last.
async function loadAttendance(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("class_attendance")
    .select("profile_id, checked_in_at, attendance_date, source, note")
    .eq("class_session_id", sessionId)
    .order("checked_in_at", { ascending: true });
  if (error) throw error;

  const byProfile = new Map<string, {
    checked_in_at: string;
    source: string;
    note: string | null;
    days: string[];
  }>();
  for (const row of data || []) {
    const key = String(row.profile_id);
    const existing = byProfile.get(key);
    if (existing) {
      existing.days.push(String(row.attendance_date));
      continue;
    }
    byProfile.set(key, {
      // Rows arrive oldest first, so the first one seen is the first arrival —
      // which is what lateness is measured against.
      checked_in_at: String(row.checked_in_at),
      source: String(row.source),
      note: row.note ? String(row.note) : null,
      days: [String(row.attendance_date)]
    });
  }
  return byProfile;
}

// ------------------------------------------------------------------- grading

/**
 * The professor's grading table. The rows and totals come from
 * `classGradingRows` in _shared/class-grade.ts — the same function the exit
 * ticket and the session close use to decide what to post, so what he reads
 * here and what a student reads on their phone can never be two calculations.
 *
 * Opening the record for a CLOSED class also repairs its posting. There is no
 * Post button any more, so a posting that failed on close — a dropped
 * connection, a transient database error — would otherwise leave the class
 * permanently ungraded with nothing the professor could press: pitfall #70, a
 * state with no exit. This is a repair, not a decision; the grades for a closed
 * class are meant to be posted, always, and an upsert of what is already there
 * changes nothing.
 */
async function gradingTable(db: Db, session: ClassSession, actorProfileId: string) {
  if (session.state === "closed") {
    await postClassGradesQuietly(db, session, {
      actorProfileId,
      trigger: "class_closed"
    });
  }
  const { rows, totals } = await classGradingRows(db, session);
  return {
    session: sessionHeader(session),
    weights: gradingWeights(),
    totals,
    rows
  };
}

// ------------------------------------------------------------------- actions

/**
 * The escape hatch for the phone that died and the camera that refused. It
 * writes a real attendance row, tagged as instructor-set with a required note,
 * so the table never silently claims someone scanned when they did not.
 */
async function markPresent(
  db: Db,
  session: ClassSession,
  actorProfileId: string,
  body: Record<string, unknown>
) {
  const profileId = cleanUuid(body.profile_id, "student id");
  const note = String(body.note || "").trim();
  if (note.length < 3) throw new Error("A short note is required when marking a student present.");
  if (note.length > 500) throw new Error("That note is too long.");

  const { data: enrollment, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("id")
    .eq("section_id", session.section_id)
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (enrollmentError) throw enrollmentError;
  if (!enrollment) throw new Error("That student is not enrolled in this class group.");

  // Same first-scan-wins rule as a real scan, now per day: if they are already
  // marked present today the recorded time stands, and marking them present on
  // the day a paused class resumes records that day on its own.
  const today = classDateFor();
  const { error } = await db.from("class_attendance").upsert(
    {
      course_id: session.course_id,
      class_session_id: session.id,
      section_id: session.section_id,
      profile_id: profileId,
      checked_in_at: new Date().toISOString(),
      attendance_date: today,
      source: "instructor",
      marked_by_profile_id: actorProfileId,
      note
    },
    {
      onConflict: "class_session_id,profile_id,attendance_date",
      ignoreDuplicates: true
    }
  );
  if (error) throw error;

  await db.from("audit_log").insert({
    course_id: session.course_id,
    actor_profile_id: actorProfileId,
    target_type: "class_attendance",
    target_id: session.id,
    action: "mark_present",
    metadata: { profile_id: profileId, note }
  });

  return await attendanceTable(db, session);
}

async function recordOverride(
  db: Db,
  session: ClassSession,
  actorProfileId: string,
  body: Record<string, unknown>
) {
  const profileId = cleanUuid(body.profile_id, "student id");
  const reason = String(body.reason || "").trim();
  if (reason.length < 5) throw new Error("A written reason is required to override a grade.");
  if (reason.length > 1000) throw new Error("That reason is too long.");

  // Null clears the override and hands the student back to the calculated
  // grade. The reason stays required: removing an override is also a decision.
  let grade: number | null = null;
  if (body.grade !== null && body.grade !== undefined && String(body.grade).trim() !== "") {
    grade = Number(body.grade);
    if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
      throw new Error("An override must be a grade between 0 and 100.");
    }
    grade = round2(grade);
  }

  // Snapshot what the formula said at the moment of the override, so the record
  // still shows what was overridden even if the underlying data later changes.
  // Straight to the rows, not through gradingTable: that one repairs posting as
  // a side effect, and posting the pre-override number a line before writing
  // the override would put the wrong grade on the student's phone in between.
  const current = await classGradingRows(db, session);
  const row = current.rows.find((candidate) => candidate.profile_id === profileId);
  if (!row) throw new Error("That student is not in this class group.");

  const { error } = await db.from("class_grade_overrides").insert({
    course_id: session.course_id,
    class_session_id: session.id,
    profile_id: profileId,
    grade,
    calculated_grade: row.calculated_grade,
    reason,
    actor_profile_id: actorProfileId
  });
  if (error) throw error;

  await db.from("audit_log").insert({
    course_id: session.course_id,
    actor_profile_id: actorProfileId,
    target_type: "class_grade_override",
    target_id: session.id,
    action: grade === null ? "clear_grade_override" : "set_grade_override",
    metadata: { profile_id: profileId, grade, calculated_grade: row.calculated_grade, reason }
  });

  // Push the corrected number straight to the student. There is no longer a
  // Post button to press afterwards, so an override that did not re-post would
  // leave the professor looking at the grade he just set while the student's
  // phone still showed the old one.
  await postClassGradesQuietly(db, session, {
    profileIds: [profileId],
    actorProfileId,
    trigger: "grade_override"
  });

  return await gradingTable(db, session, actorProfileId);
}

