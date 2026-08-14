import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

// Platform owner only. This is the Gen-1 migration tool — it writes
// activity_instances into caller-named sections and has no SPA caller, so a
// section-scoped instructor has no legitimate use for it.
const teacherRoles = ["platform_owner"];

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
    await requireInstructor(db, token, courseId);

    if (body.action === "migrate_lecture_bank") {
      const result = await migrateLectureBank(db, {
        courseId,
        lectureId: cleanLegacyId(body.lecture_id),
        contentSlug: cleanSlug(body.content_slug || body.lecture_id),
        sectionIds: cleanUuidList(body.section_ids),
        questionCount: cleanQuestionCount(body.question_count)
      });
      return json(result);
    }

    const legacyLectures = await listLegacyLectures(db, courseId);
    return json({
      legacy_lectures: legacyLectures,
      actions: ["list_legacy_lectures", "migrate_lecture_bank"]
    });
  } catch (error) {
    const message = error.message || "Unable to run legacy quiz compatibility action.";
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

function cleanLegacyId(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,120}$/.test(text)) throw new Error("A valid legacy lecture id is required.");
  return text;
}

function cleanSlug(value: unknown) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  if (!slug) throw new Error("A valid content slug is required.");
  return slug.startsWith("legacy-") ? slug : `legacy-${slug}`;
}

function cleanUuidList(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from(new Set(rows.map((item) => {
    const text = String(item || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
      throw new Error("A section id is invalid.");
    }
    return text;
  })));
}

function cleanQuestionCount(value: unknown) {
  const count = Number(value || 10);
  if (!Number.isFinite(count)) return 10;
  return Math.max(1, Math.min(100, Math.floor(count)));
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
  if (!(memberships || []).length) throw new Error("You are not allowed to migrate quiz banks for this course.");

  return { profile, user: userData.user };
}

async function listLegacyLectures(db: ReturnType<typeof adminClient>, courseId: string) {
  const { data: lectures, error } = await db
    .from("quiz_lectures")
    .select("id, course_id, title, week_number, lecture_number")
    .eq("course_id", courseId)
    .order("week_number", { ascending: true })
    .order("lecture_number", { ascending: true });
  if (error) throw error;
  if (!(lectures || []).length) return [];

  const lectureIds = (lectures || []).map((lecture) => lecture.id);
  const { data: questions, error: questionError } = await db
    .from("quiz_questions")
    .select("id, lecture_id, active")
    .in("lecture_id", lectureIds);
  if (questionError) throw questionError;

  const targetSlugs = lectureIds.map((id) => cleanSlug(id));
  const { data: contentItems, error: contentError } = await db
    .from("content_items")
    .select("id, slug")
    .eq("course_id", courseId)
    .in("slug", targetSlugs);
  if (contentError) throw contentError;
  const contentBySlug = new Map((contentItems || []).map((item) => [item.slug, item]));

  return (lectures || []).map((lecture) => {
    const activeQuestionCount = (questions || []).filter((question) => question.lecture_id === lecture.id && question.active).length;
    return {
      lecture_id: lecture.id,
      title: lecture.title,
      week_number: lecture.week_number,
      lecture_number: lecture.lecture_number,
      active_question_count: activeQuestionCount,
      target_content_slug: cleanSlug(lecture.id),
      migrated: contentBySlug.has(cleanSlug(lecture.id))
    };
  });
}

async function migrateLectureBank(db: ReturnType<typeof adminClient>, input: {
  courseId: string;
  lectureId: string;
  contentSlug: string;
  sectionIds: string[];
  questionCount: number;
}) {
  const { data: lecture, error: lectureError } = await db
    .from("quiz_lectures")
    .select("id, course_id, title, week_number, lecture_number")
    .eq("id", input.lectureId)
    .eq("course_id", input.courseId)
    .maybeSingle();
  if (lectureError) throw lectureError;
  if (!lecture) throw new Error("Legacy lecture not found for this course.");

  const { data: contentItem, error: contentError } = await db
    .from("content_items")
    .upsert({
      course_id: input.courseId,
      content_type: "quiz_bank",
      slug: input.contentSlug,
      title: `Legacy quiz bank: ${lecture.title}`,
      summary: `Migrated from quiz_* lecture ${lecture.id}.`,
      source_kind: "supabase_record",
      source_ref: lecture.id,
      contains_sensitive_content: true,
      default_points: input.questionCount,
      updated_at: new Date().toISOString()
    }, { onConflict: "course_id,slug" })
    .select("id, slug, title")
    .single();
  if (contentError) throw contentError;

  const bank = await loadOrCreateQuestionBank(db, input.courseId, contentItem.id, contentItem.title);
  const { migrated, skipped } = await copyQuestions(db, bank.id, input.lectureId);
  const template = await loadOrCreateActivityTemplate(db, contentItem.id, input.questionCount);
  const instances = await createMissingActivityInstances(db, template.id, input.sectionIds, input.questionCount);

  return {
    content_item: contentItem,
    question_bank: bank,
    activity_template: template,
    activity_instances: instances,
    migrated_question_count: migrated,
    skipped_question_count: skipped
  };
}

