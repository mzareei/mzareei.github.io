import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

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
    const { profile, permissions } = await requireInstructor(db, token, courseId);

    if (body.action === "save_section") {
      const section = await saveSection(db, courseId, {
        sectionId: cleanOptionalUuid(body.section_id),
        sectionCode: cleanSectionCode(body.section_code),
        sectionName: cleanSectionName(body.section_name),
        meetingPattern: cleanMeetingPattern(body.meeting_pattern),
        campus: cleanCampus(body.campus),
        status: cleanSectionStatus(body.status),
        actorProfileId: profile.id,
        permissions
      });
      const sections = await listSections(db, courseId, permissions);
      return json({ section, sections });
    }

    const sections = await listSections(db, courseId, permissions);
    return json({
      sections,
      actions: ["list_sections", "save_section"]
    });
  } catch (error) {
    const message = error.message || "Unable to manage course sections.";
    // A stable code the client can localize, rather than a prose message it has
    // to string-match (pitfall #41). Group lifecycle is platform-owner only.
    // The SPA's callFn reads `error_code`, not `code`. Naming it anything else
    // compiles, ships, and silently renders the raw string (pitfall #3, #12).
    if (message === "section_management_owner_only") {
      return json(
        { error: message, error_code: "section_management_owner_only" },
        { status: 403 }
      );
    }
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

function cleanOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid section id is required.");
  }
  return text;
}

function cleanSectionCode(value: unknown) {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  if (!text) throw new Error("A section code is required.");
  return text;
}

function cleanSectionName(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!text) throw new Error("A section name is required.");
  return text;
}

function cleanMeetingPattern(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160) || null;
}

function cleanCampus(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120) || null;
}

function cleanSectionStatus(value: unknown) {
  const allowed = ["planned", "active", "completed", "archived"];
  const text = String(value || "active").trim().toLowerCase();
  if (!allowed.includes(text)) throw new Error("A valid section status is required.");
  return text;
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
    .eq("status", "active")
    .in("role", instructorRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to manage sections for this course.");

  const isGlobalOwner = (memberships || []).some((membership) => String(membership.role) === "platform_owner");
  const permittedSectionIds = isGlobalOwner
    ? []
    : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isGlobalOwner && !permittedSectionIds.length) {
    throw new Error("You are not allowed to manage sections for this course.");
  }
  return { profile, user: userData.user, permissions: { isGlobalOwner, permittedSectionIds } };
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

async function listSections(db: Db, courseId: string, permissions: { isGlobalOwner: boolean; permittedSectionIds: string[] }) {
  let query = db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, meeting_pattern, campus, status, created_at, updated_at")
    .eq("course_id", courseId)
    .order("section_code", { ascending: true });
  if (!permissions.isGlobalOwner) query = query.in("id", permissions.permittedSectionIds);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function saveSection(db: Db, courseId: string, input: {
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  meetingPattern: string | null;
  campus: string | null;
  status: string;
  actorProfileId: string;
  permissions: { isGlobalOwner: boolean; permittedSectionIds: string[] };
}) {
  const updatedAt = new Date().toISOString();
  let before: Record<string, unknown> | null = null;
  let section;

  if (input.sectionId) {
    const { data: existing, error: existingError } = await db
      .from("course_sections")
      .select("id, course_id, section_code, section_name, meeting_pattern, campus, status")
      .eq("id", input.sectionId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("Section is not part of this course.");
    // Requirement 8: renaming, archiving or otherwise modifying a group is
    // platform-owner only. Teaching a group is not the same as owning its
    // lifecycle — an assigned instructor could previously rename it or set its
    // status to archived. This runs before the update, so a crafted request
    // never reaches course_sections.
    if (!input.permissions.isGlobalOwner) {
      throw new Error("section_management_owner_only");
    }
    before = existing;

    const { data, error } = await db
      .from("course_sections")
      .update({
        section_code: input.sectionCode,
        section_name: input.sectionName,
        meeting_pattern: input.meetingPattern,
        campus: input.campus,
        status: input.status,
        updated_at: updatedAt
      })
      .eq("id", input.sectionId)
      .eq("course_id", courseId)
      .select("id, course_id, section_code, section_name, meeting_pattern, campus, status, created_at, updated_at")
      .single();
    if (error) throw error;
    section = data;
  } else {
    if (!input.permissions.isGlobalOwner) {
      throw new Error("section_management_owner_only");
    }
    const { data, error } = await db
      .from("course_sections")
      .insert({
        course_id: courseId,
        section_code: input.sectionCode,
        section_name: input.sectionName,
        meeting_pattern: input.meetingPattern,
        campus: input.campus,
        status: input.status,
        updated_at: updatedAt
      })
      .select("id, course_id, section_code, section_name, meeting_pattern, campus, status, created_at, updated_at")
      .single();
    if (error) throw error;
    section = data;
  }

  await insertAudit(db, {
    courseId,
    actorProfileId: input.actorProfileId,
    targetType: "course_section",
    targetId: section.id,
    action: "section_saved",
    metadata: {
      before,
      section_code: section.section_code,
      section_name: section.section_name,
      meeting_pattern: section.meeting_pattern,
      campus: section.campus,
      status: section.status
    }
  });

  return section;
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
