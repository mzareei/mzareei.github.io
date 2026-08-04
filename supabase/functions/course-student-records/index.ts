import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

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
    const db = adminClient();
    const permissions = await requireTeacher(db, token, courseId);

    if (body.action === "student_record") {
      const profileId = cleanUuid(body.profile_id, "profile id");
      const record = await loadStudentRecord(db, courseId, profileId, permissions);
      return json(record);
    }

    if (body.action === "list_students" || !body.action) {
      const students = await listStudents(db, courseId, permissions);
      return json({ students });
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error.message || "Unable to load student records.";
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

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

async function requireTeacher(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Teacher profile is not linked to this account.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .in("role", teacherRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to review student records for this course.");

  const isCourseInstructor = (memberships || []).some((membership) => String(membership.role) === "platform_owner");
  const permittedSectionIds = isCourseInstructor ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isCourseInstructor && !permittedSectionIds.length) {
    throw new Error("You are not allowed to review student records for this course.");
  }

  return { profile, user: userData.user, isCourseInstructor, permittedSectionIds };
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
  return unique((data || []).map((row) => row.section_id));
}

async function listStudents(db: Db, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  const sections = await loadCourseSections(db, courseId, permissions);
  const sectionIds = sections.map((section) => String(section.id));
  if (!sectionIds.length) return [];

  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("section_id, profile_id, status")
    .in("section_id", sectionIds)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  if (!(enrollments || []).length) return [];

  const profileIds = unique((enrollments || []).map((enrollment) => enrollment.profile_id));
  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, institutional_email, student_identifier, full_name, preferred_name, status")
    .in("id", profileIds)
    .order("full_name", { ascending: true });
  if (profileError) throw profileError;

  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const enrollmentByProfile = new Map<string, Record<string, unknown>[]>();
  (enrollments || []).forEach((enrollment) => {
    const key = String(enrollment.profile_id);
    if (!enrollmentByProfile.has(key)) enrollmentByProfile.set(key, []);
    enrollmentByProfile.get(key)!.push(enrollment);
  });

  return (profiles || []).map((profile) => {
    const rows = enrollmentByProfile.get(String(profile.id)) || [];
    const codes = rows.map((row) => {
      const section = sectionById.get(row.section_id) || {};
      return section.section_code || "";
    }).filter(Boolean);
    return {
      profile_id: profile.id,
      full_name: profile.full_name,
      preferred_name: profile.preferred_name || "",
      institutional_email: profile.institutional_email,
      student_identifier: profile.student_identifier || "",
      section_codes: codes,
      status: profile.status
    };
  });
}

async function loadStudentRecord(db: Db, courseId: string, profileId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, institutional_email, student_identifier, full_name, preferred_name, status")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Student record not found.");

  const sections = await loadStudentSections(db, courseId, profileId);
  assertStudentScope(sections.map((section) => String(section.id)), permissions);

  const sectionIds = sections.map((section) => String(section.id));
  const [scores, attempts, exitTickets, portfolioEntries] = await Promise.all([
    loadScores(db, courseId, profileId, sectionIds),
    loadAttempts(db, profileId, sectionIds),
    loadExitTickets(db, courseId, profileId, sectionIds),
    loadPortfolioEntries(db, courseId, profileId, sectionIds)
  ]);

  return {
    profile,
    sections,
    scores,
    attempts,
    exit_tickets: exitTickets,
    portfolio_entries: portfolioEntries,
    summary: summarize(scores, attempts, exitTickets, portfolioEntries)
  };
}

function assertStudentScope(sectionIds: string[], permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  if (!sectionIds.length) throw new Error("Student is not enrolled in this course.");
  if (permissions.isCourseInstructor) return;
  const allowed = sectionIds.some((sectionId) => permissions.permittedSectionIds.includes(sectionId));
  if (!allowed) throw new Error("You are not allowed to review this student record.");
}