async function loadOrCreateQuestionBank(db: ReturnType<typeof adminClient>, courseId: string, contentItemId: string, title: string) {
  const { data: existing, error: existingError } = await db
    .from("question_banks")
    .select("id, course_id, content_item_id, title, status")
    .eq("course_id", courseId)
    .eq("content_item_id", contentItemId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await db
    .from("question_banks")
    .insert({
      course_id: courseId,
      content_item_id: contentItemId,
      title,
      bank_type: "practice",
      status: "active"
    })
    .select("id, course_id, content_item_id, title, status")
    .single();
  if (error) throw error;
  return data;
}

async function copyQuestions(db: ReturnType<typeof adminClient>, questionBankId: string, lectureId: string) {
  const { data: legacyQuestions, error } = await db
    .from("quiz_questions")
    .select("id, prompt, question_type, difficulty, topic, points, explanation, active")
    .eq("lecture_id", lectureId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;

  let migrated = 0;
  let skipped = 0;

  for (const legacyQuestion of legacyQuestions || []) {
    const { data: existing, error: existingError } = await db
      .from("questions")
      .select("id")
      .eq("question_bank_id", questionBankId)
      .eq("prompt", legacyQuestion.prompt)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      skipped += 1;
      continue;
    }

    const { data: question, error: questionError } = await db
      .from("questions")
      .insert({
        question_bank_id: questionBankId,
        prompt: legacyQuestion.prompt,
        question_type: normalizeQuestionType(legacyQuestion.question_type),
        difficulty: normalizeDifficulty(legacyQuestion.difficulty),
        topic_tags: Array.isArray(legacyQuestion.topic) ? legacyQuestion.topic : [],
        points: legacyQuestion.points || 1,
        explanation: legacyQuestion.explanation || null,
        status: "active"
      })
      .select("id")
      .single();
    if (questionError) throw questionError;

    const { data: legacyOptions, error: optionLoadError } = await db
      .from("quiz_options")
      .select("option_text, is_correct, position")
      .eq("question_id", legacyQuestion.id)
      .order("position", { ascending: true });
    if (optionLoadError) throw optionLoadError;

    const optionRows = (legacyOptions || []).map((option) => ({
      question_id: question.id,
      option_text: option.option_text,
      is_correct: Boolean(option.is_correct),
      position: option.position || 0
    }));
    if (optionRows.length) {
      const { error: optionInsertError } = await db.from("question_options").insert(optionRows);
      if (optionInsertError) throw optionInsertError;
    }
    migrated += 1;
  }

  return { migrated, skipped };
}

async function loadOrCreateActivityTemplate(db: ReturnType<typeof adminClient>, contentItemId: string, questionCount: number) {
  const { data: existing, error: existingError } = await db
    .from("activity_templates")
    .select("id, content_item_id, activity_type, grading_mode, max_score")
    .eq("content_item_id", contentItemId)
    .eq("activity_type", "quiz")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await db
    .from("activity_templates")
    .insert({
      content_item_id: contentItemId,
      activity_type: "quiz",
      grading_mode: "correctness",
      max_score: questionCount,
      weight_category: "Practice",
      instructions: "Migrated from the legacy live quiz bank."
    })
    .select("id, content_item_id, activity_type, grading_mode, max_score")
    .single();
  if (error) throw error;
  return data;
}

async function createMissingActivityInstances(db: ReturnType<typeof adminClient>, activityTemplateId: string, sectionIds: string[], questionCount: number) {
  const created = [];
  for (const sectionId of sectionIds) {
    const { data: existing, error: existingError } = await db
      .from("activity_instances")
      .select("id, section_id, state")
      .eq("activity_template_id", activityTemplateId)
      .eq("section_id", sectionId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      created.push(existing);
      continue;
    }

    const { data, error } = await db
      .from("activity_instances")
      .insert({
        activity_template_id: activityTemplateId,
        section_id: sectionId,
        state: "planned",
        randomization_policy: "random_bank_sample",
        question_count: questionCount
      })
      .select("id, section_id, state")
      .single();
    if (error) throw error;
    created.push(data);
  }
  return created;
}

function normalizeQuestionType(value: unknown) {
  const type = String(value || "single_choice").trim().toLowerCase();
  return ["single_choice", "multiple_choice", "short_text", "reflection", "rubric"].includes(type) ? type : "single_choice";
}

function normalizeDifficulty(value: unknown) {
  const difficulty = String(value || "medium").trim().toLowerCase();
  if (difficulty === "challenge") return "hard";
  return ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
}
