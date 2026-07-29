import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const contentTypes = ["lecture", "mission", "quiz_bank", "activity", "exit_ticket", "portfolio", "resource", "case_file"];
// 'storage_object' was added to the content_items check constraint by migration
// 0012, when the decks moved into the private bucket — but never added here, so
// save_content_item rejected every real lecture in the course with "A valid
// source kind is required." Nothing noticed until the v2 app started calling
// this function in 2026-07. Keep this list and the constraint in step.
const sourceKinds = ["static_path", "supabase_record", "external_url", "storage_object"];

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
    const { profile } = await requireInstructor(db, token, courseId);

    if (body.action === "save_content_item") {
      const result = await saveContentItem(db, courseId, {
        itemId: cleanOptionalUuid(body.content_item?.id || body.content_item_id),
        content_type: cleanContentType(body.content_item?.content_type),
        slug: cleanSlug(body.content_item?.slug),
        title: cleanTitle(body.content_item?.title),
        summary: cleanSummary(body.content_item?.summary),
        source_kind: cleanSourceKind(body.content_item?.source_kind),
        source_ref: cleanSourceRef(body.content_item?.source_ref, body.content_item?.source_kind),
        contains_sensitive_content: Boolean(body.content_item?.contains_sensitive_content),
        default_points: cleanPoints(body.content_item?.default_points),
        create_draft_release: Boolean(body.release?.create_draft_release),
        draft_section_id: cleanOptionalUuid(body.release?.section_id),
        draft_session_id: cleanOptionalUuid(body.release?.class_session_id),
        allowed_attempts: cleanAllowedAttempts(body.release?.allowed_attempts),
        actorProfileId: String(profile.id)
      });
      const library = await listContentLibrary(db, courseId);
      return json({ ...result, ...library });
    }

    const library = await listContentLibrary(db, courseId);
    return json({
      ...library,
      actions: ["list_content_items", "save_content_item", "create_draft_release"]
    });
  } catch (error) {
    const message = error.message || "Unable to manage content library.";
    if (message.includes("not allowed") || message.includes("teaching_assistant")) {
      return json({ error: message }, { status: 403 });
    }
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

function cleanOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid id is required.");
  }
  return text;
}

function cleanContentType(value: unknown) {
  const text = String(value || "resource").trim().toLowerCase();
  if (!contentTypes.includes(text)) throw new Error("A valid content type is required.");
  return text;
}

function cleanSlug(value: unknown) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  if (!text) throw new Error("A content slug is required.");
  return text;
}

function cleanTitle(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 180);
  if (!text) throw new Error("A content title is required.");
  return text;
}

function cleanSummary(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 1000);
  return text || null;
}

function cleanSourceKind(value: unknown) {
  const text = String(value || "static_path").trim().toLowerCase();
  if (!sourceKinds.includes(text)) throw new Error("A valid source kind is required.");
  return text;
}

function cleanSourceRef(value: unknown, sourceKindValue: unknown) {
  const source_kind = cleanSourceKind(sourceKindValue);
  const text = String(value || "").trim().slice(0, 500);
  if (!text) throw new Error("A source reference is required.");
  if (source_kind === "external_url" && !/^https:\/\/\S+$/i.test(text)) {
    throw new Error("External content must use an https URL.");
  }
  return text;
}

function cleanPoints(value: unknown) {
  const points = Number(value || 0);
  if (!Number.isFinite(points) || points < 0) throw new Error("Default points must be zero or greater.");
  return Math.round(points * 100) / 100;
}

function cleanAllowedAttempts(value: unknown) {
  const attempts = Number(value || 1);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) {
    throw new Error("Allowed attempts must be between 1 and 20.");
  }
  return attempts;
}

async function requireInstructor(db: Db, token: string, courseId: string) {
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
    .eq("status", "active");
  if (membershipError) throw membershipError;

  const roles = (memberships || []).map((membership) => String(membership.role));
  if (roles.includes("teaching_assistant") && !roles.some((role) => instructorRoles.includes(role))) {
    throw new Error("teaching_assistant users cannot author content items.");
  }
  if (!roles.some((role) => instructorRoles.includes(role))) {
    throw new Error("You are not allowed to manage content for this course.");
  }

  return { profile, user: userData.user };
}

