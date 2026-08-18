// Reset a group — or, deliberately, the whole course — back to "nothing has
// happened yet".
//
// The professor rehearses with invented students before a semester starts. This
// is how that rehearsal gets cleared without taking the lectures, question
// banks or schedule down with it.
//
// **Scope is never implied.** Every call names one of two things: a `section_id`
// (clear that group) or `all_groups: true` (clear every group in the course).
// A call that names neither is refused. The Classes screen is scoped to the
// group in the top-bar switcher, so a reset that quietly defaulted to the whole
// course would read as "reset 501" and mean "reset 402 and 502 as well".
//
// `preview` counts everything the reset would remove inside that scope and
// lists the students in it with what they did, so the decision is made against
// real numbers rather than a guess. `execute` refuses without a typed
// confirmation, and the whole-course confirmation is a different phrase from
// the group one so the bigger action cannot be taken by muscle memory.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

// Platform owner only. Erasing a semester is not part of teaching a group, and
// an instructor invited to teach one group must not be able to do it even to
// their own — they can clear a single class from Run Class, which is the
// reversible, class-sized tool for the same instinct. TAs were never included.
const resetRoles = ["platform_owner"];
// Two phrases, on purpose. The whole-course one is longer than muscle memory.
const CONFIRM_TOKEN = "RESET";
const CONFIRM_TOKEN_ALL = "RESET ALL";

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
      throw new Error("Resetting is not allowed for this role.");
    }

    const target = await resolveTarget(db, courseId, body);

    switch (body.action) {
      case "preview":
        return json(await preview(db, courseId, target));
      case "execute":
        return json(await execute(db, courseId, String(profile.id), target, body));
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = (error as Error)?.message || "Unable to reset.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

interface Target {
  /** null means every group in the course, and only when asked for by name. */
  sectionId: string | null;
  groupName: string;
}

/**
 * Turns the request into exactly one scope, or refuses. Omitting `section_id`
 * is never read as "all groups": that has to be asked for with `all_groups`,
 * so a client bug that drops a field cannot widen the blast radius.
 */
async function resolveTarget(db: Db, courseId: string, body: Record<string, unknown>): Promise<Target> {
  const sectionId = cleanUuid(body.section_id);
  const allGroups = body.all_groups === true;

  if (sectionId && allGroups) {
    throw new Error("Choose one group or all groups, not both.");
  }
  if (!sectionId && !allGroups) {
    throw new Error("Name the group to reset.");
  }
  if (!sectionId) return { sectionId: null, groupName: "" };

  const { data: section, error } = await db
    .from("course_sections")
    .select("id, section_code, section_name")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!section) throw new Error("That group is not part of this course.");

  return {
    sectionId: String(section.id),
    groupName: String(section.section_name || section.section_code || "")
  };
}

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

