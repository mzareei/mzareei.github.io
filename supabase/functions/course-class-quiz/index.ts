// End-of-class graded quiz.
//
// Reuses the authenticated activity engine (activity_templates / activity_instances
// / student_attempts in course-activity-attempt) rather than building a second
// grading path. This function only orchestrates the parts that engine doesn't do
// on its own: making sure a lecture has a quiz template + gradebook slot, and
// opening/closing a live instance for a specific class session.
//
// Questions are never typed by the instructor — they come from the same
// generated bank the pulses draw from (course-question-bank), keyed by the
// lecture's own content_item_id. The activity engine mixes difficulty tiers
// automatically (course-activity-attempt's selectQuestions).
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const openSessionStates = ["open", "live", "paused", "continued"];
const gradebookCategoryName = "Quizzes";
const defaultQuestionCount = 12;
const defaultTimeLimitSeconds = 600;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const profile = await loadProfileForToken(db, token);
    const roles = await loadRoles(db, courseId, String(profile.id));
    const isTeacher = roles.some((role) => teacherRoles.includes(role));
    const isInstructor = roles.some((role) => instructorRoles.includes(role));

    switch (body.action) {
      case "start": {
        if (!isInstructor) throw new Error("Starting a quiz is not allowed for this role.");
        return json(await startQuiz(db, courseId, String(profile.id), body));
      }
      case "close": {
        if (!isInstructor) throw new Error("Closing a quiz is not allowed for this role.");
        return json(await closeQuiz(db, courseId, body));
      }
      case "status": {
        if (!isTeacher) throw new Error("Quiz status is not allowed for this role.");
        return json(await quizStatus(db, courseId, body));
      }
      case "summary": {
        if (!isTeacher) throw new Error("Quiz summary is not allowed for this role.");
        return json(await quizSummary(db, courseId, body, roles.includes("teaching_assistant") && !isInstructor, String(profile.id)));
      }
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = error?.message || "Unable to manage the class quiz.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("No active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadRoles(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => String(row.role));
}

