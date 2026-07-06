import { adminClient } from "../_shared/client.ts";
import { corsHeaders, handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

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
    const filters = cleanFilters(body);
    const db = adminClient();
    const permissions = await requireInstructor(db, token, courseId);
    const { profile } = permissions;

    if (body.action === "save_category") {
      assertInstructorOnly(permissions);
      const category = await saveGradebookCategory(db, courseId, {
        categoryId: cleanOptionalUuid(body.category_id),
        actorProfileId: profile.id,
        name: cleanCategoryName(body.name),
        weightPercent: cleanWeightPercent(body.weight_percent),
        dropLowestCount: cleanDropLowestCount(body.drop_lowest_count),
        status: cleanCategoryStatus(body.status)
      });
      const catalog = await loadCatalog(db, courseId, permissions);
      return json({
        category,
        categories: catalog.categories,
        items: catalog.items,
        sections: catalog.sections
      });
    }

    if (body.action === "adjust_score") {
      assertInstructorOnly(permissions);
      const score = await adjustScore(db, courseId, {
        scoreId: cleanRequiredUuid(body.score_id, "score id"),
        actorProfileId: profile.id,
        newScoreFinal: cleanScore(body.new_score_final),
        reason: cleanReason(body.reason)
      });
      return json({ score });
    }

    if (body.action === "lock_score") {
      assertInstructorOnly(permissions);
      const score = await lockScore(db, courseId, {
        scoreId: cleanRequiredUuid(body.score_id, "score id"),
        actorProfileId: profile.id,
        reason: cleanReason(body.reason)
      });
      return json({ score });
    }

    if (body.action === "set_score_status") {
      assertInstructorOnly(permissions);
      const score = await setScoreStatus(db, courseId, {
        gradebookItemId: cleanRequiredUuid(body.gradebook_item_id, "gradebook item id"),
        profileId: cleanRequiredUuid(body.profile_id, "profile id"),
        sectionId: cleanRequiredUuid(body.section_id, "section id"),
        status: cleanScoreStatus(body.score_status),
        scoreFinal: body.score_final,
        actorProfileId: profile.id,
        reason: cleanReason(body.reason)
      });
      return json({ score });
    }

    const catalog = await loadCatalog(db, courseId, permissions);
    const rows = await loadGradebookRows(db, courseId, filters, permissions);
    const weightedSummary = buildWeightedGradeSummary(rows);

    if (body.action === "export_csv") {
      return csvResponse(rows, `tc2007b-gradebook-${new Date().toISOString().slice(0, 10)}.csv`);
    }

    return json({
      categories: catalog.categories,
      items: catalog.items,
      sections: catalog.sections,
      scores: rows,
      weighted_summary: weightedSummary,
      filters,
      actions: permissions.isCourseInstructor ? ["summary", "export_csv", "save_category", "adjust_score", "lock_score", "set_score_status"] : ["summary", "export_csv"]
    });
  } catch (error) {
    const message = error.message || "Unable to load gradebook.";
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

function cleanFilters(body: Record<string, unknown>) {
  return {
    section_id: cleanOptionalUuid(body.section_id),
    category_id: cleanOptionalUuid(body.category_id),
    gradebook_item_id: cleanOptionalUuid(body.gradebook_item_id)
  };
}

function cleanOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid filter id is required.");
  }
  return text;
}

function cleanRequiredUuid(value: unknown, label: string) {
  const text = cleanOptionalUuid(value);
  if (!text) throw new Error(`A valid ${label} is required.`);
  return text;
}

function cleanScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("A final score between 0 and 100 is required.");
  }
  return Math.round(score * 10) / 10;
}

function cleanReason(value: unknown) {
  const reason = String(value || "").trim().slice(0, 1000);
  if (reason.length < 5) throw new Error("A reason of at least five characters is required.");
  return reason;
}

function cleanCategoryName(value: unknown) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!name) throw new Error("A category name is required.");
  return name;
}

