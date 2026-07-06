import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

const allowedTransitions: Record<string, string[]> = {
  draft: ["scheduled", "released"],
  scheduled: ["released", "draft"],
  released: ["live"],
  live: ["paused", "review_only", "closed"],
  paused: ["live", "review_only", "closed"],
  review_only: ["archived"],
  closed: ["review_only", "archived"],
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

    if (body.action === "update_state") {
      const updated = await updateReleaseState(db, {
        releaseId: cleanUuid(body.release_id),
        nextState: cleanState(body.next_state),
        reason: cleanReason(body.reason),
        actorProfileId: profile.id,
        permissions
      });
      return json({ release: updated });
    }

    const releases = await listReleases(db, courseId, permissions);
    return json({
      releases,
      allowedTransitions,
      actions: releaseActions(permissions)
    });
  } catch (error) {
    const message = error.message || "Unable to manage releases.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function releaseActions(permissions: { isCourseInstructor: boolean }) {
  return permissions.isCourseInstructor ? ["list", "update_state"] : ["list"];
}

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

function cleanUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid release id is required.");
  }
  return text;
}

function cleanState(value: unknown) {
  const text = String(value || "").trim();
  if (!Object.prototype.hasOwnProperty.call(allowedTransitions, text)) {
    throw new Error("A valid next state is required.");
  }
  return text;
}

function cleanReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
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
  if (!(memberships || []).length) throw new Error("You are not allowed to manage releases for this course.");

  const isCourseInstructor = (memberships || []).some((membership) => instructorRoles.includes(String(membership.role)));
  const permittedSectionIds = isCourseInstructor ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isCourseInstructor && !permittedSectionIds.length) {
    throw new Error("You are not allowed to manage releases for this course.");
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

async function listReleases(db: ReturnType<typeof adminClient>, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  const { data: releases, error } = await db
    .from("content_releases")
    .select("id, content_item_id, section_id, class_session_id, state, opens_at, closes_at, review_opens_at, review_closes_at, allowed_attempts, updated_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const scopedReleases = permissions.isCourseInstructor
    ? releases || []
    : (releases || []).filter((release) => release.section_id && permissions.permittedSectionIds.includes(String(release.section_id)));
  if (!scopedReleases.length) return [];

  const contentIds = unique(scopedReleases.map((release) => release.content_item_id));
  const sectionIds = unique(scopedReleases.map((release) => release.section_id));
  const sessionIds = unique(scopedReleases.map((release) => release.class_session_id));

  const [{ data: items, error: itemError }, { data: sections, error: sectionError }, { data: sessions, error: sessionError }] = await Promise.all([
    db
      .from("content_items")
      .select("id, content_type, slug, title, summary, source_ref, contains_sensitive_content")
      .in("id", contentIds),
    sectionIds.length
      ? db
          .from("course_sections")
          .select("id, section_code, section_name")
          .in("id", sectionIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? db
          .from("class_sessions")
          .select("id, title, planned_date, state")
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (itemError) throw itemError;
  if (sectionError) throw sectionError;
  if (sessionError) throw sessionError;

  const itemById = new Map((items || []).map((item) => [item.id, item]));
  const sectionById = new Map((sections || []).map((section) => [section.id, section]));
  const sessionById = new Map((sessions || []).map((session) => [session.id, session]));

  return scopedReleases.map((release) => {
    const item = itemById.get(release.content_item_id) || {};
    const section = sectionById.get(release.section_id) || {};
    const session = sessionById.get(release.class_session_id) || {};
    return {
      release_id: release.id,
      content_item_id: release.content_item_id,
      section_id: release.section_id,
      class_session_id: release.class_session_id,
      title: item.title || "Untitled content",
      slug: item.slug || "",
      content_type: item.content_type || "",
      source_ref: item.source_ref || "",
      contains_sensitive_content: Boolean(item.contains_sensitive_content),
      section_code: section.section_code || "All sections",
      section_name: section.section_name || "",
      class_session_title: session.title || "",
      planned_date: session.planned_date || "",
      session_state: session.state || "",
      state: release.state,
      opens_at: release.opens_at,
      closes_at: release.closes_at,
      review_opens_at: release.review_opens_at,
      review_closes_at: release.review_closes_at,
      allowed_attempts: release.allowed_attempts,
      updated_at: release.updated_at
    };
  });
}

async function updateReleaseState(db: ReturnType<typeof adminClient>, input: {
  releaseId: string;
  nextState: string;
  reason: string;
  actorProfileId: string;
  permissions: {
    isCourseInstructor: boolean;
    permittedSectionIds: string[];
  };
}) {
  assertInstructorOnly(input.permissions);

  const { data: release, error } = await db
    .from("content_releases")
    .select("id, state, course_id, section_id, class_session_id")
    .eq("id", input.releaseId)
    .maybeSingle();
  if (error) throw error;
  if (!release) throw new Error("Release not found.");
  await assertSectionAllowed(db, input.permissions, release.section_id, release.class_session_id);

  const currentState = String(release.state || "");
  const allowed = allowedTransitions[currentState] || [];
  if (!allowed.includes(input.nextState)) {
    throw new Error(`Transition from ${currentState} to ${input.nextState} is not allowed.`);
  }
  if (currentState === "closed" && !input.reason) {
    throw new Error("A reason is required when reopening a closed release.");
  }

  const { data: updated, error: updateError } = await db
    .from("content_releases")
    .update({
      state: input.nextState,
      updated_by: input.actorProfileId,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.releaseId)
    .select("id, content_item_id, section_id, class_session_id, state, opens_at, closes_at, review_opens_at, review_closes_at, updated_at")
    .single();
  if (updateError) throw updateError;

  const { error: eventError } = await db
    .from("release_events")
    .insert({
      content_release_id: input.releaseId,
      actor_profile_id: input.actorProfileId,
      event_type: currentState === "closed" ? "reopened" : "state_changed",
      old_state: currentState,
      new_state: input.nextState,
      reason: input.reason || null
    });
  if (eventError) throw eventError;

  return updated;
}

function assertInstructorOnly(permissions: { isCourseInstructor: boolean }) {
  if (!permissions.isCourseInstructor) {
    throw new Error("Teaching assistants cannot change release states; this action is not allowed.");
  }
}

async function assertSectionAllowed(db: ReturnType<typeof adminClient>, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}, sectionId: string | null, classSessionId: string | null) {
  if (permissions.isCourseInstructor) return;
  if (sectionId && permissions.permittedSectionIds.includes(String(sectionId))) return;
  if (classSessionId) {
    const { data, error } = await db
      .from("class_sessions")
      .select("section_id")
      .eq("id", classSessionId)
      .maybeSingle();
    if (error) throw error;
    if (data?.section_id && permissions.permittedSectionIds.includes(String(data.section_id))) return;
  }
  throw new Error("You are not allowed to manage releases for this section.");
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