async function loadSession(db: Db, courseId: string, sessionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, state, sequence_number, title")
    .eq("id", sessionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That class session was not found.");
  return data;
}

/** The lecture's own content item — the same one the deck and the pulse bank use. */
async function loadLectureItem(db: Db, courseId: string, slug: string) {
  const { data, error } = await db
    .from("content_items")
    .select("id, slug, title, content_type")
    .eq("course_id", courseId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No content item found for slug "${slug}".`);
  return data;
}

async function ensureGradebookCategory(db: Db, courseId: string) {
  const { data: existing, error } = await db
    .from("gradebook_categories")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", gradebookCategoryName)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  const { data: created, error: createError } = await db
    .from("gradebook_categories")
    .insert({ course_id: courseId, name: gradebookCategoryName, weight_percent: 30, drop_lowest_count: 1, status: "active" })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

/** One quiz template + gradebook slot per lecture, created once and reused. */
async function ensureTemplateAndItem(db: Db, courseId: string, item: { id: string; title: string }) {
  const { data: template, error: templateError } = await db
    .from("activity_templates")
    .upsert(
      {
        content_item_id: item.id,
        activity_type: "quiz",
        grading_mode: "correctness",
        max_score: 100,
        weight_category: "quizzes",
        updated_at: new Date().toISOString()
      },
      { onConflict: "content_item_id,activity_type" }
    )
    .select("id")
    .maybeSingle();
  if (templateError) throw templateError;
  const templateId = template!.id;

  const categoryId = await ensureGradebookCategory(db, courseId);
  const { data: gradebookItem, error: itemError } = await db
    .from("gradebook_items")
    .upsert(
      {
        course_id: courseId,
        category_id: categoryId,
        activity_template_id: templateId,
        title: `${item.title} — Quiz`,
        max_score: 100,
        status: "published",
        updated_at: new Date().toISOString()
      },
      { onConflict: "category_id,title" }
    )
    .select("id")
    .maybeSingle();
  if (itemError) throw itemError;

  return { templateId, gradebookItemId: gradebookItem!.id };
}

async function bankQuestionCounts(db: Db, courseId: string, contentItemId: string) {
  const { data: bank, error } = await db
    .from("question_banks")
    .select("id")
    .eq("course_id", courseId)
    .eq("content_item_id", contentItemId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!bank) return 0;
  const { count, error: countError } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("question_bank_id", bank.id)
    .eq("status", "active");
  if (countError) throw countError;
  return count ?? 0;
}

async function startQuiz(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const slug = String(body.content_slug || "").trim();
  const session = await loadSession(db, courseId, sessionId);
  if (!openSessionStates.includes(String(session.state))) {
    throw new Error("Start the class session before starting the quiz.");
  }
  const item = await loadLectureItem(db, courseId, slug);
  const available = await bankQuestionCounts(db, courseId, item.id);
  if (!available) throw new Error("This lecture has no question bank yet.");

  const { templateId } = await ensureTemplateAndItem(db, courseId, item);
  const questionCount = Math.min(available, Math.max(1, Number(body.question_count) || defaultQuestionCount));
  const timeLimit = Math.min(3600, Math.max(60, Number(body.time_limit_seconds) || defaultTimeLimitSeconds));

  // Reuse a still-open instance for this session if one already exists —
  // "Start quiz" is idempotent, so a refreshed page never creates a duplicate.
  const { data: existing, error: existingError } = await db
    .from("activity_instances")
    .select("id, state, ends_at")
    .eq("activity_template_id", templateId)
    .eq("class_session_id", sessionId)
    .in("state", ["open", "live", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { instance_id: existing.id, reused: true };

  const now = new Date();
  const { data: instance, error: insertError } = await db
    .from("activity_instances")
    .insert({
      activity_template_id: templateId,
      section_id: session.section_id,
      class_session_id: sessionId,
      state: "live",
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + timeLimit * 1000).toISOString(),
      time_limit_seconds: timeLimit,
      randomization_policy: "shuffle_questions_and_options",
      question_count: questionCount,
      created_by: actorProfileId
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "activity_instance",
    target_id: instance.id,
    action: "class_quiz_started",
    metadata: { class_session_id: sessionId, content_slug: slug, question_count: questionCount }
  });

  return { instance_id: instance.id, reused: false };
}

async function closeQuiz(db: Db, courseId: string, body: Record<string, unknown>) {
  const instanceId = cleanUuid(body.activity_instance_id, "activity instance id");
  const { data: updated, error } = await db
    .from("activity_instances")
    .update({ state: "closed", updated_at: new Date().toISOString() })
    .eq("id", instanceId)
    .select("id, class_session_id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error("That quiz instance was not found.");
  return { instance_id: updated.id, state: "closed" };
}

async function quizStatus(db: Db, courseId: string, body: Record<string, unknown>) {
  const instanceId = cleanUuid(body.activity_instance_id, "activity instance id");
  const { data: instance, error } = await db
    .from("activity_instances")
    .select("id, section_id, state, ends_at, question_count")
    .eq("id", instanceId)
    .maybeSingle();
  if (error) throw error;
  if (!instance) throw new Error("That quiz instance was not found.");

  const [{ count: enrolled }, { data: attempts, error: attemptError }] = await Promise.all([
    db.from("section_enrollments").select("id", { count: "exact", head: true })
      .eq("section_id", instance.section_id).eq("role", "student").eq("status", "active"),
    db.from("student_attempts").select("id, status, score_final")
      .eq("activity_instance_id", instanceId)
  ]);
  if (attemptError) throw attemptError;

  const submitted = (attempts || []).filter((a) => ["submitted", "late"].includes(String(a.status)));
  return {
    instance_id: instance.id,
    state: instance.state,
    ends_at: instance.ends_at,
    question_count: instance.question_count,
    enrolled: enrolled ?? 0,
    started: (attempts || []).length,
    submitted: submitted.length,
    average_score: submitted.length
      ? Math.round((submitted.reduce((sum, a) => sum + Number(a.score_final || 0), 0) / submitted.length) * 10) / 10
      : null
  };
}

async function quizSummary(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  taScoped: boolean,
  actorProfileId: string
) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);

  if (taScoped) {
    const { data: enrollment, error } = await db
      .from("section_enrollments")
      .select("id")
      .eq("profile_id", actorProfileId)
      .eq("section_id", session.section_id)
      .eq("role", "teaching_assistant")
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!enrollment) throw new Error("Quiz summary is not allowed for this section.");
  }

  const { data: instances, error: instanceError } = await db
    .from("activity_instances")
    .select("id, state")
    .eq("class_session_id", sessionId);
  if (instanceError) throw instanceError;
  if (!(instances || []).length) return { attempts: [] };

  const instanceIds = (instances || []).map((i) => i.id);
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, profile_id, status, score_raw, score_percent, score_final, submitted_at")
    .in("activity_instance_id", instanceIds);
  if (attemptError) throw attemptError;

  const profileIds = Array.from(new Set((attempts || []).map((a) => String(a.profile_id))));
  const { data: profiles, error: profileError } = profileIds.length
    ? await db.from("profiles").select("id, full_name, preferred_name, student_identifier").in("id", profileIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const byId = new Map((profiles || []).map((p) => [String(p.id), p]));

  return {
    attempts: (attempts || []).map((attempt) => {
      const person = byId.get(String(attempt.profile_id)) || {};
      return {
        profile_id: attempt.profile_id,
        name: person.preferred_name || person.full_name || "Student",
        student_identifier: person.student_identifier || null,
        status: attempt.status,
        score_percent: attempt.score_percent,
        score_final: attempt.score_final,
        submitted_at: attempt.submitted_at
      };
    })
  };
}
