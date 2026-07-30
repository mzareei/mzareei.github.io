import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

const allowedSessionTransitions: Record<string, string[]> = {
  planned: ["open", "cancelled"],
  open: ["live", "cancelled"],
  live: ["paused", "closed"],
  paused: ["live", "continued", "closed"],
  continued: ["live"],
  closed: ["continued"],
  cancelled: []
};

const allowedActivityTransitions: Record<string, string[]> = {
  planned: ["open", "live", "closed"],
  open: ["live", "paused", "closed"],
  live: ["paused", "closed"],
  paused: ["live", "closed"],
  closed: ["archived"],
  archived: []
};

const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const instructorRoles = ["platform_owner", "instructor"];

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const db = adminClient();
    const permissions = await requireInstructor(db, token, courseId);
    const { profile } = permissions;

    if (body.action === "create_session") {
      const session = await createSession(db, courseId, {
        sectionId: cleanUuid(body.section_id, "A valid section id is required."),
        title: cleanSessionTitle(body.title),
        plannedDate: cleanPlannedDate(body.planned_date),
        contentItemId: cleanOptionalUuid(body.content_item_id, "A valid lecture id is required."),
        actorProfileId: profile.id,
        permissions
      });
      const sessions = await listSessions(db, courseId, permissions);
      return json({ session, sessions });
    }

    if (body.action === "update_session_state") {
      const session = await updateSessionState(db, {
        sessionId: cleanUuid(body.session_id, "A valid session id is required."),
        nextState: cleanSessionState(body.next_state),
        reason: cleanReason(body.reason),
        actorProfileId: profile.id,
        permissions
      });
      return json({ session });
    }

    if (body.action === "start_session") {
      const session = await startSession(db, courseId, {
        sessionId: cleanUuid(body.session_id, "A valid session id is required."),
        actorProfileId: profile.id,
        permissions
      });
      return json({ session });
    }

    if (body.action === "continue_session") {
      const result = await continueSession(db, {
        sourceSessionId: cleanUuid(body.source_session_id, "A valid source session id is required."),
        plannedDate: cleanDate(body.planned_date),
        title: cleanTitle(body.title),
        teacherNotes: cleanReason(body.teacher_notes),
        movedReleaseIds: cleanUuidList(body.moved_release_ids),
        actorProfileId: profile.id,
        permissions
      });
      return json(result);
    }

    if (body.action === "update_activity_state") {
      const activity = await updateActivityState(db, {
        courseId,
        activityInstanceId: cleanUuid(body.activity_instance_id, "A valid activity instance id is required."),
        nextState: cleanActivityState(body.next_state),
        actorProfileId: profile.id,
        permissions
      });
      return json({ activity });
    }

    if (body.action === "extend_activity_window") {
      const activity = await extendActivityWindow(db, {
        courseId,
        activityInstanceId: cleanUuid(body.activity_instance_id, "A valid activity instance id is required."),
        minutes: cleanExtendMinutes(body.minutes),
        actorProfileId: profile.id,
        permissions
      });
      return json({ activity });
    }

    const sessions = await listSessions(db, courseId, permissions);
    return json({
      sessions,
      allowedSessionTransitions,
      allowedActivityTransitions,
      actions: ["list_sessions", "create_session", "start_session", "update_session_state", "continue_session", "update_activity_state", "extend_activity_window"]
    });
  } catch (error) {
    const message = error.message || "Unable to manage class sessions.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

function cleanUuid(value: unknown, message: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(message);
  }
  return text;
}

function cleanOptionalUuid(value: unknown, message: string) {
  const text = String(value || "").trim();
  return text ? cleanUuid(text, message) : undefined;
}

function cleanUuidList(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from(new Set(rows.map((item) => cleanUuid(item, "A moved release id is invalid."))));
}

function cleanSessionState(value: unknown) {
  const text = String(value || "").trim();
  if (!Object.prototype.hasOwnProperty.call(allowedSessionTransitions, text)) {
    throw new Error("A valid next session state is required.");
  }
  return text;
}