async function listContentLibrary(db: Db, courseId: string) {
  const [
    { data: items, error: itemError },
    { data: sections, error: sectionError },
    { data: sessions, error: sessionError }
  ] = await Promise.all([
    db
      .from("content_items")
      .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, created_at, updated_at")
      .eq("course_id", courseId)
      .order("updated_at", { ascending: false }),
    db
      .from("course_sections")
      .select("id, course_id, section_code, section_name, status")
      .eq("course_id", courseId)
      .order("section_code", { ascending: true }),
    db
      .from("class_sessions")
      .select("id, course_id, section_id, title, planned_date, state")
      .eq("course_id", courseId)
      .order("planned_date", { ascending: true })
  ]);
  if (itemError) throw itemError;
  if (sectionError) throw sectionError;
  if (sessionError) throw sessionError;

  const itemIds = unique((items || []).map((item) => item.id));
  const { data: releases, error: releaseError } = itemIds.length
    ? await db
        .from("content_releases")
        .select("id, content_item_id, section_id, class_session_id, state, opens_at, closes_at, allowed_attempts, updated_at")
        .eq("course_id", courseId)
        .in("content_item_id", itemIds)
    : { data: [], error: null };
  if (releaseError) throw releaseError;

  const releaseCounts = new Map<string, { draft: number; active: number; total: number }>();
  (releases || []).forEach((release) => {
    const current = releaseCounts.get(release.content_item_id) || { draft: 0, active: 0, total: 0 };
    current.total += 1;
    if (release.state === "draft") current.draft += 1;
    if (["scheduled", "released", "live", "review_only"].includes(String(release.state))) current.active += 1;
    releaseCounts.set(release.content_item_id, current);
  });

  return {
    content_items: (items || []).map((item) => ({
      ...item,
      release_counts: releaseCounts.get(item.id) || { draft: 0, active: 0, total: 0 }
    })),
    sections: sections || [],
    sessions: sessions || []
  };
}

async function saveContentItem(db: Db, courseId: string, input: {
  itemId: string;
  content_type: string;
  slug: string;
  title: string;
  summary: string | null;
  source_kind: string;
  source_ref: string;
  contains_sensitive_content: boolean;
  default_points: number;
  create_draft_release: boolean;
  draft_section_id: string;
  draft_session_id: string;
  allowed_attempts: number;
  actorProfileId: string;
}) {
  const updatedAt = new Date().toISOString();
  let before: Record<string, unknown> | null = null;
  let item;

  if (input.itemId) {
    const { data: existing, error: existingError } = await db
      .from("content_items")
      .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points")
      .eq("id", input.itemId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("Content item is not part of this course.");
    before = existing;

    const { data, error } = await db
      .from("content_items")
      .update({
        content_type: input.content_type,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        source_kind: input.source_kind,
        source_ref: input.source_ref,
        contains_sensitive_content: input.contains_sensitive_content,
        default_points: input.default_points,
        updated_at: updatedAt
      })
      .eq("id", input.itemId)
      .eq("course_id", courseId)
      .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, created_at, updated_at")
      .single();
    if (error) throw error;
    item = data;
  } else {
    const { data, error } = await db
      .from("content_items")
      .insert({
        course_id: courseId,
        content_type: input.content_type,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        source_kind: input.source_kind,
        source_ref: input.source_ref,
        contains_sensitive_content: input.contains_sensitive_content,
        default_points: input.default_points,
        created_by: input.actorProfileId,
        updated_at: updatedAt
      })
      .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, created_at, updated_at")
      .single();
    if (error) throw error;
    item = data;
  }

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "content_item",
    targetId: item.id,
    action: "content_item_saved",
    metadata: {
      before,
      content_type: item.content_type,
      slug: item.slug,
      title: item.title,
      source_kind: item.source_kind,
      source_ref: item.source_ref,
      contains_sensitive_content: item.contains_sensitive_content,
      default_points: item.default_points
    }
  });

  let draft_release = null;
  if (input.create_draft_release) {
    draft_release = await createDraftRelease(db, courseId, item.id, input);
  }

  return { content_item: item, draft_release };
}

