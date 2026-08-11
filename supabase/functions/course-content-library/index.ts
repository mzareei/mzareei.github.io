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
    const { profile, permissions } = await requireInstructor(db, token, courseId);

    if (body.action === "share_content_item") {
      const result = await shareContentItem(db, courseId, {
        sourceItemId: cleanOptionalUuid(body.content_item_id),
        targetSectionId: cleanOptionalUuid(body.section_id),
        canRelease: body.can_release === false ? false : true,
        canCopy: body.can_copy === false ? false : true,
        actorProfileId: String(profile.id),
        permissions
      });
      const library = await listContentLibrary(db, courseId, permissions);
      return json({ ...result, ...library });
    }

    if (body.action === "unshare_content_item") {
      const result = await unshareContentItem(db, courseId, {
        sourceItemId: cleanOptionalUuid(body.content_item_id),
        targetSectionId: cleanOptionalUuid(body.section_id),
        actorProfileId: String(profile.id),
        permissions
      });
      const library = await listContentLibrary(db, courseId, permissions);
      return json({ ...result, ...library });
    }

    if (body.action === "copy_content_item") {
      const result = await copyContentItem(db, courseId, {
        sourceItemId: cleanOptionalUuid(body.content_item_id),
        actorProfileId: String(profile.id),
        permissions
      });
      const library = await listContentLibrary(db, courseId, permissions);
      return json({ ...result, ...library });
    }

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
        actorProfileId: String(profile.id),
        permissions
      });
      const library = await listContentLibrary(db, courseId, permissions);
      return json({ ...result, ...library });
    }

    if (body.action === "delete_content_item") {
      const itemId = cleanOptionalUuid(body.content_item_id);
      if (!itemId) throw new Error("content_item_id_required");
      const result = await deleteContentItem(db, courseId, {
        itemId,
        actorProfileId: String(profile.id),
        force: Boolean(body.force),
        permissions
      });
      return json(result);
    }

    const library = await listContentLibrary(db, courseId, permissions);
    return json({
      ...library,
      actions: ["list_content_items", "save_content_item", "delete_content_item", "copy_content_item", "share_content_item", "unshare_content_item", "create_draft_release"]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to manage content library.";
    // Stable code, returned as error_code because that is the field the SPA's
    // callFn reads. Naming it `code` compiles and renders the raw string.
    if (
      message === "content_item_not_owned"
      || message === "content_item_not_visible"
      || message === "content_share_target_invalid"
      || message === "content_item_not_found"
      || message === "content_item_has_active_release"
      || message === "content_item_has_active_bank"
      || message === "content_item_has_activity_history"
      || message === "content_item_id_required"
    ) {
      const status = message === "content_item_not_found"
        ? 404
        : message === "content_item_has_active_release" || message === "content_item_has_active_bank" || message === "content_item_has_activity_history"
          ? 409
          : message === "content_share_target_invalid" || message === "content_item_id_required"
            ? 400
            : 403;
      return json({ error: message, error_code: message }, { status });
    }
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

  const isGlobalOwner = roles.includes("platform_owner");
  const permittedSectionIds = isGlobalOwner ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isGlobalOwner && !permittedSectionIds.length) throw new Error("You are not allowed to manage content for this course.");
  return {
    profile,
    user: userData.user,
    permissions: { isGlobalOwner, permittedSectionIds, profileId: String(profile.id) }
  };
}

// Requirement 7. Content is private to its owner; a share makes it visible to
// another group's instructors but never writable — they take a copy instead.
//
// The null-owner case is load-bearing and is NOT a defensive fallback. Every
// item that existed before the ownership migration has owner_profile_id null,
// because register_item never set created_by either. Until the backfill runs,
// unowned content must behave exactly as it did before: visible and editable
// by any course instructor. Hiding it instead would empty the professor's own
// Content screen the moment this deploys.
type ContentPermissions = {
  isGlobalOwner: boolean;
  permittedSectionIds: string[];
  profileId: string;
};

/** May this caller write to this item? Owner, platform owner, or unowned.
 *  Deliberately has no `shared` branch: a share grants visibility and release,
 *  never edit. A receiving instructor copies the item and owns the copy. */