function cleanActivityState(value: unknown) {
  const text = String(value || "").trim();
  if (!Object.prototype.hasOwnProperty.call(allowedActivityTransitions, text)) {
    throw new Error("A valid next activity state is required.");
  }
  return text;
}

function cleanExtendMinutes(value: unknown) {
  const minutes = Number(value || 0);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
    throw new Error("Extension minutes must be between 1 and 180.");
  }
  return Math.round(minutes);
}

function cleanDate(value: unknown) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("A continuation planned date is required.");
  return text;
}

function cleanTitle(value: unknown) {
  const text = String(value || "").trim().slice(0, 180);
  if (text.length < 1) throw new Error("A continuation title is required.");
  return text;
}

function cleanReason(value: unknown) {
  return String(value || "").trim().slice(0, 2000);
}

function cleanSessionTitle(value: unknown) {
  const text = String(value || "").trim().slice(0, 180);
  if (text.length < 1) throw new Error("A title for the class is required.");
  return text;
}

function cleanPlannedDate(value: unknown) {
  const text = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("A date in the form YYYY-MM-DD is required.");
  if (Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
    throw new Error("That date does not exist.");
  }
  return text;
}

/**
 * Add a class day. The sequence number is assigned here rather than asked for:
 * `class_sessions` has `unique (section_id, sequence_number)`, so letting a
 * human pick it is a race and a support ticket. Next = current max + 1 for that
 * section, which is also what "Class 1, Class 2, …" means to a professor.
 */
async function createSession(db: ReturnType<typeof adminClient>, courseId: string, input: {
  sectionId: string;
  title: string;
  plannedDate: string;
  contentItemId?: string;
  actorProfileId: string;
  permissions: { isCourseInstructor: boolean; permittedSectionIds: string[] };
}) {
  assertSectionAllowed(input.permissions, input.sectionId);

  const { data: section, error: sectionError } = await db
    .from("course_sections")
    .select("id")
    .eq("id", input.sectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (sectionError) throw sectionError;
  if (!section) throw new Error("That section is not part of this course.");

  const { data: item, error: itemError } = input.contentItemId
    ? await db
        .from("content_items")
        .select("id, course_id, content_type, slug, title, source_kind, source_ref")
        .eq("id", input.contentItemId)
        .eq("course_id", courseId)
        .maybeSingle()
    : { data: null, error: null };
  if (itemError) throw itemError;
  if (input.contentItemId && (!item || item.content_type !== "lecture")) {
    throw new Error("Choose a lecture from this course.");
  }

  const { data: last, error: lastError } = await db
    .from("class_sessions")
    .select("sequence_number")
    .eq("section_id", input.sectionId)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;
  const sequenceNumber = Number(last?.sequence_number || 0) + 1;

  const { data: created, error: createError } = await db
    .from("class_sessions")
    .insert({
      course_id: courseId,
      section_id: input.sectionId,
      sequence_number: sequenceNumber,
      title: input.title,
      planned_date: input.plannedDate,
      state: "planned",
      join_code: generateJoinCode(),
      content_item_id: input.contentItemId || null
    })
    .select("id, course_id, section_id, sequence_number, title, planned_date, actual_start_at, actual_end_at, state, join_code, content_item_id")
    .single();
  if (createError) {
    if (String(createError.code) === "23505") {
      throw new Error("That class number is already taken for this section. Try again.");
    }
    throw createError;
  }

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "class_session",
    targetId: created.id,
    action: "class_session_created",
    metadata: {
      section_id: input.sectionId,
      sequence_number: sequenceNumber,
      title: input.title,
      planned_date: input.plannedDate,
      content_item_id: input.contentItemId || null
    }
  });

  // listSessions calls this field `session_id`. Returning `id` here would mean
  // one concept with two names depending on which call you made — exactly the
  // cross-boundary mismatch that keeps costing time.
  return {
    ...created,
    session_id: created.id,
    content_item_id: created.content_item_id || null,
    content_slug: item?.slug || null,
    content_title: item?.title || null,
    source_kind: item?.source_kind || null,
    source_ref: item?.source_ref || null
  };
}

