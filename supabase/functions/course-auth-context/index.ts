import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed } from "../_shared/identity.ts";
// Claiming a profile is not this endpoint's private business: a student can
// reach course-session-join first by scanning the class QR on a first-ever
// sign-in, and that door needs the same claim.
import { loadOrClaimProfile } from "../_shared/profile-claim.ts";

const visibleReleaseStates = ["released", "live", "paused", "review_only", "scheduled"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];

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
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid or expired session." }, { status: 401 });

    const user = {
      id: userData.user.id,
      email: userData.user.email || ""
    };
    await assertCourseEmailAllowed(db, user.email);

    const profile = await loadOrClaimProfile(db, user);
    if (!profile) {
      return json({
        user,
        profile: null,
        memberships: [],
        sections: [],
        releases: [],
        student_sessions: [],
        teacher_sessions: [],
        roster_status: "missing_profile"
      });
    }

    const memberships = await loadMemberships(db, courseId, profile.id);
    const sections = await loadSections(db, courseId, profile.id);
    const releases = await loadVisibleReleases(db, courseId, sections.map((section) => section.id));
    const teacherContext = isTeacherContext(memberships, sections);
    const studentSessions = teacherContext
      ? []
      : await loadStudentSessions(db, courseId, profile.id, sections);
    const teacherSessions = teacherContext
      ? await loadTeacherSessions(db, courseId, profile.id, memberships, sections)
      : [];

    return json({
      user,
      profile,
      memberships,
      sections,
      releases,
      student_sessions: studentSessions,
      teacher_sessions: teacherSessions,
      roster_status: memberships.length || sections.length ? "active" : "not_enrolled"
    });
  } catch (error) {
    return json({ error: error.message || "Unable to load course context." }, { status: 400 });
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

async function loadMemberships(db: ReturnType<typeof adminClient>, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("id, course_id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("role", { ascending: true });
  if (error) throw error;

  const memberships = data || [];
  const { data: courses, error: courseError } = await db
    .from("courses")
    .select("id, title, code, term_label, status")
    .eq("id", courseId);
  if (courseError) throw courseError;
  const courseById = new Map((courses || []).map((course) => [course.id, course]));

  return memberships.map((membership) => {
    const course = courseById.get(membership.course_id) || {};
    return {
      ...membership,
      course_title: course.title || "",
      course_code: course.code || "",
      term_label: course.term_label || ""
    };
  });
}

async function loadSections(db: ReturnType<typeof adminClient>, courseId: string, profileId: string) {
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("id, section_id, role, status, enrolled_at")
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;

  const sectionIds = Array.from(new Set((enrollments || []).map((enrollment) => enrollment.section_id).filter(Boolean)));
  if (!sectionIds.length) return [];

  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, meeting_pattern, campus, status")
    .eq("course_id", courseId)
    .in("id", sectionIds);
  if (sectionError) throw sectionError;

  const sectionById = new Map((sections || []).map((section) => [section.id, section]));
  return (enrollments || [])
    .map((enrollment) => {
      const section = sectionById.get(enrollment.section_id);
      if (!section) return null;
      return {
        ...section,
        enrollment_id: enrollment.id,
        role: enrollment.role,
        enrolled_at: enrollment.enrolled_at
      };
    })
    .filter(Boolean);
}

async function loadVisibleReleases(db: ReturnType<typeof adminClient>, courseId: string, sectionIds: string[]) {
  const { data: releases, error } = await db
    .from("content_releases")
    .select("id, content_item_id, section_id, class_session_id, state, opens_at, closes_at, review_opens_at, review_closes_at")
    .eq("course_id", courseId)
    .in("state", visibleReleaseStates)
    .order("opens_at", { ascending: true });
  if (error) throw error;

  const now = new Date();
  const visible = (releases || []).filter((release) => isReleaseVisible(release, now, sectionIds));
  if (!visible.length) return [];

  const contentIds = Array.from(new Set(visible.map((release) => release.content_item_id).filter(Boolean)));
  const sessionIds = Array.from(new Set(visible.map((release) => release.class_session_id).filter(Boolean)));

  const [{ data: items, error: itemError }, { data: sessions, error: sessionError }] = await Promise.all([
    db
      .from("content_items")
      .select("id, content_type, slug, title, summary, source_kind, source_ref, default_points")
      .in("id", contentIds),
    sessionIds.length
      ? db
          .from("class_sessions")
          .select("id, title, planned_date, state, continued_from_session_id")
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (itemError) throw itemError;
  if (sessionError) throw sessionError;

  const itemById = new Map((items || []).map((item) => [item.id, item]));
  const sessionById = new Map((sessions || []).map((session) => [session.id, session]));
  const originIds = Array.from(new Set((sessions || []).map((session) => session.continued_from_session_id).filter(Boolean)));
  const { data: originSessions, error: originError } = originIds.length
    ? await db
        .from("class_sessions")
        .select("id, title, planned_date, state")
        .in("id", originIds)
    : { data: [], error: null };
  if (originError) throw originError;
  const originById = new Map((originSessions || []).map((session) => [session.id, session]));

  const activityContentIds = Array.from(new Set(
    visible
      .map((release) => itemById.get(release.content_item_id))
      .filter((item) => item && item.content_type === "activity")
      .map((item) => item.id)
  ));
  const activityInstanceByContentId = await loadOpenActivityInstances(db, activityContentIds, sectionIds);

  return visible
    .map((release) => {
      const item = itemById.get(release.content_item_id);
      if (!item) return null;
      const session = sessionById.get(release.class_session_id) || {};
      const origin = session.continued_from_session_id ? originById.get(session.continued_from_session_id) || {} : {};
      return {
        release_id: release.id,
        state: effectiveReleaseState(release, now),
        release_state: release.state,
        opens_at: release.opens_at,
        closes_at: release.closes_at,
        content_type: item.content_type,
        activity_instance_id: activityInstanceByContentId.get(String(item.id)) || null,
        slug: item.slug,
        title: item.title,
        summary: item.summary || "",
        source_kind: item.source_kind,
        source_ref: item.source_ref,
        default_points: item.default_points,
        class_session_id: release.class_session_id || null,
        class_session_title: session.title || "",
        planned_date: session.planned_date || "",
        session_state: session.state || "",
        continued_from_session_id: session.continued_from_session_id || null,
        continued_from_session_title: origin.title || ""
      };
    })
    .filter(Boolean);
}

async function loadOpenActivityInstances(
  db: ReturnType<typeof adminClient>,
  contentItemIds: string[],
  sectionIds: string[]
) {
  const map = new Map<string, string>();
  if (!contentItemIds.length || !sectionIds.length) return map;
  const { data: templates, error: templateError } = await db
    .from("activity_templates")
    .select("id, content_item_id")
    .in("content_item_id", contentItemIds);
  if (templateError) throw templateError;
  const templateToContent = new Map((templates || []).map((tpl) => [String(tpl.id), String(tpl.content_item_id)]));
  const templateIds = (templates || []).map((tpl) => tpl.id);
  if (!templateIds.length) return map;
  const { data: instances, error: instanceError } = await db
    .from("activity_instances")
    .select("id, activity_template_id, section_id, state, created_at")
    .in("activity_template_id", templateIds)
    .in("section_id", sectionIds)
    .in("state", ["open", "live"])
    .order("created_at", { ascending: false });
  if (instanceError) throw instanceError;
  (instances || []).forEach((inst) => {
    const contentId = templateToContent.get(String(inst.activity_template_id));
    if (contentId && !map.has(contentId)) map.set(contentId, String(inst.id));
  });
  return map;
}

function isTeacherContext(memberships: Record<string, unknown>[], sections: Record<string, unknown>[]) {
  return memberships.some((membership) => teacherRoles.includes(String(membership.role)))
    || sections.some((section) => String(section.role) === "teaching_assistant");
}

async function loadStudentSessions(
  db: ReturnType<typeof adminClient>,
  courseId: string,
  profileId: string,
  sections: Record<string, unknown>[]
) {
  if (!profileId) return [];
  const sectionIds = unique(sections.map((section) => section.id));
  if (!sectionIds.length) return [];

  const { data: sessions, error } = await db
    .from("class_sessions")
    .select("id, section_id, title, planned_date, state, join_code, content_item_id")
    .eq("course_id", courseId)
    .in("section_id", sectionIds)
    .in("state", ["planned", "open", "live", "paused", "continued"])
    .order("planned_date", { ascending: true })
    .order("sequence_number", { ascending: true });
  if (error) throw error;
  if (!(sessions || []).length) return [];

  const contentIds = unique((sessions || []).map((session) => session.content_item_id));
  const { data: items, error: itemError } = contentIds.length
    ? await db
        .from("content_items")
        .select("id, slug, title")
        .eq("course_id", courseId)
        .in("id", contentIds)
    : { data: [], error: null };
  if (itemError) throw itemError;

  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  return (sessions || []).map((session) => {
    const section = sectionById.get(session.section_id) || {};
    const item = itemById.get(session.content_item_id) || {};
    return {
      session_id: session.id,
      section_id: session.section_id,
      section_code: section.section_code || "",
      title: session.title,
      planned_date: session.planned_date,
      state: session.state,
      join_code: session.join_code || "",
      content_item_id: session.content_item_id || null,
      content_slug: item.slug || null,
      content_title: item.title || null
    };
  });
}

async function loadTeacherSessions(
  db: ReturnType<typeof adminClient>,
  courseId: string,
  profileId: string,
  memberships: Record<string, unknown>[],
  sections: Record<string, unknown>[]
) {
  const isGlobalCourseInstructor = memberships.some((membership) => String(membership.role) === "platform_owner");
  const permittedSectionIds = isGlobalCourseInstructor
    ? []
    : unique(sections
        .filter((section) => ["instructor", "teaching_assistant"].includes(String(section.role)))
        .map((section) => section.id));
  if (!isGlobalCourseInstructor && !permittedSectionIds.length) return [];

  let query = db
    .from("class_sessions")
    .select("id, course_id, section_id, sequence_number, title, planned_date, state, join_code, content_item_id, continued_from_session_id")
    .eq("course_id", courseId)
    .order("planned_date", { ascending: true })
    .order("sequence_number", { ascending: true });
  if (!isGlobalCourseInstructor) query = query.in("section_id", permittedSectionIds);

  const { data: sessions, error } = await query;
  if (error) throw error;
  if (!(sessions || []).length) return [];

  const sectionIds = unique((sessions || []).map((session) => session.section_id));
  const originIds = unique((sessions || []).map((session) => session.continued_from_session_id));
  const contentIds = unique((sessions || []).map((session) => session.content_item_id));
  const [
    { data: sectionRows, error: sectionError },
    { data: originRows, error: originError },
    { data: itemRows, error: itemError }
  ] = await Promise.all([
    sectionIds.length
      ? db
          .from("course_sections")
          .select("id, section_code, section_name")
          .in("id", sectionIds)
      : Promise.resolve({ data: [], error: null }),
    originIds.length
      ? db
          .from("class_sessions")
          .select("id, title, planned_date, state")
          .in("id", originIds)
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? db
          .from("content_items")
          .select("id, slug, title, source_kind, source_ref")
          .eq("course_id", courseId)
          .in("id", contentIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (sectionError) throw sectionError;
  if (originError) throw originError;
  if (itemError) throw itemError;

  const sectionById = new Map((sectionRows || []).map((section) => [section.id, section]));
  const originById = new Map((originRows || []).map((session) => [session.id, session]));
  const itemById = new Map((itemRows || []).map((item) => [item.id, item]));
  return (sessions || []).map((session) => {
    const section = sectionById.get(session.section_id) || {};
    const origin = session.continued_from_session_id ? originById.get(session.continued_from_session_id) || {} : {};
    const item = itemById.get(session.content_item_id) || {};
    return {
      session_id: session.id,
      course_id: session.course_id,
      section_id: session.section_id,
      section_code: section.section_code || "",
      section_name: section.section_name || "",
      sequence_number: session.sequence_number,
      title: session.title,
      planned_date: session.planned_date,
      state: session.state,
      join_code: session.join_code || "",
      content_item_id: session.content_item_id || null,
      content_slug: item.slug || null,
      content_title: item.title || null,
      source_kind: item.source_kind || null,
      source_ref: item.source_ref || null,
      continued_from_session_id: session.continued_from_session_id || null,
      continued_from_session_title: origin.title || ""
    };
  });
}

function isReleaseVisible(release: Record<string, unknown>, now: Date, sectionIds: string[]) {
  const sectionAllowed = !release.section_id || sectionIds.includes(String(release.section_id));
  const scheduledAllowed = String(release.state) !== "scheduled" || isScheduledOpen(release, now);
  const openAllowed = !release.opens_at || new Date(String(release.opens_at)) <= now;
  const closeAllowed =
    !release.closes_at || new Date(String(release.closes_at)) >= now || String(release.state) === "review_only";
  return sectionAllowed && scheduledAllowed && openAllowed && closeAllowed;
}

function isScheduledOpen(release: Record<string, unknown>, now: Date) {
  return String(release.state) === "scheduled" && Boolean(release.opens_at) && new Date(String(release.opens_at)) <= now;
}

function effectiveReleaseState(release: Record<string, unknown>, now: Date) {
  return isScheduledOpen(release, now) ? "released" : String(release.state);
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
