import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

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
    const profile = await loadProfileForToken(db, token);
    const sections = await loadStudentSections(db, courseId, String(profile.id));
    if (!sections.length) throw new Error("Student is not enrolled in this course.");

    if (body.action === "submit_entry") {
      const entry = await submitEntry(db, courseId, String(profile.id), sections, body);
      const catalog = await loadCatalog(db, courseId);
      const entries = await loadEntries(db, courseId, String(profile.id), sections.map((section) => String(section.id)));
      return json({ entry, entries, ...catalog });
    }

    const catalog = await loadCatalog(db, courseId);
    const entries = await loadEntries(db, courseId, String(profile.id), sections.map((section) => String(section.id)));
    if (body.action === "export_entries") {
      return json(buildPortfolioExport(courseId, profile, sections, entries, catalog));
    }

    return json({
      entries,
      sections,
      ...catalog,
      actions: ["list_entries", "submit_entry", "export_entries"]
    });
  } catch (error) {
    const message = error.message || "Unable to manage portfolio entries.";
    if (message.includes("not enrolled")) return json({ error: message }, { status: 403 });
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

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Active student profile is not linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadStudentSections(db: Db, courseId: string, profileId: string) {
  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("section_id, role, status")
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  const sectionIds = unique((enrollments || []).map((enrollment) => enrollment.section_id));
  if (!sectionIds.length) return [];

  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id, section_code, section_name")
    .eq("course_id", courseId)
    .in("id", sectionIds);
  if (sectionError) throw sectionError;
  return sections || [];
}

async function loadCatalog(db: Db, courseId: string) {
  const [{ data: categories, error: categoryError }, { data: contentItems, error: contentError }] = await Promise.all([
    db
      .from("gradebook_categories")
      .select("id, name, weight_percent, status")
      .eq("course_id", courseId)
      .order("name", { ascending: true }),
    db
      .from("content_items")
      .select("id, content_type, slug, title, source_ref")
      .eq("course_id", courseId)
      .in("content_type", ["lecture", "mission", "activity", "case_file", "portfolio", "resource"])
      .order("created_at", { ascending: true })
  ]);
  if (categoryError) throw categoryError;
  if (contentError) throw contentError;
  return {
    categories: categories || [],
    content_items: contentItems || []
  };
}

async function submitEntry(db: Db, courseId: string, profileId: string, sections: Record<string, unknown>[], body: Record<string, unknown>) {
  const sectionId = cleanOptionalUuid(body.section_id) || String(sections[0].id);
  if (!sections.some((section) => String(section.id) === sectionId)) {
    throw new Error("Student is not enrolled in this section.");
  }

  const gradebookCategoryId = cleanOptionalUuid(body.gradebook_category_id);
  if (gradebookCategoryId) await assertCategory(db, courseId, gradebookCategoryId);
  const contentItemId = cleanOptionalUuid(body.content_item_id);
  if (contentItemId) await assertContentItem(db, courseId, contentItemId);

  const entryType = cleanEntryType(body.entry_type);
  const entryJson = cleanEntryJson(body.entry_json || {});
  const visibility = cleanVisibility(body.visibility);

  const { data, error } = await db
    .from("portfolio_entries")
    .insert({
      course_id: courseId,
      section_id: sectionId,
      profile_id: profileId,
      content_item_id: contentItemId || null,
      gradebook_category_id: gradebookCategoryId || null,
      entry_type: entryType,
      entry_json: entryJson,
      visibility
    })
    .select("id, course_id, section_id, profile_id, content_item_id, gradebook_category_id, entry_type, entry_json, visibility, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

async function loadEntries(db: Db, courseId: string, profileId: string, sectionIds: string[]) {
  const { data, error } = await db
    .from("portfolio_entries")
    .select("id, course_id, section_id, content_item_id, gradebook_category_id, entry_type, entry_json, visibility, created_at, updated_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

function buildPortfolioExport(
  courseId: string,
  profile: Record<string, unknown>,
  sections: Record<string, unknown>[],
  entries: Record<string, unknown>[],
  catalog: { categories: Record<string, unknown>[]; content_items: Record<string, unknown>[] }
) {
  const exportedAt = new Date().toISOString();
  const studentIdentifier = String(profile.student_identifier || "student").trim();
  const safeIdentifier = studentIdentifier.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "student";
  const dateLabel = exportedAt.slice(0, 10);
  return {
    export_type: "tc2007b_student_portfolio",
    course_id: courseId,
    exported_at: exportedAt,
    filename: `tc2007b-portfolio-export-${safeIdentifier}-${dateLabel}.json`,
    student: {
      profile_id: profile.id,
      institutional_email: profile.institutional_email,
      student_identifier: profile.student_identifier,
      full_name: profile.full_name
    },
    sections,
    entries,
    categories: catalog.categories,
    content_items: catalog.content_items
  };
}

async function assertCategory(db: Db, courseId: string, categoryId: string) {
  const { data, error } = await db
    .from("gradebook_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Gradebook category is not part of this course.");
}

async function assertContentItem(db: Db, courseId: string, contentItemId: string) {
  const { data, error } = await db
    .from("content_items")
    .select("id")
    .eq("id", contentItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Content item is not part of this course.");
}

function cleanEntryType(value: unknown) {
  const allowed = ["mission_evidence", "case_file", "reflection", "project_artifact", "review_plan", "other"];
  const text = String(value || "other").trim();
  if (!allowed.includes(text)) throw new Error("A valid portfolio entry type is required.");
  return text;
}

function cleanEntryJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Portfolio entry data must be an object.");
  }
  const encoded = JSON.stringify(value);
  if (encoded.length > 20000) throw new Error("Portfolio entry is too large.");
  return value;
}

function cleanVisibility(value: unknown) {
  const allowed = ["private", "student_teacher", "section_showcase"];
  const text = String(value || "student_teacher").trim();
  if (!allowed.includes(text)) throw new Error("A valid visibility is required.");
  return text;
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