function cleanWeightPercent(value: unknown) {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    throw new Error("A category weight between 0 and 100 is required.");
  }
  return Math.round(weight * 10) / 10;
}

function cleanDropLowestCount(value: unknown) {
  const count = Number(value || 0);
  if (!Number.isInteger(count) || count < 0 || count > 50) {
    throw new Error("Drop-lowest count must be a whole number from 0 to 50.");
  }
  return count;
}

function cleanCategoryStatus(value: unknown) {
  const allowed = ["draft", "active", "archived"];
  const status = String(value || "active").trim();
  if (!allowed.includes(status)) throw new Error("A valid category status is required.");
  return status;
}

function cleanScoreStatus(value: unknown) {
  const allowed = ["posted", "missing", "excused"];
  const status = String(value || "").trim();
  if (!allowed.includes(status)) throw new Error("A valid score status is required.");
  return status;
}

function cleanStatusScore(status: string, value: unknown) {
  if (status === "excused") return null;
  if (status === "missing" && (value === null || value === undefined || value === "")) return 0;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error("A final score between 0 and 100 is required for posted or missing records.");
  }
  return Math.round(score * 10) / 10;
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
    .in("role", teacherRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to review this gradebook.");

  const isCourseInstructor = (memberships || []).some((membership) => instructorRoles.includes(String(membership.role)));
  const permittedSectionIds = isCourseInstructor ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isCourseInstructor && !permittedSectionIds.length) {
    throw new Error("You are not allowed to review this gradebook.");
  }

  return { profile, user: userData.user, isCourseInstructor, permittedSectionIds };
}