async function startSession(
  db: ReturnType<typeof adminClient>,
  courseId: string,
  input: {
    sessionId: string;
    actorProfileId: string;
    permissions: {
      isCourseInstructor: boolean;
      permittedSectionIds: string[];
    };
  }
) {
  const { data: session, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, sequence_number, title, planned_date, actual_start_at, actual_end_at, state, join_code, content_item_id")
    .eq("id", input.sessionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("Class session not found.");
  assertSectionAllowed(input.permissions, session.section_id);

  const currentState = String(session.state || "");
  if (!["planned", "open", "continued"].includes(currentState)) {
    throw new Error(`Transition from ${currentState} to live is not allowed.`);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from("class_sessions")
    .update({
      state: "live",
      actual_start_at: now,
      join_code: session.join_code || generateJoinCode(),
      updated_at: now
    })
    .eq("id", input.sessionId)
    .eq("state", currentState)
    .select("id, course_id, section_id, sequence_number, title, planned_date, actual_start_at, actual_end_at, state, join_code, content_item_id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error("The class changed before it could be started. Refresh and try again.");

  const { data: item, error: itemError } = updated.content_item_id
    ? await db
        .from("content_items")
        .select("id, slug, title, source_kind, source_ref")
        .eq("id", updated.content_item_id)
        .eq("course_id", courseId)
        .maybeSingle()
    : { data: null, error: null };
  if (itemError) throw itemError;

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "class_session",
    targetId: input.sessionId,
    action: "session_state_changed",
    metadata: {
      old_state: currentState,
      new_state: "live",
      reason: null
    }
  });

  return {
    ...updated,
    session_id: updated.id,
    content_item_id: updated.content_item_id || null,
    content_slug: item?.slug || null,
    content_title: item?.title || null,
    source_kind: item?.source_kind || null,
    source_ref: item?.source_ref || null
  };
}

async function requireInstructor(db: ReturnType<typeof adminClient>, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Instructor profile is not linked to this account.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .in("role", teacherRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to manage class sessions for this course.");

  const isCourseInstructor = (memberships || []).some((membership) => instructorRoles.includes(String(membership.role)));
  const permittedSectionIds = isCourseInstructor ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isCourseInstructor && !permittedSectionIds.length) {
    throw new Error("You are not allowed to manage class sessions for this course.");
  }

  return { profile, user: userData.user, isCourseInstructor, permittedSectionIds };
}

async function loadPermittedSectionIds(db: ReturnType<typeof adminClient>, profileId: string, courseId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("section_id, course_sections!inner(course_id)")
    .eq("profile_id", profileId)
    .eq("role", "teaching_assistant")
    .eq("status", "active")
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  return unique((data || []).map((row) => row.section_id));
}

async function listSessions(db: ReturnType<typeof adminClient>, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  let sessionQuery = db
    .from("class_sessions")
    .select("id, course_id, section_id, sequence_number, title, planned_date, actual_start_at, actual_end_at, state, join_code, content_item_id, continued_from_session_id, teacher_notes, updated_at")
    .eq("course_id", courseId)
    .order("planned_date", { ascending: true })
    .order("sequence_number", { ascending: true });
  if (!permissions.isCourseInstructor) sessionQuery = sessionQuery.in("section_id", permissions.permittedSectionIds);
  const { data: sessions, error } = await sessionQuery;
  if (error) throw error;
  if (!(sessions || []).length) return [];

  const sessionIds = unique((sessions || []).map((session) => session.id));
  const sectionIds = unique((sessions || []).map((session) => session.section_id));
  const originIds = unique((sessions || []).map((session) => session.continued_from_session_id));

  const [{ data: sections, error: sectionError }, { data: releases, error: releaseError }] = await Promise.all([
    db
      .from("course_sections")
      .select("id, section_code, section_name")
      .in("id", sectionIds),
    db
      .from("content_releases")
      .select("id, content_item_id, section_id, class_session_id, state, opens_at, closes_at")
      .in("class_session_id", sessionIds)
  ]);
  if (sectionError) throw sectionError;
  if (releaseError) throw releaseError;

  const contentIds = unique([
    ...(releases || []).map((release) => release.content_item_id),
    ...(sessions || []).map((session) => session.content_item_id)
  ]);
  const { data: items, error: itemError } = contentIds.length
    ? await db
        .from("content_items")
        .select("id, title, content_type, slug, source_kind, source_ref")
        .in("id", contentIds)
    : { data: [], error: null };
  if (itemError) throw itemError;

  const sectionById = new Map((sections || []).map((section) => [section.id, section]));
  const sessionById = new Map((sessions || []).map((session) => [session.id, session]));
  const itemById = new Map((items || []).map((item) => [item.id, item]));

  const { data: activityTemplates, error: templateError } = contentIds.length
    ? await db
        .from("activity_templates")
        .select("id, content_item_id, activity_type")
        .in("content_item_id", contentIds)
    : { data: [], error: null };
  if (templateError) throw templateError;

  const templateIds = unique((activityTemplates || []).map((template) => template.id));
  const { data: activityInstances, error: instanceError } = templateIds.length && sectionIds.length
    ? await db
        .from("activity_instances")
        .select("id, activity_template_id, section_id, class_session_id, state, starts_at, ends_at, time_limit_seconds")
        .in("activity_template_id", templateIds)
        .in("section_id", sectionIds)
    : { data: [], error: null };
  if (instanceError) throw instanceError;

  const templatesByContent = new Map<string, any[]>();
  for (const template of activityTemplates || []) {
    const rows = templatesByContent.get(template.content_item_id) || [];
    rows.push(template);
    templatesByContent.set(template.content_item_id, rows);
  }
  const instancesByTemplateSection = new Map<string, any[]>();
  for (const instance of activityInstances || []) {
    const key = `${instance.activity_template_id}:${instance.section_id}`;
    const rows = instancesByTemplateSection.get(key) || [];
    rows.push(instance);
    instancesByTemplateSection.set(key, rows);
  }

  const missingOriginIds = originIds.filter((id) => !sessionById.has(id));
  const { data: missingOrigins, error: originError } = missingOriginIds.length
    ? await db
        .from("class_sessions")
        .select("id, title, planned_date, state")
        .in("id", missingOriginIds)
    : { data: [], error: null };
  if (originError) throw originError;
  for (const origin of missingOrigins || []) sessionById.set(origin.id, origin);

  const releasesBySession = new Map<string, any[]>();
  for (const release of releases || []) {
    const rows = releasesBySession.get(release.class_session_id) || [];
    const item = itemById.get(release.content_item_id) || {};
    const session = sessionById.get(release.class_session_id) || {};
    const targetSectionId = release.section_id || session.section_id || "";
    const template = (templatesByContent.get(release.content_item_id) || []).find((row) => row.activity_type === "quiz")
      || (templatesByContent.get(release.content_item_id) || [])[0]
      || {};
    const matchingInstances = template.id ? instancesByTemplateSection.get(`${template.id}:${targetSectionId}`) || [] : [];
    const activityInstance = matchingInstances.find((row) => row.class_session_id === release.class_session_id)
      || matchingInstances.find((row) => !row.class_session_id)
      || matchingInstances[0]
      || {};
    rows.push({
      release_id: release.id,
      title: item.title || "Untitled content",
      content_type: item.content_type || "",
      state: release.state,
      opens_at: release.opens_at,
      closes_at: release.closes_at,
      activity_instance_id: activityInstance.id || "",
      activity_state: activityInstance.state || "",
      activity_starts_at: activityInstance.starts_at || "",
      activity_ends_at: activityInstance.ends_at || "",
      time_limit_seconds: activityInstance.time_limit_seconds || null,
      carryable: ["released", "live", "paused", "scheduled"].includes(release.state)
    });
    releasesBySession.set(release.class_session_id, rows);
  }

  return (sessions || []).map((session) => {
    const section = sectionById.get(session.section_id) || {};
    const origin = session.continued_from_session_id ? sessionById.get(session.continued_from_session_id) || {} : {};
    const item = itemById.get(session.content_item_id) || {};
    const continuationCount = (sessions || []).filter((row) => row.continued_from_session_id === session.id).length;
    return {
      session_id: session.id,
      course_id: session.course_id,
      section_id: session.section_id,
      section_code: section.section_code || "",
      section_name: section.section_name || "",
      sequence_number: session.sequence_number,
      title: session.title,
      planned_date: session.planned_date,
      actual_start_at: session.actual_start_at,
      actual_end_at: session.actual_end_at,
      state: session.state,
      join_code: session.join_code || "",
      content_item_id: session.content_item_id || null,
      content_slug: item.slug || null,
      content_title: item.title || null,
      source_kind: item.source_kind || null,
      source_ref: item.source_ref || null,
      continued_from_session_id: session.continued_from_session_id,
      continued_from_session_title: origin.title || "",
      teacher_notes: session.teacher_notes || "",
      updated_at: session.updated_at,
      continuation_count: continuationCount,
      releases: releasesBySession.get(session.id) || []
    };
  });
}

async function updateSessionState(db: ReturnType<typeof adminClient>, input: {
  sessionId: string;
  nextState: string;
  reason: string;
  actorProfileId: string;
  permissions: {
    isCourseInstructor: boolean;
    permittedSectionIds: string[];
  };
}) {
  const { data: session, error } = await db
    .from("class_sessions")
    .select("id, state, course_id, section_id, title, actual_start_at")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("Class session not found.");
  assertSectionAllowed(input.permissions, session.section_id);

  const currentState = String(session.state || "");
  const allowed = allowedSessionTransitions[currentState] || [];
  if (!allowed.includes(input.nextState)) {
    throw new Error(`Transition from ${currentState} to ${input.nextState} is not allowed.`);
  }
  if (currentState === "closed" && input.nextState === "continued" && !input.reason) {
    throw new Error("A reason is required when continuing a closed session.");
  }

  const now = new Date().toISOString();
  const changes: Record<string, string> = {
    state: input.nextState,
    updated_at: now
  };
  if (input.nextState === "live" && !session.actual_start_at) changes.actual_start_at = now;
  if (input.nextState === "closed") changes.actual_end_at = now;
  if (input.reason) changes.teacher_notes = input.reason;

  const { data: updated, error: updateError } = await db
    .from("class_sessions")
    .update(changes)
    .eq("id", input.sessionId)
    .select("id, course_id, section_id, title, planned_date, state, continued_from_session_id, teacher_notes, updated_at")
    .single();
  if (updateError) throw updateError;

  if (input.nextState === "paused") {
    await db
      .from("activity_instances")
      .update({ state: "paused", updated_at: now })
      .eq("class_session_id", input.sessionId)
      .in("state", ["open", "live"]);
  }
  if (input.nextState === "closed") {
    await db
      .from("activity_instances")
      .update({ state: "closed", updated_at: now })
      .eq("class_session_id", input.sessionId)
      .in("state", ["open", "live", "paused"]);
  }

  await insertAudit(db, {
    courseId: session.course_id,
    actorProfileId: input.actorProfileId,
    targetType: "class_session",
    targetId: input.sessionId,
    action: "session_state_changed",
    metadata: {
      old_state: currentState,
      new_state: input.nextState,
      reason: input.reason || null
    }
  });

  return updated;
}

async function updateActivityState(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  activityInstanceId: string;
  nextState: string;
  actorProfileId: string;
  permissions: {
    isCourseInstructor: boolean;
    permittedSectionIds: string[];
  };
}) {
  const activity = await loadActivityInstanceForCourse(db, input.activityInstanceId, input.courseId);
  assertSectionAllowed(input.permissions, String(activity.section_id));

  const currentState = String(activity.state || "");
  const allowed = allowedActivityTransitions[currentState] || [];
  if (!allowed.includes(input.nextState)) {
    throw new Error(`Transition from ${currentState} to ${input.nextState} is not allowed.`);
  }

  const now = new Date();
  const changes: Record<string, string> = {
    state: input.nextState,
    updated_at: now.toISOString()
  };
  if (input.nextState === "live" && !activity.starts_at) {
    changes.starts_at = now.toISOString();
  }
  if (input.nextState === "live" && !activity.ends_at && activity.time_limit_seconds) {
    changes.ends_at = new Date(now.getTime() + Number(activity.time_limit_seconds) * 1000).toISOString();
  }
  if (input.nextState === "closed") {
    changes.ends_at = now.toISOString();
  }

  const { data: updated, error: updateError } = await db
    .from("activity_instances")
    .update(changes)
    .eq("id", input.activityInstanceId)
    .select("id, section_id, class_session_id, state, starts_at, ends_at, time_limit_seconds, updated_at")
    .single();
  if (updateError) throw updateError;

  await insertAudit(db, {
    courseId: input.courseId,
    actorProfileId: input.actorProfileId,
    targetType: "activity_instance",
    targetId: input.activityInstanceId,
    action: "activity_state_changed",
    metadata: {
      old_state: currentState,
      new_state: input.nextState
    }
  });

  return updated;
}

async function extendActivityWindow(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  activityInstanceId: string;
  minutes: number;
  actorProfileId: string;
  permissions: {
    isCourseInstructor: boolean;
    permittedSectionIds: string[];
  };
}) {
  const activity = await loadActivityInstanceForCourse(db, input.activityInstanceId, input.courseId);
  assertSectionAllowed(input.permissions, String(activity.section_id));
  if (["closed", "archived"].includes(String(activity.state))) {
    throw new Error("Closed or archived activities cannot be extended.");
  }

  const now = new Date();
  const currentEnd = activity.ends_at ? new Date(String(activity.ends_at)) : now;
  const base = currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const nextEnd = new Date(base.getTime() + input.minutes * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await db
    .from("activity_instances")
    .update({
      ends_at: nextEnd,
      updated_at: now.toISOString()
    })
    .eq("id", input.activityInstanceId)
    .select("id, section_id, class_session_id, state, starts_at, ends_at, time_limit_seconds, updated_at")
    .single();
  if (updateError) throw updateError;

  await insertAudit(db, {
    courseId: input.courseId,
    actorProfileId: input.actorProfileId,
    targetType: "activity_instance",
    targetId: input.activityInstanceId,
    action: "activity_window_extended",
    metadata: {
      previous_ends_at: activity.ends_at || null,
      new_ends_at: nextEnd,
      minutes: input.minutes
    }
  });

  return updated;
}

async function loadActivityInstanceForCourse(db: ReturnType<typeof adminClient>, activityInstanceId: string, courseId: string) {
  const { data: activity, error } = await db
    .from("activity_instances")
    .select("id, section_id, class_session_id, state, starts_at, ends_at, time_limit_seconds")
    .eq("id", activityInstanceId)
    .maybeSingle();
  if (error) throw error;
  if (!activity) throw new Error("Activity instance not found.");

  const { data: section, error: sectionError } = await db
    .from("course_sections")
    .select("id, course_id")
    .eq("id", activity.section_id)
    .maybeSingle();
  if (sectionError) throw sectionError;
  if (!section || section.course_id !== courseId) throw new Error("Activity instance is not part of this course.");

  return activity;
}

async function continueSession(db: ReturnType<typeof adminClient>, input: {
  sourceSessionId: string;
  plannedDate: string;
  title: string;
  teacherNotes: string;
  movedReleaseIds: string[];
  actorProfileId: string;
  permissions: {
    isCourseInstructor: boolean;
    permittedSectionIds: string[];
  };
}) {
  const { data: source, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, sequence_number, title, state")
    .eq("id", input.sourceSessionId)
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new Error("Source session not found.");
  assertSectionAllowed(input.permissions, source.section_id);
  if (!["paused", "closed"].includes(source.state)) {
    throw new Error("Only paused or closed sessions can be continued.");
  }

  const { data: lastSession, error: sequenceError } = await db
    .from("class_sessions")
    .select("sequence_number")
    .eq("section_id", source.section_id)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sequenceError) throw sequenceError;

  const { data: continuation, error: insertError } = await db
    .from("class_sessions")
    .insert({
      course_id: source.course_id,
      section_id: source.section_id,
      sequence_number: Number(lastSession?.sequence_number || source.sequence_number || 0) + 1,
      title: input.title,
      planned_date: input.plannedDate,
      state: "continued",
      continued_from_session_id: input.sourceSessionId,
      teacher_notes: input.teacherNotes || `Continues ${source.title}`
    })
    .select("id, course_id, section_id, title, planned_date, state, continued_from_session_id, teacher_notes")
    .single();
  if (insertError) throw insertError;

  const movedReleases = input.movedReleaseIds.length
    ? await moveReleasesToContinuation(db, {
        sourceSessionId: input.sourceSessionId,
        continuationSessionId: continuation.id,
        releaseIds: input.movedReleaseIds,
        actorProfileId: input.actorProfileId
      })
    : [];

  await insertAudit(db, {
    courseId: source.course_id,
    actorProfileId: input.actorProfileId,
    targetType: "class_session",
    targetId: continuation.id,
    action: "session_continued",
    metadata: {
      continued_from_session_id: input.sourceSessionId,
      moved_release_ids: movedReleases.map((release) => release.id)
    }
  });

  return {
    session: continuation,
    continued_from_session_id: input.sourceSessionId,
    moved_release_ids: movedReleases.map((release) => release.id)
  };
}

function assertSectionAllowed(permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}, sectionId: string) {
  if (permissions.isCourseInstructor) return;
  if (permissions.permittedSectionIds.includes(String(sectionId))) return;
  throw new Error("You are not allowed to manage class sessions for this section.");
}