async function loadCourseSections(db: Db, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  let query = db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, status")
    .eq("course_id", courseId)
    .order("section_code", { ascending: true });
  if (!permissions.isCourseInstructor) query = query.in("id", permissions.permittedSectionIds);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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

  const { data, error } = await db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, status")
    .eq("course_id", courseId)
    .in("id", sectionIds)
    .order("section_code", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadScores(db: Db, courseId: string, profileId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: scores, error: scoreError } = await db
    .from("gradebook_scores")
    .select("id, gradebook_item_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("updated_at", { ascending: false });
  if (scoreError) throw scoreError;
  if (!(scores || []).length) return [];

  const itemIds = unique((scores || []).map((score) => score.gradebook_item_id));
  const { data: items, error: itemError } = await db
    .from("gradebook_items")
    .select("id, course_id, category_id, title, max_score, due_at, status")
    .eq("course_id", courseId)
    .in("id", itemIds);
  if (itemError) throw itemError;
  const categoryIds = unique((items || []).map((item) => item.category_id));
  const { data: categories, error: categoryError } = categoryIds.length
    ? await db
        .from("gradebook_categories")
        .select("id, name, weight_percent")
        .eq("course_id", courseId)
        .in("id", categoryIds)
    : { data: [], error: null };
  if (categoryError) throw categoryError;

  const itemById = new Map((items || []).map((item) => [item.id, item]));
  const categoryById = new Map((categories || []).map((category) => [category.id, category]));
  return (scores || [])
    .filter((score) => itemById.has(score.gradebook_item_id))
    .map((score) => {
      const item = itemById.get(score.gradebook_item_id) || {};
      const category = categoryById.get(item.category_id) || {};
      return {
        score_id: score.id,
        item_title: item.title || "Untitled activity",
        category_name: category.name || "",
        max_score: item.max_score,
        due_at: item.due_at,
        source_attempt_id: score.source_attempt_id || "",
        score_raw: score.score_raw,
        score_percent: score.score_percent,
        score_final: score.score_final,
        status: score.status,
        locked_at: score.locked_at || "",
        updated_at: score.updated_at
      };
    });
}

async function loadAttempts(db: Db, profileId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, speed_bonus, score_final")
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("started_at", { ascending: false })
    .limit(50);
  if (attemptError) throw attemptError;
  if (!(attempts || []).length) return [];

  const instanceIds = unique((attempts || []).map((attempt) => attempt.activity_instance_id));
  const { data: instances, error: instanceError } = await db
    .from("activity_instances")
    .select("id, activity_template_id, section_id, class_session_id, state")
    .in("id", instanceIds);
  if (instanceError) throw instanceError;
  const templateIds = unique((instances || []).map((instance) => instance.activity_template_id));
  const { data: templates, error: templateError } = templateIds.length
    ? await db
        .from("activity_templates")
        .select("id, content_item_id, activity_type, grading_mode")
        .in("id", templateIds)
    : { data: [], error: null };
  if (templateError) throw templateError;
  const contentIds = unique((templates || []).map((template) => template.content_item_id));
  const { data: items, error: itemError } = contentIds.length
    ? await db
        .from("content_items")
        .select("id, title, slug, content_type")
        .in("id", contentIds)
    : { data: [], error: null };
  if (itemError) throw itemError;

  const instanceById = new Map((instances || []).map((instance) => [instance.id, instance]));
  const templateById = new Map((templates || []).map((template) => [template.id, template]));
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  const integrityByAttempt = await loadIntegrityFlags(db, (attempts || []).map((attempt) => attempt.id));
  return (attempts || []).map((attempt) => {
    const instance = instanceById.get(attempt.activity_instance_id) || {};
    const template = templateById.get(instance.activity_template_id) || {};
    const item = itemById.get(template.content_item_id) || {};
    return {
      attempt_id: attempt.id,
      attempt_number: attempt.attempt_number || 1,
      activity_title: item.title || "Activity",
      activity_type: template.activity_type || "",
      grading_mode: template.grading_mode || "",
      status: attempt.status,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      score_raw: attempt.score_raw,
      score_percent: attempt.score_percent,
      speed_bonus: attempt.speed_bonus,
      score_final: attempt.score_final,
      integrity_flagged: Boolean(integrityByAttempt.get(String(attempt.id))?.flagged),
      integrity_reasons: integrityByAttempt.get(String(attempt.id))?.reasons || []
    };
  });
}

async function loadIntegrityFlags(db: Db, attemptIds: string[]) {
  const map = new Map<string, { flagged: boolean; reasons: string[] }>();
  if (!attemptIds.length) return map;
  const { data, error } = await db
    .from("audit_log")
    .select("target_id, action, metadata, created_at")
    .eq("target_type", "student_attempt")
    .in("target_id", attemptIds)
    .in("action", ["integrity_report", "integrity_flagged"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  (data || []).forEach((row) => {
    const key = String(row.target_id);
    if (map.has(key)) return;
    const md = (row.metadata || {}) as Record<string, unknown>;
    map.set(key, {
      flagged: Boolean(md.flagged) || String(row.action) === "integrity_flagged",
      reasons: Array.isArray(md.reasons) ? (md.reasons as string[]) : []
    });
  });
  return map;
}

async function loadExitTickets(db: Db, courseId: string, profileId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: tickets, error } = await db
    .from("exit_tickets")
    .select("id, section_id, class_session_id, content_item_id, confidence, one_thing, muddy_point, next_action, created_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return tickets || [];
}

async function loadPortfolioEntries(db: Db, courseId: string, profileId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data, error } = await db
    .from("portfolio_entries")
    .select("id, section_id, content_item_id, gradebook_category_id, entry_type, entry_json, visibility, created_at, updated_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

function summarize(
  scores: Record<string, unknown>[],
  attempts: Record<string, unknown>[],
  exitTickets: Record<string, unknown>[],
  portfolioEntries: Record<string, unknown>[]
) {
  const finals = scores.map((score) => Number(score.score_final)).filter((value) => Number.isFinite(value));
  const average_final = finals.length ? Math.round((finals.reduce((sum, value) => sum + value, 0) / finals.length) * 10) / 10 : 0;
  return {
    score_count: scores.length,
    attempt_count: attempts.length,
    submitted_attempts: attempts.filter((attempt) => ["submitted", "late"].includes(String(attempt.status))).length,
    exit_ticket_count: exitTickets.length,
    portfolio_entry_count: portfolioEntries.length,
    average_final
  };
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
