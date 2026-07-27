import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

const visibleReleaseStates = ["released", "live", "paused", "review_only", "scheduled"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const courseInstructorRoles = ["platform_owner", "instructor"];

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
        roster_status: "missing_profile"
      });
    }

    const memberships = await loadMemberships(db, courseId, profile.id);
    const sections = await loadSections(db, courseId, profile.id);
    const releases = await loadVisibleReleases(db, courseId, sections.map((section) => section.id));
    const teacherSessions = isTeacherContext(memberships, sections)
      ? await loadTeacherSessions(db, courseId, profile.id, memberships, sections)
      : [];

    return json({
      user,
      profile,
      memberships,
      sections,
      releases,
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

async function loadOrClaimProfile(db: ReturnType<typeof adminClient>, user: { id: string; email: string }) {
  const { data: linkedProfile, error: linkedError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (linkedError) throw linkedError;
  if (linkedProfile) {
    assertProfileMatchesAuthEmail(linkedProfile, user.email);
    // A profile can be linked but still 'invited' (e.g. a roster correction set the
    // status without touching the link). Signing in is the claim, so promote it —
    // otherwise student endpoints that require an active profile reject the account.
    if (linkedProfile.status === "invited") {
      const { data: activated, error: activateError } = await db
        .from("profiles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", linkedProfile.id)
        .eq("status", "invited")
        .select("id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status")
        .maybeSingle();
      if (activateError) throw activateError;
      if (activated) return { ...activated, claimed_by_email: false };
    }
    return { ...linkedProfile, claimed_by_email: false };
  }

  const email = String(user.email || "").trim().toLowerCase();
  await assertCourseEmailAllowed(db, email);
  if (!email) return null;

  const { data: rosterProfile, error: rosterError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status")
    .eq("institutional_email", email)
    .maybeSingle();
  if (rosterError) throw rosterError;
  if (!rosterProfile || !["invited", "active"].includes(rosterProfile.status)) return null;
  if (rosterProfile.auth_user_id && rosterProfile.auth_user_id !== user.id) return null;
  assertProfileMatchesAuthEmail(rosterProfile, email);

  const { data: claimedProfile, error: claimError } = await db
    .from("profiles")
    .update({
      auth_user_id: user.id,
      status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("id", rosterProfile.id)
    .is("auth_user_id", null)
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status")
    .maybeSingle();
  if (claimError) throw claimError;
  return claimedProfile ? { ...claimedProfile, claimed_by_email: true } : null;
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

async function loadTeacherSessions(
  db: ReturnType<typeof adminClient>,
  courseId: string,
  profileId: string,
  memberships: Record<string, unknown>[],
  sections: Record<string, unknown>[]
) {
  const isCourseInstructor = memberships.some((membership) => courseInstructorRoles.includes(String(membership.role)));
  const permittedSectionIds = isCourseInstructor
    ? []
    : unique(sections
        .filter((section) => String(section.role) === "teaching_assistant")
        .map((section) => section.id));
  if (!isCourseInstructor && !permittedSectionIds.length) return [];

  let query = db
    .from("class_sessions")
    .select("id, course_id, section_id, sequence_number, title, planned_date, state, continued_from_session_id")
    .eq("course_id", courseId)
    .order("planned_date", { ascending: true })
    .order("sequence_number", { ascending: true });
  if (!isCourseInstructor) query = query.in("section_id", permittedSectionIds);

  const { data: sessions, error } = await query;
  if (error) throw error;
  if (!(sessions || []).length) return [];

  const sectionIds = unique((sessions || []).map((session) => session.section_id));
  const originIds = unique((sessions || []).map((session) => session.continued_from_session_id));
  const [{ data: sectionRows, error: sectionError }, { data: originRows, error: originError }] = await Promise.all([
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
      : Promise.resolve({ data: [], error: null })
  ]);
  if (sectionError) throw sectionError;
  if (originError) throw originError;

  const sectionById = new Map((sectionRows || []).map((section) => [section.id, section]));
  const originById = new Map((originRows || []).map((session) => [session.id, session]));
  return (sessions || []).map((session) => {
    const section = sectionById.get(session.section_id) || {};
    const origin = session.continued_from_session_id ? originById.get(session.continued_from_session_id) || {} : {};
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