async function createDraftRelease(db: Db, courseId: string, contentItemId: string, input: {
  draft_section_id: string;
  draft_session_id: string;
  allowed_attempts: number;
  actorProfileId: string;
}) {
  const scope = await validateDraftScope(db, courseId, input.draft_section_id, input.draft_session_id);
  const existing = await findExistingDraftRelease(db, courseId, contentItemId, scope.section_id, scope.class_session_id);
  const updatedAt = new Date().toISOString();
  let release;

  if (existing) {
    const { data, error } = await db
      .from("content_releases")
      .update({
        state: "draft",
        section_id: scope.section_id || null,
        class_session_id: scope.class_session_id || null,
        allowed_attempts: input.allowed_attempts,
        updated_by: input.actorProfileId,
        updated_at: updatedAt
      })
      .eq("id", existing.id)
      .select("id, content_item_id, course_id, section_id, class_session_id, state, allowed_attempts, created_at, updated_at")
      .single();
    if (error) throw error;
    release = data;
  } else {
    const { data, error } = await db
      .from("content_releases")
      .insert({
        content_item_id: contentItemId,
        course_id: courseId,
        section_id: scope.section_id || null,
        class_session_id: scope.class_session_id || null,
        state: "draft",
        allowed_attempts: input.allowed_attempts,
        created_by: input.actorProfileId,
        updated_by: input.actorProfileId,
        updated_at: updatedAt
      })
      .select("id, content_item_id, course_id, section_id, class_session_id, state, allowed_attempts, created_at, updated_at")
      .single();
    if (error) throw error;
    release = data;
  }

  const { error: eventError } = await db
    .from("release_events")
    .insert({
      content_release_id: release.id,
      actor_profile_id: input.actorProfileId,
      event_type: existing ? "scope_changed" : "created",
      old_state: existing ? "draft" : null,
      new_state: "draft",
      reason: "draft_release_created"
    });
  if (eventError) throw eventError;

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "content_release",
    targetId: release.id,
    action: "draft_release_created",
    metadata: {
      content_item_id: contentItemId,
      section_id: release.section_id,
      class_session_id: release.class_session_id,
      allowed_attempts: release.allowed_attempts,
      reused_existing_draft: Boolean(existing)
    }
  });

  return release;
}

async function validateDraftScope(db: Db, courseId: string, sectionId: string, sessionId: string) {
  let cleanSectionId = sectionId || "";
  let cleanSessionId = sessionId || "";

  if (cleanSessionId) {
    const { data: session, error: sessionError } = await db
      .from("class_sessions")
      .select("id, course_id, section_id")
      .eq("id", cleanSessionId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new Error("Class session is not part of this course.");
    cleanSectionId = cleanSectionId || String(session.section_id || "");
    if (cleanSectionId && cleanSectionId !== String(session.section_id)) {
      throw new Error("Draft release section must match the selected class session.");
    }
  }

  if (cleanSectionId) {
    const { data: section, error: sectionError } = await db
      .from("course_sections")
      .select("id")
      .eq("id", cleanSectionId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (sectionError) throw sectionError;
    if (!section) throw new Error("Section is not part of this course.");
  }

  return {
    section_id: cleanSectionId,
    class_session_id: cleanSessionId
  };
}

async function findExistingDraftRelease(db: Db, courseId: string, contentItemId: string, sectionId: string, sessionId: string) {
  let query = db
    .from("content_releases")
    .select("id")
    .eq("course_id", courseId)
    .eq("content_item_id", contentItemId)
    .eq("state", "draft");

  query = sectionId ? query.eq("section_id", sectionId) : query.is("section_id", null);
  query = sessionId ? query.eq("class_session_id", sessionId) : query.is("class_session_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function insertAudit(db: Db, input: {
  courseId: string;
  actorProfileId: string;
  targetType: string;
  targetId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await db
    .from("audit_log")
    .insert({
      course_id: input.courseId,
      actor_profile_id: input.actorProfileId,
      target_type: input.targetType,
      target_id: input.targetId,
      action: input.action,
      metadata: input.metadata
    });
  if (error) throw error;
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