function canEditContentItem(
  item: { owner_profile_id?: string | null },
  permissions: ContentPermissions
) {
  if (permissions.isGlobalOwner) return true;
  // Unowned legacy content — see the note above. Remove this branch only once
  // the backfill has run and every row has an owner.
  if (item.owner_profile_id == null) return true;
  return String(item.owner_profile_id) === String(permissions.profileId);
}

/** May this caller see this item? Everything they can edit, plus shares. */
function isVisibleContentItem(
  item: { owner_profile_id?: string | null; id: unknown },
  permissions: ContentPermissions,
  sharedItemIds: Set<string>
) {
  if (canEditContentItem(item, permissions)) return true;
  return sharedItemIds.has(String(item.id));
}

async function loadSharedContentItemIds(db: Db, permissions: ContentPermissions): Promise<Set<string>> {
  if (permissions.isGlobalOwner || !permissions.permittedSectionIds.length) return new Set<string>();
  const { data, error } = await db
    .from("content_shares")
    .select("content_item_id")
    .in("section_id", permissions.permittedSectionIds);
  if (error) throw error;
  const ids: string[] = (data || []).map((row: { content_item_id: unknown }) => String(row.content_item_id));
  return new Set(ids);
}

async function loadPermittedSectionIds(db: Db, profileId: string, courseId: string): Promise<string[]> {
  const { data, error } = await db
    .from("section_enrollments")
    .select("section_id, course_sections!inner(course_id)")
    .eq("profile_id", profileId)
    .eq("role", "instructor")
    .eq("status", "active")
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  const ids: string[] = (data || []).map((row: { section_id: unknown }) => String(row.section_id));
  return Array.from(new Set(ids));
}

async function listContentLibrary(db: Db, courseId: string, permissions: ContentPermissions) {
  const [
    { data: items, error: itemError },
    { data: sections, error: sectionError },
    { data: sessions, error: sessionError },
    { data: allShares, error: shareError }
  ] = await Promise.all([
    db
      .from("content_items")
      .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, owner_profile_id, visibility, forked_from_content_item_id, created_at, updated_at")
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
      .order("planned_date", { ascending: true }),
    // Every share in the course, joined for display. Small table, and the
    // owner-only filter happens below when attaching shares to items — this
    // one query avoids an N+1 per owned item.
    db
      .from("content_shares")
      .select("content_item_id, section_id, can_release, can_copy, course_sections!inner(course_id, section_code, section_name)")
      .eq("course_sections.course_id", courseId)
  ]);
  if (itemError) throw itemError;
  if (sectionError) throw sectionError;
  if (sessionError) throw sessionError;
  if (shareError) throw shareError;

  // Scope the library to what this caller owns, plus anything shared with a
  // group they teach. Before this, every instructor saw — and could overwrite —
  // every item in the course.
  const sharedItemIds = await loadSharedContentItemIds(db, permissions);
  const visibleItems = (items || []).filter((item) => isVisibleContentItem(item, permissions, sharedItemIds));

  const itemIds = unique(visibleItems.map((item) => item.id));
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

  const visibleSections = permissions.isGlobalOwner ? (sections || []) : (sections || []).filter((section) => permissions.permittedSectionIds.includes(String(section.id)));
  const visibleSectionIds = new Set(visibleSections.map((section) => String(section.id)));
  const visibleSessions = permissions.isGlobalOwner ? (sessions || []) : (sessions || []).filter((session) => visibleSectionIds.has(String(session.section_id)));
  const visibleReleases = permissions.isGlobalOwner ? (releases || []) : (releases || []).filter((release) => !release.section_id || visibleSectionIds.has(String(release.section_id)));

  // Sharing needs its own section list, deliberately wider than `sections`
  // above. course-section-management hides a group you do not teach
  // (pitfall #38, correctly, so you cannot see its roster or sessions) — but
  // sharing means naming a group you do NOT teach, to reach the instructor who
  // does. This exposes only id, code and name: no roster, no sessions, no
  // release data. Archived/completed groups are excluded — nothing is served
  // by sharing into a group that can no longer receive students.
  const shareableSections = (sections || [])
    .filter((section) => ["planned", "active"].includes(String(section.status)))
    .map((section) => ({
      id: section.id,
      section_code: section.section_code,
      section_name: section.section_name
    }));

  const sharesByItem = new Map<string, Array<{ section_id: string; section_code: string; section_name: string; can_release: boolean; can_copy: boolean }>>();
  for (const share of allShares || []) {
    const key = String(share.content_item_id);
    const list = sharesByItem.get(key) || [];
    const section = (share as { course_sections?: { section_code?: string; section_name?: string } }).course_sections;
    list.push({
      section_id: String(share.section_id),
      section_code: section?.section_code || "",
      section_name: section?.section_name || "",
      can_release: Boolean(share.can_release),
      can_copy: Boolean(share.can_copy)
    });
    sharesByItem.set(key, list);
  }

  return {
    content_items: visibleItems.map((item) => {
      const canEdit = canEditContentItem(item, permissions);
      return {
        ...item,
        // The screen needs to render a shared item read-only with a Copy
        // action rather than an Edit control that would 403. Same fact, one
        // source.
        can_edit: canEdit,
        is_shared_with_me: !canEdit,
        // Only the owner needs to know who else can see this. A recipient
        // cannot re-share and gains nothing from the list.
        shares: canEdit ? (sharesByItem.get(String(item.id)) || []) : [],
        release_counts: permissions.isGlobalOwner
          ? releaseCounts.get(item.id) || { draft: 0, active: 0, total: 0 }
          : countReleaseStates(visibleReleases.filter((release) => release.content_item_id === item.id))
      };
    }),
    sections: visibleSections,
    shareable_sections: shareableSections,
    sessions: visibleSessions
  };
}