/** Course-scoped count, narrowed to one section when the reset is group-sized. */
async function countScoped(db: Db, table: string, courseId: string, sectionId: string | null) {
  let query = db.from(table).select("*", { count: "exact", head: true }).eq("course_id", courseId);
  if (sectionId) query = query.eq("section_id", sectionId);
  const { count, error } = await query;
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
 * Counts every row the reset would delete inside the chosen scope, and profiles
 * every student in it so the professor can tell an invented name from a real
 * one by what it did.
 */
async function preview(db: Db, courseId: string, target: Target) {
  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id")
    .eq("course_id", courseId);
  if (sectionError) throw sectionError;
  const allSectionIds = (sections || []).map((row) => String(row.id));
  const sectionIds = target.sectionId ? [target.sectionId] : allSectionIds;

  let sessionQuery = db
    .from("class_sessions")
    .select("id, state, actual_start_at, join_code")
    .eq("course_id", courseId);
  if (target.sectionId) sessionQuery = sessionQuery.eq("section_id", target.sectionId);
  const { data: sessions, error: sessionError } = await sessionQuery;
  if (sessionError) throw sessionError;
  const sessionIds = (sessions || []).map((row) => String(row.id));
  const sessionsToRewind = (sessions || []).filter(
    (row) => String(row.state) !== "planned" || row.actual_start_at || row.join_code
  ).length;

  let roundQuery = db.from("pulse_rounds").select("id").eq("course_id", courseId);
  if (target.sectionId) roundQuery = roundQuery.eq("section_id", target.sectionId);
  const { data: rounds, error: roundError } = await roundQuery;
  if (roundError) throw roundError;
  const roundIds = (rounds || []).map((row) => String(row.id));

  const attemptIds = await idsOf(db, "student_attempts", "section_id", sectionIds);
  const gradebookItemIds = await idsOf(db, "gradebook_items", "course_id", [courseId]);

  // Gradebook items are course-wide: a group reset clears this group's scores
  // and leaves the items standing, because another group's grades hang off them.
  let scoreQuery = db.from("gradebook_scores").select("*", { count: "exact", head: true });
  if (gradebookItemIds.length) scoreQuery = scoreQuery.in("gradebook_item_id", gradebookItemIds);
  if (target.sectionId) scoreQuery = scoreQuery.eq("section_id", target.sectionId);

  // The frozen Gen-1 pilot tables carry no section, so they belong to a
  // whole-course reset only. A group reset reports them as untouched.
  const quizLectureIds = target.sectionId
    ? []
    : (await db.from("quiz_lectures").select("id").eq("course_id", courseId)).data?.map((row) =>
        String(row.id)
      ) ?? [];
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
    countScoped(db, "class_attendance", courseId, target.sectionId),
    countIn(db, "student_responses", "student_attempt_id", attemptIds),
    countIn(db, "activity_instances", "section_id", sectionIds),
    countScoped(db, "exit_tickets", courseId, target.sectionId),
    countScoped(db, "portfolio_entries", courseId, target.sectionId),
    // Overrides hang off a class session, not a section, so they narrow through
    // the session list this scope already resolved.
    countIn(db, "class_grade_overrides", "class_session_id", sessionIds),
    scoreQuery.then(({ count, error }) => {
      if (error) throw error;
      return count ?? 0;
    }),
    countScoped(db, "participation_events", courseId, target.sectionId),
    countIn(db, "class_student_notes", "class_session_id", sessionIds),
    countIn(db, "class_presentation_state", "class_session_id", sessionIds),
    countIn(db, "quiz_attempts", "session_id", quizSessionIds),
    target.sectionId ? Promise.resolve(0) : countScoped(db, "course_exit_tickets", courseId, null),
    target.sectionId
      ? Promise.resolve(0)
      : countScoped(db, "course_portfolio_submissions", courseId, null)
  ]);

  return {
    course_id: courseId,
    scope: target.sectionId ? "group" : "course",
    section_id: target.sectionId,
    group_name: target.groupName,
    group_count: allSectionIds.length,
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
      // Kept on a group reset; only a whole-course reset deletes the items.
      gradebook_items: target.sectionId ? 0 : gradebookItemIds.length,
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
    students: await studentActivity(db, courseId, target, sectionIds, roundIds, attemptIds)
  };
}

/**
 * One row per enrolled student with what they actually did — inside this scope.
 * A profile with a check-in but no answers looks very different from one that
 * ran a whole rehearsed class, and the professor recognises their own invented
 * names. On a group reset this lists that group's students only: the roster of
 * a group someone else teaches is not this screen's business.
 */