async function moveReleasesToContinuation(db: ReturnType<typeof adminClient>, input: {
  sourceSessionId: string;
  continuationSessionId: string;
  releaseIds: string[];
  actorProfileId: string;
}) {
  const { data: releases, error } = await db
    .from("content_releases")
    .update({
      class_session_id: input.continuationSessionId,
      updated_by: input.actorProfileId,
      updated_at: new Date().toISOString()
    })
    .in("id", input.releaseIds)
    .eq("class_session_id", input.sourceSessionId)
    .select("id, state");
  if (error) throw error;

  const moved = releases || [];
  if (moved.length) {
    const { error: eventError } = await db
      .from("release_events")
      .insert(moved.map((release) => ({
        content_release_id: release.id,
        actor_profile_id: input.actorProfileId,
        event_type: "scope_changed",
        old_state: release.state,
        new_state: release.state,
        reason: `Moved to continuation session ${input.continuationSessionId}`
      })));
    if (eventError) throw eventError;
  }

  return moved;
}

async function insertAudit(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  actorProfileId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  await db
    .from("audit_log")
    .insert({
      course_id: input.courseId,
      actor_profile_id: input.actorProfileId,
      target_type: input.targetType,
      target_id: input.targetId,
      action: input.action,
      metadata: input.metadata
    });
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