async function loadPermittedSectionIds(db: Db, profileId: string, courseId: string) {
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

function assertInstructorOnly(permissions: { isCourseInstructor: boolean }) {
  if (permissions.isCourseInstructor) return;
  throw new Error("Teaching assistants cannot change final grades.");
}

async function saveGradebookCategory(db: Db, courseId: string, input: {
  categoryId: string;
  actorProfileId: string;
  name: string;
  weightPercent: number;
  dropLowestCount: number;
  status: string;
}) {
  const updatedAt = new Date().toISOString();
  const payload = {
    name: input.name,
    weight_percent: input.weightPercent,
    drop_lowest_count: input.dropLowestCount,
    status: input.status,
    updated_at: updatedAt
  };

  let previous: Record<string, unknown> | null = null;
  let category;
  if (input.categoryId) {
    const { data: existing, error: existingError } = await db
      .from("gradebook_categories")
      .select("id, course_id, name, weight_percent, drop_lowest_count, status")
      .eq("id", input.categoryId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("Gradebook category is not part of this course.");
    previous = existing;

    const { data, error } = await db
      .from("gradebook_categories")
      .update(payload)
      .eq("id", input.categoryId)
      .eq("course_id", courseId)
      .select("id, course_id, name, weight_percent, drop_lowest_count, status, updated_at")
      .single();
    if (error) throw error;
    category = data;
  } else {
    const { data, error } = await db
      .from("gradebook_categories")
      .insert({
        course_id: courseId,
        name: input.name,
        weight_percent: input.weightPercent,
        drop_lowest_count: input.dropLowestCount,
        status: input.status,
        updated_at: updatedAt
      })
      .select("id, course_id, name, weight_percent, drop_lowest_count, status, updated_at")
      .single();
    if (error) throw error;
    category = data;
  }

  await writeAuditLog(db, courseId, input.actorProfileId, "gradebook_category", category.id, "gradebook_category_saved", {
    previous,
    name: category.name,
    weight_percent: category.weight_percent,
    drop_lowest_count: category.drop_lowest_count,
    status: category.status
  });
  return category;
}

async function adjustScore(db: Db, courseId: string, input: {
  scoreId: string;
  actorProfileId: string;
  newScoreFinal: number;
  reason: string;
}) {
  const score = await loadScoreForCourse(db, courseId, input.scoreId);
  if (String(score.status) === "locked") {
    throw new Error("This score is locked and cannot be adjusted.");
  }

  const previousScoreFinal = score.score_final;
  const { error: adjustmentError } = await db
    .from("grade_adjustments")
    .insert({
      gradebook_score_id: input.scoreId,
      actor_profile_id: input.actorProfileId,
      previous_score_final: previousScoreFinal,
      new_score_final: input.newScoreFinal,
      reason: input.reason
    });
  if (adjustmentError) throw adjustmentError;

  const updatedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from("gradebook_scores")
    .update({
      score_final: input.newScoreFinal,
      status: "posted",
      updated_at: updatedAt
    })
    .eq("id", input.scoreId)
    .select("id, gradebook_item_id, profile_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
    .single();
  if (updateError) throw updateError;

  await writeGradebookAudit(db, courseId, input.actorProfileId, input.scoreId, "score_adjusted", {
    previous_score_final: previousScoreFinal,
    new_score_final: input.newScoreFinal,
    reason: input.reason
  });
  return updated;
}

async function lockScore(db: Db, courseId: string, input: {
  scoreId: string;
  actorProfileId: string;
  reason: string;
}) {
  const score = await loadScoreForCourse(db, courseId, input.scoreId);
  if (String(score.status) === "locked") {
    return score;
  }

  const lockedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from("gradebook_scores")
    .update({
      status: "locked",
      locked_at: lockedAt,
      updated_at: lockedAt
    })
    .eq("id", input.scoreId)
    .select("id, gradebook_item_id, profile_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
    .single();
  if (updateError) throw updateError;

  await writeGradebookAudit(db, courseId, input.actorProfileId, input.scoreId, "score_locked", {
    previous_status: score.status,
    reason: input.reason
  });
  return updated;
}

async function setScoreStatus(db: Db, courseId: string, input: {
  gradebookItemId: string;
  profileId: string;
  sectionId: string;
  status: string;
  scoreFinal: unknown;
  actorProfileId: string;
  reason: string;
}) {
  // The database enforces unique (gradebook_item_id, profile_id).
  await assertGradebookItemInCourse(db, courseId, input.gradebookItemId);
  await assertSectionInCourse(db, courseId, input.sectionId);
  await assertStudentInSection(db, input.profileId, input.sectionId);

  const scoreFinal = cleanStatusScore(input.status, input.scoreFinal);
  const { data: existing, error: existingError } = await db
    .from("gradebook_scores")
    .select("id, gradebook_item_id, profile_id, section_id, score_raw, score_percent, score_final, status, locked_at")
    .eq("gradebook_item_id", input.gradebookItemId)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.locked_at || existing?.status === "locked") {
    throw new Error("This score is locked and cannot be changed.");
  }

  const updatedAt = new Date().toISOString();
  const payload = {
    gradebook_item_id: input.gradebookItemId,
    profile_id: input.profileId,
    section_id: input.sectionId,
    score_raw: scoreFinal,
    score_percent: scoreFinal,
    score_final: scoreFinal,
    status: input.status,
    updated_at: updatedAt
  };

  let score;
  if (existing) {
    const { data, error } = await db
      .from("gradebook_scores")
      .update(payload)
      .eq("id", existing.id)
      .select("id, gradebook_item_id, profile_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
      .single();
    if (error) throw error;
    score = data;
  } else {
    const { data, error } = await db
      .from("gradebook_scores")
      .insert(payload)
      .select("id, gradebook_item_id, profile_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
      .single();
    if (error) throw error;
    score = data;
  }

  await writeGradebookAudit(db, courseId, input.actorProfileId, score.id, "gradebook_score_status_set", {
    previous_status: existing?.status || null,
    previous_score_final: existing?.score_final ?? null,
    status: input.status,
    score_final: scoreFinal,
    reason: input.reason
  });
  return score;
}

async function loadScoreForCourse(db: Db, courseId: string, scoreId: string) {
  const { data: score, error: scoreError } = await db
    .from("gradebook_scores")
    .select("id, gradebook_item_id, profile_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
    .eq("id", scoreId)
    .maybeSingle();
  if (scoreError) throw scoreError;
  if (!score) throw new Error("Score not found.");

  const { data: item, error: itemError } = await db
    .from("gradebook_items")
    .select("id, course_id")
    .eq("id", score.gradebook_item_id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error("Score is not part of this course gradebook.");
  return score;
}

async function assertGradebookItemInCourse(db: Db, courseId: string, gradebookItemId: string) {
  const { data, error } = await db
    .from("gradebook_items")
    .select("id")
    .eq("id", gradebookItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Gradebook item is not part of this course.");
}

async function assertSectionInCourse(db: Db, courseId: string, sectionId: string) {
  const { data, error } = await db
    .from("course_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Section is not part of this course.");
}

async function assertStudentInSection(db: Db, profileId: string, sectionId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("id")
    .eq("profile_id", profileId)
    .eq("section_id", sectionId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Student is not active in the selected section.");
}

async function writeGradebookAudit(db: Db, courseId: string, actorProfileId: string, scoreId: string, action: string, metadata: Record<string, unknown>) {
  return writeAuditLog(db, courseId, actorProfileId, "gradebook_score", scoreId, action, metadata);
}

async function writeAuditLog(
  db: Db,
  courseId: string,
  actorProfileId: string,
  targetType: string,
  targetId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  const { error } = await db
    .from("audit_log")
    .insert({
      course_id: courseId,
      actor_profile_id: actorProfileId,
      target_type: targetType,
      target_id: targetId,
      action,
      metadata
    });
  if (error) throw error;
}

async function loadCatalog(db: Db, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  let sectionQuery = db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, status")
    .eq("course_id", courseId)
    .order("section_code", { ascending: true });
  if (!permissions.isCourseInstructor) sectionQuery = sectionQuery.in("id", permissions.permittedSectionIds);

  const [{ data: categories, error: categoryError }, { data: items, error: itemError }, { data: sections, error: sectionError }] = await Promise.all([
    db
      .from("gradebook_categories")
      .select("id, course_id, name, weight_percent, drop_lowest_count, status")
      .eq("course_id", courseId)
      .order("name", { ascending: true }),
    db
      .from("gradebook_items")
      .select("id, course_id, category_id, activity_template_id, title, max_score, due_at, status")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true }),
    sectionQuery
  ]);
  if (categoryError) throw categoryError;
  if (itemError) throw itemError;
  if (sectionError) throw sectionError;
  const students = await loadRosterStudents(db, (sections || []).map((section) => String(section.id)));
  return {
    categories: categories || [],
    items: items || [],
    sections: sections || [],
    students
  };
}

async function loadRosterStudents(db: Db, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("section_id, profile_id, status")
    .in("section_id", sectionIds)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  const profileIds = unique((enrollments || []).map((enrollment) => enrollment.profile_id));
  if (!profileIds.length) return [];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name, institutional_email, student_identifier, status")
    .in("id", profileIds)
    .order("full_name", { ascending: true });
  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  return (enrollments || []).map((enrollment) => {
    const profile = profileById.get(enrollment.profile_id) || {};
    return {
      section_id: enrollment.section_id,
      profile_id: enrollment.profile_id,
      student_name: profile.full_name || "",
      preferred_name: profile.preferred_name || "",
      institutional_email: profile.institutional_email || "",
      student_identifier: profile.student_identifier || "",
      status: profile.status || ""
    };
  }).sort((a, b) => String(a.student_name).localeCompare(String(b.student_name)));
}

async function loadGradebookRows(db: Db, courseId: string, filters: {
  section_id: string;
  category_id: string;
  gradebook_item_id: string;
}, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  if (filters.section_id) assertSectionAllowed(permissions, filters.section_id);

  const catalog = await loadCatalog(db, courseId, permissions);
  const categoryById = new Map((catalog.categories || []).map((category) => [category.id, category]));
  const sectionById = new Map((catalog.sections || []).map((section) => [section.id, section]));
  const filteredItems = (catalog.items || []).filter((item) => {
    if (filters.category_id && item.category_id !== filters.category_id) return false;
    if (filters.gradebook_item_id && item.id !== filters.gradebook_item_id) return false;
    return true;
  });
  const itemIds = filteredItems.map((item) => item.id);
  if (!itemIds.length) return [];

  let scoreQuery = db
    .from("gradebook_scores")
    .select("id, gradebook_item_id, profile_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
    .in("gradebook_item_id", itemIds)
    .order("updated_at", { ascending: false });
  if (filters.section_id) scoreQuery = scoreQuery.eq("section_id", filters.section_id);
  if (!filters.section_id && !permissions.isCourseInstructor) scoreQuery = scoreQuery.in("section_id", permissions.permittedSectionIds);

  const { data: scores, error: scoreError } = await scoreQuery;
  if (scoreError) throw scoreError;
  if (!(scores || []).length) return [];

  const profileIds = unique((scores || []).map((score) => score.profile_id));
  const scoreIds = unique((scores || []).map((score) => score.id));
  const sourceAttemptIds = unique((scores || []).map((score) => score.source_attempt_id));
  const [
    { data: profiles, error: profileError },
    { data: adjustments, error: adjustmentError },
    { data: sourceAttempts, error: attemptError }
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id, institutional_email, student_identifier, full_name, preferred_name, status")
      .in("id", profileIds),
    db
      .from("grade_adjustments")
      .select("id, gradebook_score_id, previous_score_final, new_score_final, reason, created_at")
      .in("gradebook_score_id", scoreIds)
      .order("created_at", { ascending: false }),
    sourceAttemptIds.length
      ? db
          .from("student_attempts")
          .select("id, attempt_number, started_at, submitted_at, status, speed_bonus")
          .in("id", sourceAttemptIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (profileError) throw profileError;
  if (adjustmentError) throw adjustmentError;
  if (attemptError) throw attemptError;

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const attemptById = new Map((sourceAttempts || []).map((attempt) => [attempt.id, attempt]));
  const itemById = new Map(filteredItems.map((item) => [item.id, item]));
  const adjustmentsByScore = new Map<string, { count: number; latest_reason: string; latest_at: string }>();
  (adjustments || []).forEach((adjustment) => {
    const key = String(adjustment.gradebook_score_id);
    const current = adjustmentsByScore.get(key) || { count: 0, latest_reason: "", latest_at: "" };
    current.count += 1;
    if (!current.latest_at) {
      current.latest_reason = adjustment.reason || "";
      current.latest_at = adjustment.created_at || "";
    }
    adjustmentsByScore.set(key, current);
  });

  return (scores || []).map((score) => {
    const item = itemById.get(score.gradebook_item_id) || {};
    const category = categoryById.get(item.category_id) || {};
    const section = sectionById.get(score.section_id) || {};
    const profile = profileById.get(score.profile_id) || {};
    const attempt = score.source_attempt_id ? attemptById.get(score.source_attempt_id) || {} : {};
    const adjustment = adjustmentsByScore.get(String(score.id)) || { count: 0, latest_reason: "", latest_at: "" };
    return {
      score_id: score.id,
      gradebook_item_id: score.gradebook_item_id,
      item_title: item.title || "Untitled item",
      category_id: item.category_id || "",
      category_name: category.name || "",
      category_weight_percent: Number(category.weight_percent || 0),
      drop_lowest_count: Number(category.drop_lowest_count || 0),
      section_id: score.section_id,
      section_code: section.section_code || "",
      section_name: section.section_name || "",
      profile_id: score.profile_id,
      student_name: profile.full_name || "",
      institutional_email: profile.institutional_email || "",
      student_identifier: profile.student_identifier || "",
      source_attempt_id: score.source_attempt_id || "",
      attempt_number: attempt.attempt_number || "",
      attempt_status: attempt.status || "",
      started_at: attempt.started_at || "",
      submitted_at: attempt.submitted_at || "",
      score_raw: score.score_raw,
      score_percent: score.score_percent,
      speed_bonus: attempt.speed_bonus || 0,
      score_final: score.score_final,
      grade_status: score.status,
      status: score.status,
      locked_at: score.locked_at || "",
      adjustment_count: adjustment.count,
      latest_adjustment_reason: adjustment.latest_reason,
      latest_adjustment_at: adjustment.latest_at,
      updated_at: score.updated_at
    };
  });
}

function assertSectionAllowed(permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}, sectionId: string) {
  if (permissions.isCourseInstructor) return;
  if (permissions.permittedSectionIds.includes(String(sectionId))) return;
  throw new Error("You are not allowed to review this section.");
}

function buildWeightedGradeSummary(rows: Record<string, unknown>[]) {
  const categories = new Map<string, {
    category_id: string;
    category_name: string;
    category_weight_percent: number;
    drop_lowest_count: number;
    scores: number[];
  }>();

  rows.forEach((row) => {
    const score = Number(row.score_final);
    if (!Number.isFinite(score)) return;
    const categoryId = String(row.category_id || "uncategorized");
    const current = categories.get(categoryId) || {
      category_id: categoryId,
      category_name: String(row.category_name || "Uncategorized"),
      category_weight_percent: Number(row.category_weight_percent || 0),
      drop_lowest_count: Number(row.drop_lowest_count || 0),
      scores: []
    };
    current.scores.push(score);
    categories.set(categoryId, current);
  });

  const category_summaries = Array.from(categories.values())
    .map((category) => {
      const { kept, dropped } = applyDropLowest(category.scores, category.drop_lowest_count);
      const category_average_percent = kept.length
        ? roundOne(kept.reduce((sum, score) => sum + score, 0) / kept.length)
        : 0;
      return {
        category_id: category.category_id,
        category_name: category.category_name,
        category_weight_percent: category.category_weight_percent,
        drop_lowest_count: category.drop_lowest_count,
        score_count: category.scores.length,
        kept_score_count: kept.length,
        dropped_score_count: dropped.length,
        category_average_percent,
        weighted_points: roundOne(category_average_percent * category.category_weight_percent / 100)
      };
    })
    .sort((a, b) => String(a.category_name).localeCompare(String(b.category_name)));

  const configured_weight_percent = roundOne(category_summaries.reduce((sum, category) => sum + Number(category.category_weight_percent || 0), 0));
  const weightedPoints = category_summaries.reduce((sum, category) => sum + Number(category.weighted_points || 0), 0);
  const weighted_course_percent = configured_weight_percent
    ? roundOne(weightedPoints / configured_weight_percent * 100)
    : 0;

  return {
    weighted_course_percent,
    configured_weight_percent,
    category_summaries
  };
}

function applyDropLowest(scores: number[], dropLowestCount: number) {
  const sorted = [...scores].sort((a, b) => a - b);
  const dropCount = Math.min(Math.max(Number(dropLowestCount || 0), 0), Math.max(sorted.length - 1, 0));
  return {
    dropped: sorted.slice(0, dropCount),
    kept: sorted.slice(dropCount)
  };
}

function csvResponse(rows: Record<string, unknown>[], filename: string) {
  const headers = [
    "student_identifier",
    "student_name",
    "institutional_email",
    "section_code",
    "category_name",
    "item_title",
    "source_attempt_id",
    "attempt_number",
    "attempt_status",
    "submitted_at",
    "score_raw",
    "score_percent",
    "speed_bonus",
    "score_final",
    "grade_status",
    "adjustment_count",
    "latest_adjustment_reason",
    "locked_at",
    "updated_at"
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))
  ];
  return new Response(lines.join("\n"), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