function countReleaseStates(releases: Array<{ state?: string }>) {
  return releases.reduce((counts, release) => {
    counts.total += 1;
    if (release.state === "draft") counts.draft += 1;
    if (["scheduled", "released", "live", "review_only"].includes(String(release.state))) counts.active += 1;
    return counts;
  }, { draft: 0, active: 0, total: 0 });
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
  permissions: ContentPermissions;
}) {
  const updatedAt = new Date().toISOString();
  let before: Record<string, unknown> | null = null;
  let item;

  if (input.itemId) {
    const { data: existing, error: existingError } = await db
      .from("content_items")
      .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, owner_profile_id")
      .eq("id", input.itemId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("Content item is not part of this course.");
    // Requirement 7: only the owner (or the platform owner) may write. A share
    // never grants edit — the receiving instructor takes a copy. This runs
    // before the update, so a crafted request never reaches content_items.
    if (!canEditContentItem(existing, input.permissions)) {
      throw new Error("content_item_not_owned");
    }
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
        owner_profile_id: input.actorProfileId,
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

async function deleteContentItem(db: Db, courseId: string, input: {
  itemId: string;
  actorProfileId: string;
  force: boolean;
  permissions: ContentPermissions;
}) {
  const { data: existing, error } = await db
    .from("content_items")
    .select("id, course_id, title, content_type, slug, owner_profile_id")
    .eq("id", input.itemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new Error("content_item_not_found");
  if (!canEditContentItem(existing, input.permissions)) {
    throw new Error("content_item_not_owned");
  }

  const { count: blockingReleaseCount, error: releaseError } = await db
    .from("content_releases")
    .select("id", { count: "exact", head: true })
    .eq("content_item_id", existing.id)
    .in("state", ["scheduled", "released", "live", "paused", "review_only"]);
  if (releaseError) throw releaseError;
  if ((blockingReleaseCount || 0) > 0) {
    throw new Error("content_item_has_active_release");
  }

  // course-class-quiz's ensureTemplateAndItem creates/reuses an
  // activity_templates row for this content item every time an end-of-class
  // quiz runs against it — the live, primary end-of-class quiz path, not
  // dead schema. A lecture taught weeks ago with its release long since
  // closed can still have real graded activity_instances (and, beneath
  // them, student_attempts/student_responses) sitting behind it. All four
  // cascade ON DELETE CASCADE from content_items — none of this is a real
  // Postgres restrict, so force mode simply skips the check below and lets
  // the existing cascade run; nothing extra needs pre-deleting first (unlike
  // the bank force-delete path, which has a real restrict to clear).
  if (!input.force) {
    const { data: templates, error: templatesError } = await db
      .from("activity_templates")
      .select("id")
      .eq("content_item_id", existing.id);
    if (templatesError) throw templatesError;

    if ((templates || []).length) {
      const { count: instanceCount, error: instanceError } = await db
        .from("activity_instances")
        .select("id", { count: "exact", head: true })
        .in("activity_template_id", templates.map((template) => template.id));
      if (instanceError) throw instanceError;
      if ((instanceCount || 0) > 0) {
        throw new Error("content_item_has_activity_history");
      }
    }
  }

  const { error: deleteError } = await db
    .from("content_items")
    .delete()
    .eq("id", existing.id)
    .eq("course_id", courseId);
  if (deleteError) {
    // The guard_content_item_delete trigger (migration 0032) raises with
    // errcode 'restrict_violation' (SQLSTATE 23001) when an active question
    // bank still points at this item — a distinct code from the standard
    // foreign-key-violation 23503 used elsewhere in this codebase.
    if (String(deleteError.code) === "23001") {
      throw new Error("content_item_has_active_bank");
    }
    throw deleteError;
  }

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "content_item",
    targetId: existing.id,
    action: "content_item_deleted",
    metadata: { title: existing.title, content_type: existing.content_type, slug: existing.slug }
  });

  return { content_item_id: existing.id, deleted: true };
}

async function createDraftRelease(db: Db, courseId: string, contentItemId: string, input: {
  draft_section_id: string;
  draft_session_id: string;
  allowed_attempts: number;
  actorProfileId: string;
  permissions: { isGlobalOwner: boolean; permittedSectionIds: string[] };
}) {
  const scope = await validateDraftScope(db, courseId, input.draft_section_id, input.draft_session_id, input.permissions);
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

async function validateDraftScope(db: Db, courseId: string, sectionId: string, sessionId: string, permissions: { isGlobalOwner: boolean; permittedSectionIds: string[] }) {
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
    if (!permissions.isGlobalOwner && !permissions.permittedSectionIds.includes(String(cleanSectionId))) {
      throw new Error("You are not allowed to create releases for this section.");
    }
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


// ---------------------------------------------------------------- copying
// Sharing on this platform means "you may take a copy", not "you may edit
// mine" (decided 2026-08-05). The copy is a new content item owned by whoever
// made it, with its own storage object and its own question bank, and it
// records what it came from. The owner's later improvements deliberately do
// not propagate — nobody's copy changes under them, and nobody can write to
// the original.
//
// The bank travels with the deck because a lecture without its bank is not a
// usable teaching artifact here: no checkpoints during class, no end-of-class
// quiz. A copy that dropped it would look successful and be useless.
//
// Ordering: copy the storage object to a brand new path first, then insert the
// rows. Every write targets something that did not exist a moment ago, so a
// failure anywhere leaves the source untouched and at worst an orphan object
// behind. Nothing pre-existing is ever overwritten.
// ---------------------------------------------------------------- sharing
// The half of requirement 7 that consuming a share depends on, and that never
// existed: an owner granting one in the first place. canEditContentItem,
// isVisibleContentItem and copy_content_item all assumed a content_shares row
// could exist; nothing ever wrote one.
//
// Sharing requires edit rights on the source (the owner, or the platform
// owner) — never mere visibility. A recipient sees the item because someone
// shared it with their group; that is not a licence to reshare it further.
async function shareContentItem(db: Db, courseId: string, input: {
  sourceItemId: string;
  targetSectionId: string;
  canRelease: boolean;
  canCopy: boolean;
  actorProfileId: string;
  permissions: ContentPermissions;
}) {
  if (!input.sourceItemId) throw new Error("A content item id is required.");
  if (!input.targetSectionId) throw new Error("A group to share with is required.");

  const { data: source, error: sourceError } = await db
    .from("content_items")
    .select("id, owner_profile_id")
    .eq("id", input.sourceItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error("Content item is not part of this course.");
  if (!canEditContentItem(source, input.permissions)) {
    throw new Error("content_item_not_owned");
  }

  // The target must be a real, currently assignable group in this course.
  // Archived/completed groups mirror the rule already applied to student
  // assignment: nothing is served by sharing into a group that is done.
  const { data: target, error: targetError } = await db
    .from("course_sections")
    .select("id, status")
    .eq("id", input.targetSectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target || !["planned", "active"].includes(String(target.status))) {
    throw new Error("content_share_target_invalid");
  }

  // Idempotent: sharing again with the same group updates the existing grant
  // rather than creating a duplicate row or throwing on the unique
  // constraint.
  const { error: shareError } = await db
    .from("content_shares")
    .upsert(
      {
        content_item_id: source.id,
        section_id: target.id,
        can_release: input.canRelease,
        can_copy: input.canCopy,
        shared_by: input.actorProfileId
      },
      { onConflict: "content_item_id,section_id" }
    );
  if (shareError) throw shareError;

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "content_item",
    targetId: source.id,
    action: "content_item_shared",
    metadata: { section_id: target.id, can_release: input.canRelease, can_copy: input.canCopy }
  });

  return { shared: true };
}

async function unshareContentItem(db: Db, courseId: string, input: {
  sourceItemId: string;
  targetSectionId: string;
  actorProfileId: string;
  permissions: ContentPermissions;
}) {
  if (!input.sourceItemId) throw new Error("A content item id is required.");
  if (!input.targetSectionId) throw new Error("A group is required.");

  const { data: source, error: sourceError } = await db
    .from("content_items")
    .select("id, owner_profile_id")
    .eq("id", input.sourceItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error("Content item is not part of this course.");
  if (!canEditContentItem(source, input.permissions)) {
    throw new Error("content_item_not_owned");
  }

  const { error: deleteError } = await db
    .from("content_shares")
    .delete()
    .eq("content_item_id", source.id)
    .eq("section_id", input.targetSectionId);
  if (deleteError) throw deleteError;

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "content_item",
    targetId: source.id,
    action: "content_item_unshared",
    metadata: { section_id: input.targetSectionId }
  });

  return { shared: false };
}

async function copyContentItem(db: Db, courseId: string, input: {
  sourceItemId: string;
  actorProfileId: string;
  permissions: ContentPermissions;
}) {
  if (!input.sourceItemId) throw new Error("A content item id is required.");

  const { data: source, error: sourceError } = await db
    .from("content_items")
    .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, contains_sensitive_content, default_points, owner_profile_id")
    .eq("id", input.sourceItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error("Content item is not part of this course.");

  // Visibility, not edit rights. Requiring ownership here would make sharing
  // pointless — being able to copy is the entire privilege a share grants.
  const sharedItemIds = await loadSharedContentItemIds(db, input.permissions);
  if (!isVisibleContentItem(source, input.permissions, sharedItemIds)) {
    throw new Error("content_item_not_visible");
  }
  if (source.source_kind !== "storage_object") {
    throw new Error("Only stored lectures and missions can be copied.");
  }

  const slug = await availableSlug(db, courseId, String(source.slug));
  const sourcePath = String(source.source_ref);
  const filename = sourcePath.split("/").pop() || "deck.html";
  const targetPath = `courses/${courseId}/items/${slug}/${filename}`;

  // 1. The object, to a path nothing uses yet.
  const { data: blob, error: downloadError } = await db.storage.from("course-content").download(sourcePath);
  if (downloadError) throw downloadError;
  const { error: uploadError } = await db.storage
    .from("course-content")
    .upload(targetPath, blob, { contentType: "text/html; charset=utf-8", upsert: false });
  if (uploadError) throw uploadError;

  // 2. The item, owned by the copier and private to them. A copy does not
  //    inherit the source's sharing — that is the new owner's decision.
  const { data: copy, error: copyError } = await db
    .from("content_items")
    .insert({
      course_id: courseId,
      content_type: source.content_type,
      slug,
      title: source.title,
      summary: source.summary,
      source_kind: "storage_object",
      source_ref: targetPath,
      contains_sensitive_content: source.contains_sensitive_content,
      default_points: source.default_points,
      created_by: input.actorProfileId,
      owner_profile_id: input.actorProfileId,
      visibility: "owner_private",
      forked_from_content_item_id: source.id,
      updated_at: new Date().toISOString()
    })
    .select("id, course_id, content_type, slug, title, summary, source_kind, source_ref, default_points, owner_profile_id, forked_from_content_item_id, created_at, updated_at")
    .single();
  if (copyError) throw copyError;

  // 3. The bank, its questions and their options.
  const bankSummary = await copyQuestionBank(db, courseId, {
    sourceItemId: String(source.id),
    targetItemId: String(copy.id),
    actorProfileId: input.actorProfileId
  });

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "content_item",
    targetId: copy.id,
    action: "content_item_copied",
    metadata: {
      source_content_item_id: source.id,
      source_slug: source.slug,
      slug,
      storage_path: targetPath,
      ...bankSummary
    }
  });

  return { item: copy, copied_from: { id: source.id, slug: source.slug }, ...bankSummary };
}

/** A slug that is free in this course. Two instructors copying the same
 *  lecture must not land on one slug, and the copier should not have to
 *  invent a name to get past a collision. */
async function availableSlug(db: Db, courseId: string, baseSlug: string) {
  const { data, error } = await db
    .from("content_items")
    .select("slug")
    .eq("course_id", courseId)
    .like("slug", `${baseSlug}%`);
  if (error) throw error;
  const taken = new Set((data || []).map((row: { slug: unknown }) => String(row.slug)));
  let candidate = `${baseSlug}-copy`.slice(0, 160);
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${baseSlug}-copy-${suffix}`.slice(0, 160);
    suffix += 1;
  }
  return candidate;
}

async function copyQuestionBank(db: Db, courseId: string, input: {
  sourceItemId: string;
  targetItemId: string;
  actorProfileId: string;
}) {
  const { data: banks, error: bankError } = await db
    .from("question_banks")
    .select("id, title, bank_type, status, checkpoint_preparation_state")
    .eq("course_id", courseId)
    .eq("content_item_id", input.sourceItemId)
    .eq("status", "active");
  if (bankError) throw bankError;
  const bank = (banks || [])[0];
  if (!bank) return { questions_copied: 0, bank_copied: false };

  const { data: newBank, error: newBankError } = await db
    .from("question_banks")
    .insert({
      course_id: courseId,
      content_item_id: input.targetItemId,
      title: bank.title,
      bank_type: bank.bank_type,
      status: "active",
      checkpoint_preparation_state: bank.checkpoint_preparation_state,
      created_by: input.actorProfileId,
      updated_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (newBankError) throw newBankError;

  const { data: questions, error: questionError } = await db
    .from("questions")
    .select("id, prompt, prompt_es, question_type, difficulty, topic_tags, points, explanation, explanation_es, status, source, segment_key, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide, suggested_slide_hint, suggested_topic")
    .eq("question_bank_id", bank.id)
    .eq("status", "active");
  if (questionError) throw questionError;

  let copied = 0;
  for (const question of questions || []) {
    const { data: newQuestion, error: insertError } = await db
      .from("questions")
      .insert({
        question_bank_id: newBank.id,
        prompt: question.prompt,
        prompt_es: question.prompt_es,
        question_type: question.question_type,
        difficulty: question.difficulty,
        topic_tags: question.topic_tags,
        points: question.points,
        explanation: question.explanation,
        explanation_es: question.explanation_es,
        status: "active",
        source: question.source,
        // Checkpoint metadata is what makes the deck presentable. Dropping it
        // leaves checkpoint sections in the copied HTML referencing nothing.
        segment_key: question.segment_key,
        source_slide_numbers: question.source_slide_numbers,
        source_slide_start: question.source_slide_start,
        source_slide_end: question.source_slide_end,
        checkpoint_after_slide: question.checkpoint_after_slide,
        suggested_slide_hint: question.suggested_slide_hint,
        suggested_topic: question.suggested_topic,
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const { data: options, error: optionError } = await db
      .from("question_options")
      .select("option_text, option_text_es, is_correct, position, feedback, feedback_es")
      .eq("question_id", question.id)
      .order("position", { ascending: true });
    if (optionError) throw optionError;
    if ((options || []).length) {
      const { error: optionInsertError } = await db
        .from("question_options")
        .insert((options || []).map((option) => ({ ...option, question_id: newQuestion.id })));
      if (optionInsertError) throw optionInsertError;
    }
    copied += 1;
  }

  return { questions_copied: copied, bank_copied: true, question_bank_id: newBank.id };
}
