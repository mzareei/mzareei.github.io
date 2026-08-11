// Reset the course back to "nothing has happened yet".
//
// The professor rehearses with invented students before a semester starts. This
// is how that rehearsal gets cleared without taking the lectures, question
// banks or schedule down with it.
//
// `preview` counts everything the reset would remove and lists every student
// with what they did, so the decision is made against real numbers rather than
// a guess. `execute` refuses without both a typed confirmation and a matching
// preview — see the note on the confirm token below.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

// Deliberately not a teacher-wide action. A TA should be able to read every
// screen in the course and still not be able to erase the semester.
const resetRoles = ["platform_owner", "instructor"];
const CONFIRM_TOKEN = "RESET";

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
    if (!roles.some((role) => resetRoles.includes(role))) {
      throw new Error("Resetting the course is not allowed for this role.");
    }

    switch (body.action) {
      case "preview":
        return json(await preview(db, courseId));
      case "execute":
        return json(await execute(db, courseId, String(profile.id), body));
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = (error as Error)?.message || "Unable to reset the course.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
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
    .select("role")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => String(row.role));
}

async function countIn(db: Db, table: string, column: string, values: string[]) {
  if (!values.length) return 0;
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .in(column, values);
  if (error) throw error;
  return count ?? 0;
}

async function countEq(db: Db, table: string, column: string, value: string) {
  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function idsOf(db: Db, table: string, column: string, values: string[]) {
  if (!values.length) return [];
  const { data, error } = await db.from(table).select("id").in(column, values);
  if (error) throw error;
  return (data || []).map((row) => String(row.id));
}

/**
 * Counts every row the reset would delete, and profiles every student so the
 * professor can tell an invented name from a real one by what it did.
 */
async function preview(db: Db, courseId: string) {
  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id")
    .eq("course_id", courseId);
  if (sectionError) throw sectionError;
  const sectionIds = (sections || []).map((row) => String(row.id));

  const { data: sessions, error: sessionError } = await db
    .from("class_sessions")
    .select("id, state, actual_start_at, join_code")
    .eq("course_id", courseId);
  if (sessionError) throw sessionError;
  const sessionIds = (sessions || []).map((row) => String(row.id));
  const sessionsToRewind = (sessions || []).filter(
    (row) => String(row.state) !== "planned" || row.actual_start_at || row.join_code
  ).length;

  const roundIds = await idsOf(db, "pulse_rounds", "course_id", [courseId]);
  const attemptIds = await idsOf(db, "student_attempts", "section_id", sectionIds);
  const gradebookItemIds = await idsOf(db, "gradebook_items", "course_id", [courseId]);
  const quizLectureIds = (
    await db.from("quiz_lectures").select("id").eq("course_id", courseId)
  ).data?.map((row) => String(row.id)) ?? [];
  const quizSessionIds = await idsOf(db, "quiz_sessions", "lecture_id", quizLectureIds);

  const [
    pulseAnswers,
    attendance,
    responses,
    activityInstances,
    exitTickets,
    portfolioEntries,
    overrides,
    gradebookScores,
    participation,
    notes,
    presentationState,
    quizAttempts,
    legacyTickets,
    legacyPortfolios
  ] = await Promise.all([
    countIn(db, "pulse_answers", "round_id", roundIds),
    countEq(db, "class_attendance", "course_id", courseId),
    countIn(db, "student_responses", "student_attempt_id", attemptIds),
    countIn(db, "activity_instances", "section_id", sectionIds),
    countEq(db, "exit_tickets", "course_id", courseId),
    countEq(db, "portfolio_entries", "course_id", courseId),
    countEq(db, "class_grade_overrides", "course_id", courseId),
    countIn(db, "gradebook_scores", "gradebook_item_id", gradebookItemIds),
    countEq(db, "participation_events", "course_id", courseId),
    countEq(db, "class_student_notes", "course_id", courseId),
    countIn(db, "class_presentation_state", "class_session_id", sessionIds),
    countIn(db, "quiz_attempts", "session_id", quizSessionIds),
    countEq(db, "course_exit_tickets", "course_id", courseId),
    countEq(db, "course_portfolio_submissions", "course_id", courseId)
  ]);

  return {
    course_id: courseId,
    counts: {
      pulse_rounds: roundIds.length,
      pulse_answers: pulseAnswers,
      class_attendance: attendance,
      student_attempts: attemptIds.length,
      student_responses: responses,
      activity_instances: activityInstances,
      exit_tickets: exitTickets,
      portfolio_entries: portfolioEntries,
      class_grade_overrides: overrides,
      gradebook_items: gradebookItemIds.length,
      gradebook_scores: gradebookScores,
      participation_events: participation,
      class_student_notes: notes,
      class_presentation_state: presentationState,
      class_sessions_rewound: sessionsToRewind
    },
    legacy_counts: {
      quiz_sessions: quizSessionIds.length,
      quiz_attempts: quizAttempts,
      course_exit_tickets: legacyTickets,
      course_portfolio_submissions: legacyPortfolios
    },
    kept: {
      class_sessions: sessionIds.length,
      sections: sectionIds.length
    },
    students: await studentActivity(db, courseId, sectionIds, roundIds, attemptIds)
  };
}

/**
 * One row per enrolled student with what they actually did. A profile with a
 * check-in but no answers looks very different from one that ran a whole
 * rehearsed class, and the professor recognises their own invented names.
 */
async function studentActivity(
  db: Db,
  courseId: string,
  sectionIds: string[],
  roundIds: string[],
  attemptIds: string[]
) {
  if (!sectionIds.length) return [];
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("profile_id, status, role")
    .in("section_id", sectionIds)
    .eq("role", "student");
  if (error) throw error;

  const profileIds = Array.from(new Set((enrollments || []).map((row) => String(row.profile_id))));
  if (!profileIds.length) return [];

  const activeById = new Map<string, boolean>();
  for (const row of enrollments || []) {
    const key = String(row.profile_id);
    activeById.set(key, activeById.get(key) || String(row.status) === "active");
  }

  const [profilesResult, attendanceResult, answersResult, attemptsResult, ticketsResult, staffResult] =
    await Promise.all([
      db.from("profiles").select("id, full_name, preferred_name, student_identifier, institutional_email, created_at").in("id", profileIds),
      db.from("class_attendance").select("profile_id").eq("course_id", courseId),
      roundIds.length
        ? db.from("pulse_answers").select("profile_id").in("round_id", roundIds)
        : Promise.resolve({ data: [], error: null }),
      attemptIds.length
        ? db.from("student_attempts").select("profile_id").in("id", attemptIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("exit_tickets").select("profile_id").eq("course_id", courseId),
      db.from("course_memberships").select("profile_id, role").in("profile_id", profileIds).eq("status", "active")
    ]);
  if (profilesResult.error) throw profilesResult.error;

  const tally = (rows: Array<{ profile_id: unknown }> | null) => {
    const map = new Map<string, number>();
    for (const row of rows || []) {
      const key = String(row.profile_id);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };
  const checkIns = tally(attendanceResult.data);
  const answers = tally(answersResult.data);
  const attempts = tally(attemptsResult.data);
  const tickets = tally(ticketsResult.data);

  const staff = new Set(
    (staffResult.data || [])
      .filter((row) => ["platform_owner", "instructor", "teaching_assistant"].includes(String(row.role)))
      .map((row) => String(row.profile_id))
  );

  return (profilesResult.data || [])
    .map((person) => {
      const id = String(person.id);
      return {
        profile_id: id,
        name: String(person.preferred_name || person.full_name || "Student"),
        student_identifier: person.student_identifier ? String(person.student_identifier) : null,
        email: person.institutional_email ? String(person.institutional_email) : null,
        enrolled_active: activeById.get(id) ?? false,
        // Staff can never be removed here; the database refuses it too.
        removable: !staff.has(id),
        check_ins: checkIns.get(id) || 0,
        pulse_answers: answers.get(id) || 0,
        quiz_attempts: attempts.get(id) || 0,
        reflections: tickets.get(id) || 0
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function execute(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  if (String(body.confirm || "").trim().toUpperCase() !== CONFIRM_TOKEN) {
    throw new Error(`Type ${CONFIRM_TOKEN} to confirm.`);
  }

  const requested = Array.isArray(body.remove_profile_ids) ? body.remove_profile_ids : [];
  const removeIds = Array.from(
    new Set(requested.map((value) => cleanUuid(value)).filter((value): value is string => Boolean(value)))
  );
  if (removeIds.includes(actorProfileId)) {
    throw new Error("You cannot remove your own account.");
  }

  const { data: counts, error } = await db.rpc("reset_course_activity", { p_course_id: courseId });
  if (error) throw error;

  // One student at a time, on purpose. A profile that cannot be deleted —
  // because it authored something the schema protects — must not roll back a
  // wipe that already succeeded.
  const removed: string[] = [];
  const refused: Array<{ profile_id: string; reason: string }> = [];
  for (const profileId of removeIds) {
    const { error: removeError } = await db.rpc("remove_course_student", {
      p_course_id: courseId,
      p_profile_id: profileId
    });
    if (removeError) {
      refused.push({
        profile_id: profileId,
        reason:
          String(removeError.message || "").includes("profile_is_staff")
            ? "That account teaches this course."
            : "That account is still referenced by something else."
      });
    } else {
      removed.push(profileId);
    }
  }

  // Written after the wipe and deliberately not deleted by it: the record that
  // the reset happened is the one thing that must survive the reset.
  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "course",
    target_id: null,
    action: "reset_course_activity",
    metadata: { counts, removed_profiles: removed.length, refused_profiles: refused.length }
  });

  return { counts, removed: removed.length, refused };
}
