// The class record: everything that happened to every student in one class.
//
// Two tables, deliberately kept apart:
//   - Attendance and engagement — was the student in the room, and did they
//     respond when asked. Correctness plays no part.
//   - Class grading — did they get the answers right.
// Conflating the two makes both harder to defend when a student disputes one.
//
// Grades are computed HERE and nowhere else. The browser renders the breakdown
// this function returns; it never recalculates, so there is exactly one
// implementation of the formula to keep correct.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import {
  CLASS_GRADE_CATEGORY_NAME,
  computeGrade,
  gradingWeights,
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
        return json(await gradingTable(db, session));
      case "mark_present": {
        if (!isInstructor) throw new Error("Marking attendance is not allowed for this role.");
        return json(await markPresent(db, session, String(profile.id), body));
      }
      case "override": {
        if (!isInstructor) throw new Error("Overriding a grade is not allowed for this role.");
        return json(await recordOverride(db, session, String(profile.id), body));
      }
      case "post_to_gradebook": {
        if (!isInstructor) throw new Error("Posting grades is not allowed for this role.");
        return json(await postToGradebook(db, session, String(profile.id)));
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

type Student = {
  profile_id: string;
  name: string;
  student_identifier: string | null;
};

/** Every active student enrolled in the class's section, name-sorted. */
async function loadRoster(db: Db, sectionId: string): Promise<Student[]> {
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("profile_id")
    .eq("section_id", sectionId)
    .eq("role", "student")
    .eq("status", "active");
  if (error) throw error;

  const profileIds = Array.from(new Set((enrollments || []).map((row) => String(row.profile_id))));
  if (!profileIds.length) return [];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name, student_identifier")
    .in("id", profileIds);
  if (profileError) throw profileError;

  return (profiles || [])
    .map((person) => ({
      profile_id: String(person.id),
      name: String(person.preferred_name || person.full_name || "Student"),
      student_identifier: person.student_identifier ? String(person.student_identifier) : null
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function laterOf(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
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
}) {
  if (!input.checkedInAt) return "absent";
  if (!input.hasQuizAttempt && !input.hasReflection) return "left_early";
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
    loadQuiz(db, session),
    loadReflections(db, session.id)
  ]);

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
      status: attendanceStatus({
        checkedInAt: record?.checked_in_at ?? null,
        startedAt: session.actual_start_at,
        lateAfterMinutes: session.late_after_minutes,
        hasQuizAttempt: Boolean(attempt),
        hasReflection: Boolean(reflection)
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

async function loadAttendance(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("class_attendance")
    .select("profile_id, checked_in_at, source, note")
    .eq("class_session_id", sessionId);
  if (error) throw error;
  return new Map(
    (data || []).map((row) => [
      String(row.profile_id),
      {
        checked_in_at: String(row.checked_in_at),
        source: String(row.source),
        note: row.note ? String(row.note) : null
      }
    ])
  );
}

async function loadReflections(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("exit_tickets")
    .select("profile_id, created_at")
    .eq("class_session_id", sessionId);
  if (error) throw error;
  const byProfile = new Map<string, string>();
  for (const row of data || []) {
    const key = String(row.profile_id);
    byProfile.set(key, laterOf(byProfile.get(key) ?? null, String(row.created_at))!);
  }
  return byProfile;
}

async function loadPulse(db: Db, sessionId: string) {
  const { data: rounds, error } = await db
    .from("pulse_rounds")
    .select("id, points, prompt_snapshot")
    .eq("class_session_id", sessionId);
  if (error) throw error;

  const roundIds = (rounds || []).map((round) => String(round.id));
  // A round is GRADED only if it carries points and had a right answer to find.
  // An ad-hoc show-of-hands question still counts toward engagement — it was
  // asked, and answering it is participation — but grading it would be scoring
  // students against an answer key that does not exist.
  const gradedRoundIds = new Set(
    (rounds || [])
      .filter((round) => {
        const snapshot = (round.prompt_snapshot || {}) as { correct_key?: string | null };
        return Number(round.points || 0) > 0 && Boolean(snapshot.correct_key);
      })
      .map((round) => String(round.id))
  );

  const { data: answers, error: answerError } = roundIds.length
    ? await db
        .from("pulse_answers")
        .select("round_id, profile_id, is_correct, answered_at")
        .in("round_id", roundIds)
    : { data: [], error: null };
  if (answerError) throw answerError;

  const answersByProfile = new Map<
    string,
    Array<{ round_id: string; is_correct: boolean; answered_at: string }>
  >();
  for (const answer of answers || []) {
    const key = String(answer.profile_id);
    if (!answersByProfile.has(key)) answersByProfile.set(key, []);
    answersByProfile.get(key)!.push({
      round_id: String(answer.round_id),
      is_correct: Boolean(answer.is_correct),
      answered_at: String(answer.answered_at)
    });
  }

  return {
    roundCount: roundIds.length,
    gradedRoundIds,
    gradedRoundCount: gradedRoundIds.size,
    answersByProfile
  };
}

/**
 * The final quiz for the class. A session can hold more than one quiz — the Run
 * Class screen deliberately allows starting another — so "final" is the most
 * recently opened instance, not the union of all of them.
 */
async function loadQuiz(db: Db, session: ClassSession) {
  const { data: instances, error } = await db
    .from("activity_instances")
    .select("id, state, question_count, created_at")
    .eq("class_session_id", session.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const instance = (instances || [])[0] || null;
  if (!instance) {
    return { instance: null, questionCount: 0, attemptsByProfile: new Map() };
  }

  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, profile_id, status, submitted_at, score_percent")
    .eq("activity_instance_id", instance.id);
  if (attemptError) throw attemptError;

  const attemptIds = (attempts || []).map((attempt) => String(attempt.id));
  const { data: responses, error: responseError } = attemptIds.length
    ? await db
        .from("student_responses")
        .select("student_attempt_id, is_correct")
        .in("student_attempt_id", attemptIds)
    : { data: [], error: null };
  if (responseError) throw responseError;

  const answeredByAttempt = new Map<string, { correct: number; answered: number }>();
  for (const response of responses || []) {
    const key = String(response.student_attempt_id);
    const tally = answeredByAttempt.get(key) || { correct: 0, answered: 0 };
    tally.answered += 1;
    if (response.is_correct) tally.correct += 1;
    answeredByAttempt.set(key, tally);
  }

  const attemptsByProfile = new Map<
    string,
    { id: string; status: string; submitted_at: string | null; correct: number; answered: number }
  >();
  for (const attempt of attempts || []) {
    const tally = answeredByAttempt.get(String(attempt.id)) || { correct: 0, answered: 0 };
    attemptsByProfile.set(String(attempt.profile_id), {
      id: String(attempt.id),
      status: String(attempt.status),
      submitted_at: attempt.submitted_at ? String(attempt.submitted_at) : null,
      correct: tally.correct,
      answered: tally.answered
    });
  }

  // question_count is what the instance was opened with. Fall back to the widest
  // attempt actually seen, so a legacy instance with a null count still grades
  // against a real denominator instead of dividing by zero.
  const widestAttempt = Math.max(0, ...Array.from(attemptsByProfile.values()).map((a) => a.answered));
  const questionCount = Number(instance.question_count || 0) || widestAttempt;

  return { instance, questionCount, attemptsByProfile };
}

// ------------------------------------------------------------------- grading

async function gradingTable(db: Db, session: ClassSession) {
  const roster = await loadRoster(db, String(session.section_id));
  const [pulse, quiz, reflections, overrides] = await Promise.all([
    loadPulse(db, session.id),
    loadQuiz(db, session),
    loadReflections(db, session.id),
    loadOverrides(db, session.id)
  ]);

  const rows = roster.map((student) => {
    const answers = pulse.answersByProfile.get(student.profile_id) || [];
    const gradedAnswers = answers.filter((answer) => pulse.gradedRoundIds.has(answer.round_id));
    const attempt = quiz.attemptsByProfile.get(student.profile_id) || null;
    const submissionAt = reflections.get(student.profile_id) || null;

    const breakdown = computeGrade({
      // A graded question that was never answered is wrong, not excused. The
      // denominator is every graded question pushed to the room.
      pulseCorrect: gradedAnswers.filter((answer) => answer.is_correct).length,
      pulseTotal: pulse.gradedRoundCount,
      quizCorrect: attempt?.correct ?? 0,
      quizTotal: quiz.questionCount,
      submissionPresent: Boolean(submissionAt)
    });

    const history = overrides.get(student.profile_id) || [];
    const active = history[0] && history[0].grade !== null ? history[0] : null;

    return {
      ...student,
      ...breakdown,
      submission_at: submissionAt,
      quiz_status: attempt?.status ?? null,
      quiz_submitted_at: attempt?.submitted_at ?? null,
      override_grade: active ? active.grade : null,
      override_reason: active ? active.reason : null,
      override_at: active ? active.created_at : null,
      override_by: active ? active.actor_name : null,
      // What the professor is actually reporting for this student. The
      // calculated grade above never changes to match it — an override replaces
      // what is reported, never what was computed.
      final_grade: active ? active.grade : breakdown.calculated_grade,
      override_history: history
    };
  });

  return {
    session: sessionHeader(session),
    weights: gradingWeights(),
    totals: {
      graded_pulse_questions: pulse.gradedRoundCount,
      pulse_rounds_pushed: pulse.roundCount,
      quiz_questions: quiz.questionCount,
      quiz_instance_id: quiz.instance ? String(quiz.instance.id) : null
    },
    rows
  };
}

async function loadOverrides(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("class_grade_overrides")
    .select("profile_id, grade, calculated_grade, reason, actor_profile_id, created_at")
    .eq("class_session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!(data || []).length) return new Map<string, OverrideRow[]>();

  const actorIds = Array.from(new Set((data || []).map((row) => String(row.actor_profile_id))));
  const { data: actors, error: actorError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", actorIds);
  if (actorError) throw actorError;
  const actorName = new Map(
    (actors || []).map((person) => [
      String(person.id),
      String(person.preferred_name || person.full_name || "Instructor")
    ])
  );

  const byProfile = new Map<string, OverrideRow[]>();
  for (const row of data || []) {
    const key = String(row.profile_id);
    if (!byProfile.has(key)) byProfile.set(key, []);
    byProfile.get(key)!.push({
      grade: row.grade === null ? null : Number(row.grade),
      calculated_grade: row.calculated_grade === null ? null : Number(row.calculated_grade),
      reason: String(row.reason),
      actor_name: actorName.get(String(row.actor_profile_id)) || "Instructor",
      created_at: String(row.created_at)
    });
  }
  return byProfile;
}

type OverrideRow = {
  grade: number | null;
  calculated_grade: number | null;
  reason: string;
  actor_name: string;
  created_at: string;
};

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

  // Same first-scan-wins rule as a real scan: if they already checked in, the
  // recorded time stands.
  const { error } = await db.from("class_attendance").upsert(
    {
      course_id: session.course_id,
      class_session_id: session.id,
      section_id: session.section_id,
      profile_id: profileId,
      checked_in_at: new Date().toISOString(),
      source: "instructor",
      marked_by_profile_id: actorProfileId,
      note
    },
    { onConflict: "class_session_id,profile_id", ignoreDuplicates: true }
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
  const current = await gradingTable(db, session);
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

  return await gradingTable(db, session);
}

/**
 * Posting is explicit rather than automatic, so it stays a decision the
 * professor makes once the class has settled — not a side effect of opening a
 * screen. Re-posting after an override updates the same rows in place.
 */
async function postToGradebook(db: Db, session: ClassSession, actorProfileId: string) {
  const table = await gradingTable(db, session);
  const categoryId = await ensureGradebookCategory(db, session.course_id);
  const itemId = await ensureGradebookItem(db, session, categoryId);

  const gradable = table.rows.filter((row) => row.final_grade !== null);
  const skipped = table.rows.length - gradable.length;

  if (gradable.length) {
    const now = new Date().toISOString();
    const { error } = await db.from("gradebook_scores").upsert(
      gradable.map((row) => ({
        gradebook_item_id: itemId,
        profile_id: row.profile_id,
        section_id: session.section_id,
        // score_raw keeps what the formula produced; score_final is what is
        // reported. When they differ, an override is the reason, and the reason
        // itself lives in class_grade_overrides.
        score_raw: row.calculated_grade,
        score_percent: row.raw_score_percent,
        score_final: row.final_grade,
        status: "posted",
        updated_at: now
      })),
      { onConflict: "gradebook_item_id,profile_id" }
    );
    if (error) throw error;
  }

  await db.from("audit_log").insert({
    course_id: session.course_id,
    actor_profile_id: actorProfileId,
    target_type: "gradebook_item",
    target_id: itemId,
    action: "post_class_grades",
    metadata: { class_session_id: session.id, posted: gradable.length, skipped }
  });

  return { gradebook_item_id: itemId, posted: gradable.length, skipped };
}

async function ensureGradebookCategory(db: Db, courseId: string) {
  const { data: existing, error } = await db
    .from("gradebook_categories")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", CLASS_GRADE_CATEGORY_NAME)
    .maybeSingle();
  if (error) throw error;
  if (existing) return String(existing.id);

  // The category groups class grades; it does not weight them. There is one
  // grade per class and the course total is their plain average, so
  // weight_percent has nothing left to configure.
  const { data: created, error: createError } = await db
    .from("gradebook_categories")
    .insert({ course_id: courseId, name: CLASS_GRADE_CATEGORY_NAME, weight_percent: 100, status: "active" })
    .select("id")
    .single();
  if (createError) throw createError;
  return String(created.id);
}

/**
 * One item per class, found by its class session rather than by rebuilding its
 * title. Renaming a session used to strand its grades behind a title that no
 * longer matched and silently post a second item beside the first.
 */
async function ensureGradebookItem(db: Db, session: ClassSession, categoryId: string) {
  const title = `Class ${session.sequence_number} — ${session.title}`.slice(0, 180);
  const { data: existing, error } = await db
    .from("gradebook_items")
    .select("id, title")
    .eq("class_session_id", session.id)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    // Keep the label current if the class was renamed since it was first posted.
    if (String(existing.title) !== title) {
      const { error: renameError } = await db
        .from("gradebook_items")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (renameError) throw renameError;
    }
    return String(existing.id);
  }

  const { data: created, error: createError } = await db
    .from("gradebook_items")
    .insert({
      course_id: session.course_id,
      category_id: categoryId,
      class_session_id: session.id,
      title,
      max_score: 100,
      status: "published"
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return String(created.id);
}