async function studentActivity(
  db: Db,
  courseId: string,
  target: Target,
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

  let attendanceQuery = db.from("class_attendance").select("profile_id").eq("course_id", courseId);
  let ticketQuery = db.from("exit_tickets").select("profile_id").eq("course_id", courseId);
  if (target.sectionId) {
    attendanceQuery = attendanceQuery.eq("section_id", target.sectionId);
    ticketQuery = ticketQuery.eq("section_id", target.sectionId);
  }

  const [profilesResult, attendanceResult, answersResult, attemptsResult, ticketsResult, staffResult] =
    await Promise.all([
      db.from("profiles").select("id, full_name, preferred_name, student_identifier, institutional_email, created_at").in("id", profileIds),
      attendanceQuery,
      roundIds.length
        ? db.from("pulse_answers").select("profile_id").in("round_id", roundIds)
        : Promise.resolve({ data: [], error: null }),
      attemptIds.length
        ? db.from("student_attempts").select("profile_id").in("id", attemptIds)
        : Promise.resolve({ data: [], error: null }),
      ticketQuery,
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

  // On a group reset, someone who also sits in another group keeps their
  // account: removing them here only takes them out of this group.
  const otherGroups = target.sectionId
    ? await profilesInOtherGroups(db, courseId, target.sectionId, profileIds)
    : new Set<string>();

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
        in_other_groups: otherGroups.has(id),
        check_ins: checkIns.get(id) || 0,
        pulse_answers: answers.get(id) || 0,
        quiz_attempts: attempts.get(id) || 0,
        reflections: tickets.get(id) || 0
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function profilesInOtherGroups(db: Db, courseId: string, sectionId: string, profileIds: string[]) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("profile_id, section_id, course_sections!inner(course_id)")
    .in("profile_id", profileIds)
    .neq("section_id", sectionId)
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  return new Set((data || []).map((row) => String(row.profile_id)));
}

async function execute(
  db: Db,
  courseId: string,
  actorProfileId: string,
  target: Target,
  body: Record<string, unknown>
) {
  const expected = target.sectionId ? CONFIRM_TOKEN : CONFIRM_TOKEN_ALL;
  if (String(body.confirm || "").trim().toUpperCase().replace(/\s+/g, " ") !== expected) {
    throw new Error(`Type ${expected} to confirm.`);
  }

  const requested = Array.isArray(body.remove_profile_ids) ? body.remove_profile_ids : [];
  const removeIds = Array.from(
    new Set(requested.map((value) => cleanUuid(value)).filter((value): value is string => Boolean(value)))
  );
  if (removeIds.includes(actorProfileId)) {
    throw new Error("You cannot remove your own account.");
  }

  // Nobody may be removed through a group reset who is not in that group —
  // a stale checkbox from a previous scope must not reach across.
  if (target.sectionId && removeIds.length) {
    const { data: inGroup, error: inGroupError } = await db
      .from("section_enrollments")
      .select("profile_id")
      .eq("section_id", target.sectionId)
      .eq("role", "student")
      .in("profile_id", removeIds);
    if (inGroupError) throw inGroupError;
    const allowed = new Set((inGroup || []).map((row) => String(row.profile_id)));
    if (removeIds.some((id) => !allowed.has(id))) {
      throw new Error("One of those students is not in this group. Reload and try again.");
    }
  }

  const { data: counts, error } = target.sectionId
    ? await db.rpc("reset_section_activity", {
        p_course_id: courseId,
        p_section_id: target.sectionId
      })
    : await db.rpc("reset_course_activity", { p_course_id: courseId });
  if (error) throw error;

  // One student at a time, on purpose. A profile that cannot be deleted —
  // because it authored something the schema protects — must not roll back a
  // wipe that already succeeded.
  const removed: string[] = [];
  const refused: Array<{ profile_id: string; reason: string }> = [];
  for (const profileId of removeIds) {
    const { error: removeError } = target.sectionId
      ? await db.rpc("remove_section_student", {
          p_course_id: courseId,
          p_section_id: target.sectionId,
          p_profile_id: profileId
        })
      : await db.rpc("remove_course_student", {
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
    target_type: target.sectionId ? "section" : "course",
    target_id: target.sectionId,
    action: target.sectionId ? "reset_section_activity" : "reset_course_activity",
    metadata: {
      counts,
      scope: target.sectionId ? "group" : "course",
      group_name: target.groupName || null,
      removed_profiles: removed.length,
      refused_profiles: refused.length
    }
  });

  return { counts, removed: removed.length, refused };
}
