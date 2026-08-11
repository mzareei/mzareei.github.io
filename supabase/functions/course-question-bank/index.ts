// Generated question banks.
//
// Questions are produced from the course content of a specific class — the
// instructor never types a stem. This function is where a generated bank lands and
// where live features draw from it.
//
// Actions:
//   import_bank    { content_slug, title, teaching_slide_count, questions[] }  (instructor)
//     Idempotent upsert of a whole bank, keyed by (bank, generation_key), so
//     regenerating a deck replaces its own questions instead of duplicating them.
//     Anything an instructor edited by hand is marked generated_edited and left
//     alone unless replace_edited is explicitly set.
//   list_banks     { }                                   (teacher)
//   list_questions { question_bank_id }                  (instructor)
//   update_question { question_bank_id, question_id, ... } (instructor)
//   delete_question { question_bank_id, question_id }    (instructor)
//   draw_question  { content_slug, difficulty?, checkpoint_after_slide?, exclude_keys? }  (teacher)
//     Picks one question for a live pulse. Returns the correct option too — only
//     the instructor's own screen calls this, and course-pulse re-snapshots it.
import { adminClient } from "../_shared/client.ts";
import {
  checkpointCoverage,
  checkpointMetadataColumns,
  checkpointMetadataFromQuestion,
  checkpointMetadataState,
  validateCheckpointBank,
} from "../_shared/checkpoints.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const difficulties = ["easy", "medium", "hard"];

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
      case "import_bank": {
        if (!isInstructor) throw new Error("Importing a question bank is not allowed for this role.");
        return json(await importBank(db, courseId, String(profile.id), body));
      }
      case "list_banks": {
        if (!isTeacher) throw new Error("Question banks are not allowed for this role.");
        return json(await listBanks(db, courseId));
      }
      case "list_questions": {
        if (!isInstructor) throw new Error("Question review is not allowed for this role.");
        return json(await listQuestions(db, courseId, body));
      }
      case "update_question": {
        if (!isInstructor) throw new Error("Question editing is not allowed for this role.");
        return json(await updateQuestion(db, courseId, String(profile.id), body));
      }
      case "delete_question": {
        if (!isInstructor) throw new Error("Question deletion is not allowed for this role.");
        return json(await deleteQuestion(db, courseId, String(profile.id), body));
      }
      case "delete_bank": {
        if (!isInstructor) throw new Error("Deleting a question bank is not allowed for this role.");
        return json(await deleteBank(db, courseId, String(profile.id), body));
      }
      case "draw_question": {
        if (!isTeacher) throw new Error("Drawing a question is not allowed for this role.");
        return json(await drawQuestion(db, courseId, body));
      }
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to manage question banks.";
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

async function loadContentItem(db: Db, courseId: string, slug: string) {
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

/** Validate one generated question hard: a malformed bank must never reach a class. */
function validateQuestion(raw: Record<string, unknown>, index: number) {
  const where = `question ${index + 1}`;
  const key = String(raw.key || "").trim().slice(0, 40);
  if (!key) throw new Error(`${where}: a generation key is required.`);
  const difficulty = String(raw.difficulty || "medium");
  if (!difficulties.includes(difficulty)) {
    throw new Error(`${where}: difficulty must be easy, medium or hard.`);
  }
  const prompt = String(raw.prompt || "").trim();
  if (prompt.length < 8) throw new Error(`${where}: the prompt is too short.`);

  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options = rawOptions.map((option, optionIndex) => {
    const record = (option || {}) as Record<string, unknown>;
    const text = String(record.text || "").trim();
    if (!text) throw new Error(`${where}: option ${optionIndex + 1} has no text.`);
    return {
      text,
      text_es: String(record.text_es || "").trim() || null,
      is_correct: Boolean(record.is_correct),
      position: optionIndex
    };
  });
  if (options.length !== 4) throw new Error(`${where}: exactly four options are required.`);
  const correctCount = options.filter((option) => option.is_correct).length;
  if (correctCount !== 1) throw new Error(`${where}: exactly one option must be correct.`);

  return {
    key,
    difficulty,
    prompt,
    prompt_es: String(raw.prompt_es || "").trim() || null,
    explanation: String(raw.explanation || "").trim() || null,
    explanation_es: String(raw.explanation_es || "").trim() || null,
    topic_tags: Array.isArray(raw.topic_tags)
      ? raw.topic_tags.map((tag) => String(tag).slice(0, 60)).slice(0, 8)
      : [],
    checkpoint: checkpointMetadataFromQuestion(raw),
    options
  };
}

async function importBank(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const slug = String(body.content_slug || "").trim();
  const item = await loadContentItem(db, courseId, slug);
  const teachingSlideCount = Number(body.teaching_slide_count);
  if (!Number.isInteger(teachingSlideCount) || teachingSlideCount < 1) {
    throw new Error("A finalized teaching slide count is required.");
  }
  const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
  if (!rawQuestions.length) throw new Error("The bank has no questions.");
  const questions = rawQuestions.map((raw, index) =>
    validateQuestion((raw || {}) as Record<string, unknown>, index)
  );

  const checkpointProblems = validateCheckpointBank(
    questions.map((question) => ({
      ...question.checkpoint,
      difficulty: question.difficulty
    })),
    teachingSlideCount
  );
  if (checkpointProblems.length) {
    throw new Error(`Generated bank rejected: ${checkpointProblems.slice(0, 5).join("; ")}`);
  }

  const { data: bank, error: bankError } = await db
    .from("question_banks")
    .upsert(
      {
        course_id: courseId,
        content_item_id: item.id,
        title: String(body.title || item.title).slice(0, 180),
        bank_type: "graded",
        status: "active",
        created_by: actorProfileId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "course_id,content_item_id,bank_type" }
    )
    .select("id, title")
    .maybeSingle();
  if (bankError) throw bankError;
  const bankId = String(bank!.id);

  // Leave hand-edited questions alone unless explicitly told otherwise.
  const { data: existing, error: existingError } = await db
    .from("questions")
    .select("id, generation_key, source")
    .eq("question_bank_id", bankId);
  if (existingError) throw existingError;
  const bySource = new Map((existing || []).map((row) => [String(row.generation_key), String(row.source)]));
  const replaceEdited = Boolean(body.replace_edited);

  let written = 0;
  let skipped = 0;
  for (const question of questions) {
    if (bySource.get(question.key) === "generated_edited" && !replaceEdited) {
      skipped += 1;
      continue;
    }

    const { data: saved, error: saveError } = await db
      .from("questions")
      .upsert(
        {
          question_bank_id: bankId,
          generation_key: question.key,
          prompt: question.prompt,
          prompt_es: question.prompt_es,
          explanation: question.explanation,
          explanation_es: question.explanation_es,
          question_type: "single_choice",
          difficulty: question.difficulty,
          topic_tags: question.topic_tags,
          points: 1,
          status: "active",
          source: "generated",
          updated_at: new Date().toISOString(),
          ...checkpointMetadataColumns(question.checkpoint)
        },
        { onConflict: "question_bank_id,generation_key" }
      )
      .select("id")
      .maybeSingle();
    if (saveError) throw saveError;

    // Options are replaced wholesale: they are meaningless apart from their stem.
    const { error: deleteError } = await db
      .from("question_options")
      .delete()
      .eq("question_id", saved!.id);
    if (deleteError) throw deleteError;

    const { error: optionError } = await db.from("question_options").insert(
      question.options.map((option) => ({
        question_id: saved!.id,
        option_text: option.text,
        option_text_es: option.text_es,
        is_correct: option.is_correct,
        position: option.position
      }))
    );
    if (optionError) throw optionError;
    written += 1;
  }

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "question_bank",
    target_id: bankId,
    action: "question_bank_imported",
    metadata: { content_slug: slug, written, skipped, total: questions.length }
  });

  return {
    bank_id: bankId,
    content_slug: slug,
    written,
    skipped_edited: skipped,
    counts: difficulties.reduce(
      (acc, difficulty) => ({
        ...acc,
        [difficulty]: questions.filter((question) => question.difficulty === difficulty).length
      }),
      {} as Record<string, number>
    )
  };
}

async function listBanks(db: Db, courseId: string) {
  const { data: banks, error } = await db
    .from("question_banks")
    .select("id, title, content_item_id, bank_type, status, generation_validation_profile, checkpoint_preparation_state, checkpoint_preparation_updated_at, updated_at")
    .eq("course_id", courseId)
    .eq("status", "active");
  if (error) throw error;
  if (!(banks || []).length) return { banks: [] };

  const contentItemIds = (banks || []).map((bank) => bank.content_item_id).filter(Boolean);
  const { data: items, error: itemError } = contentItemIds.length
    ? await db
      .from("content_items")
      .select("id, slug, title, content_type")
      .in("id", contentItemIds)
    : { data: [], error: null };
  if (itemError) throw itemError;
  const itemById = new Map((items || []).map((item) => [String(item.id), item]));

  const { data: questions, error: questionError } = await db
    .from("questions")
    .select("question_bank_id, difficulty, status, segment_key, source_pdf_pages, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide")
    .in("question_bank_id", (banks || []).map((bank) => bank.id))
    .eq("status", "active");
  if (questionError) throw questionError;

  return {
    banks: (banks || [])
      .map((bank) => {
        const item = itemById.get(String(bank.content_item_id));
        const mine = (questions || []).filter((q) => String(q.question_bank_id) === String(bank.id));
        const metadataState = checkpointMetadataState(mine);
        const sourcePdfPages = [...new Set(mine.flatMap((question) =>
          Array.isArray(question.source_pdf_pages) ? question.source_pdf_pages : []
        ))].filter((page) => Number.isInteger(page) && Number(page) > 0).sort((a, b) => Number(a) - Number(b));
        const sourcePdfMappingStatus = mine.length > 0
          && mine.every((question) => Array.isArray(question.source_pdf_pages)
            && question.source_pdf_pages.length > 0
            && question.source_pdf_pages.every((page) => Number.isInteger(page) && Number(page) > 0))
          ? "valid"
          : "missing";
        return {
          bank_id: bank.id,
          content_item_id: bank.content_item_id,
          title: bank.title,
          content_slug: item?.slug ?? null,
          content_title: item?.title ?? null,
          content_type: item?.content_type ?? null,
          generation_validation_profile: bank.generation_validation_profile,
          checkpoint_preparation_state: bank.checkpoint_preparation_state,
          checkpoint_preparation_updated_at: bank.checkpoint_preparation_updated_at,
          updated_at: bank.updated_at,
          total: mine.length,
          checkpoint_metadata_status: metadataState.status,
          checkpoint_metadata_present: metadataState.presentCount,
          checkpoint_metadata_valid: metadataState.validRows.length,
          checkpoint_coverage: checkpointCoverage(metadataState.validRows),
          source_pdf_mapping_status: sourcePdfMappingStatus,
          source_pdf_pages: sourcePdfPages,
          by_difficulty: difficulties.reduce(
            (acc, difficulty) => ({
              ...acc,
              [difficulty]: mine.filter((q) => q.difficulty === difficulty).length
            }),
            {} as Record<string, number>
          )
        };
      })
      .sort((a, b) => String(a.content_title || a.title).localeCompare(String(b.content_title || b.title)))
  };
}

async function loadQuestionBank(db: Db, courseId: string, value: unknown) {
  const bankId = cleanUuid(value, "question bank id");
  const { data, error } = await db
    .from("question_banks")
    .select("id, title, content_item_id, bank_type, status")
    .eq("id", bankId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "active") throw new Error("That question bank is not active.");
  return data;
}

async function listQuestions(db: Db, courseId: string, body: Record<string, unknown>) {
  const bank = await loadQuestionBank(db, courseId, body.question_bank_id);
  const { data, error } = await db
    .from("questions")
    .select("id, generation_key, prompt, prompt_es, explanation, explanation_es, difficulty, segment_key, source_pdf_pages, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide, suggested_slide_hint, suggested_topic, status, source, updated_at, question_options(id, option_text, option_text_es, is_correct, position)")
    .eq("question_bank_id", bank.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return {
    bank_id: bank.id,
    bank_title: bank.title,
    questions: (data || []).map((question) => ({
      ...question,
      source_pdf_pages: Array.isArray(question.source_pdf_pages)
        ? question.source_pdf_pages
        : [],
      question_options: (question.question_options || [])
        .slice()
        .sort((a, b) => Number(a.position) - Number(b.position))
    }))
  };
}

async function loadQuestionForEdit(db: Db, courseId: string, body: Record<string, unknown>) {
  const bank = await loadQuestionBank(db, courseId, body.question_bank_id);
  const questionId = cleanUuid(body.question_id, "question id");
  const { data: question, error } = await db
    .from("questions")
    .select("id, question_bank_id, generation_key, prompt, prompt_es, explanation, explanation_es, difficulty, segment_key, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide, status")
    .eq("id", questionId)
    .eq("question_bank_id", bank.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!question) throw new Error("That question is no longer active.");
  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("id, option_text, option_text_es, is_correct, position")
    .eq("question_id", questionId)
    .order("position", { ascending: true });
  if (optionError) throw optionError;
  if ((options || []).length !== 4) throw new Error("This question does not have four editable options.");
  return { bank, question, options: options || [] };
}

function editedQuestionInput(
  current: Record<string, any>,
  currentOptions: Array<Record<string, any>>,
  body: Record<string, unknown>
) {
  const submittedOptions = Array.isArray(body.options)
    ? body.options
    : currentOptions.map((option) => ({
      text: option.option_text,
      text_es: option.option_text_es,
      is_correct: option.is_correct
    }));
  return validateQuestion({
    key: current.generation_key,
    difficulty: body.difficulty ?? current.difficulty,
    prompt: body.prompt ?? current.prompt,
    prompt_es: body.prompt_es ?? current.prompt_es,
    explanation: body.explanation ?? current.explanation,
    explanation_es: body.explanation_es ?? current.explanation_es,
    segment_key: current.segment_key,
    source_slide_numbers: current.source_slide_numbers,
    source_slide_start: current.source_slide_start,
    source_slide_end: current.source_slide_end,
    checkpoint_after_slide: current.checkpoint_after_slide,
    options: submittedOptions
  }, 0);
}

async function updateQuestion(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const { bank, question, options } = await loadQuestionForEdit(db, courseId, body);
  const edited = editedQuestionInput(question, options, body);
  const now = new Date().toISOString();
  const { error: questionError } = await db
    .from("questions")
    .update({
      prompt: edited.prompt,
      prompt_es: edited.prompt_es,
      explanation: edited.explanation,
      explanation_es: edited.explanation_es,
      difficulty: edited.difficulty,
      source: "generated_edited",
      updated_at: now
    })
    .eq("id", question.id)
    .eq("question_bank_id", bank.id);
  if (questionError) throw questionError;

  for (let index = 0; index < options.length; index += 1) {
    const option = edited.options[index];
    const { error: optionError } = await db
      .from("question_options")
      .update({
        option_text: option.text,
        option_text_es: option.text_es,
        is_correct: option.is_correct,
        position: index,
        updated_at: now
      })
      .eq("id", options[index].id)
      .eq("question_id", question.id);
    if (optionError) throw optionError;
  }

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "question",
    target_id: question.id,
    action: "question_edited",
    metadata: { question_bank_id: bank.id, generation_key: question.generation_key }
  });
  return { question_id: question.id, bank_id: bank.id, updated: true };
}

async function deleteQuestion(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const { bank, question } = await loadQuestionForEdit(db, courseId, body);
  const { error } = await db
    .from("questions")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", question.id)
    .eq("question_bank_id", bank.id);
  if (error) throw error;
  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "question",
    target_id: question.id,
    action: "question_archived",
    metadata: { question_bank_id: bank.id, generation_key: question.generation_key }
  });
  return { question_id: question.id, bank_id: bank.id, deleted: true };
}

async function deleteBank(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const bankId = cleanUuid(body.question_bank_id, "question bank id");
  const { data: bank, error } = await db
    .from("question_banks")
    .select("id, title")
    .eq("id", bankId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!bank) throw new Error("Question bank not found.");

  // Fetched before the delete — once delete_question_bank_atomic succeeds,
  // this bank's questions are gone and the count can no longer be read.
  const { count: questionCount, error: questionCountError } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("question_bank_id", bankId)
    .eq("status", "active");
  if (questionCountError) throw questionCountError;

  const { error: deleteError } = await db.rpc("delete_question_bank_atomic", {
    p_bank_id: bankId,
    p_course_id: courseId,
    p_force: Boolean(body.force)
  });
  if (deleteError) {
    if (String(deleteError.message || "").includes("question_bank_not_found")) {
      throw new Error("Question bank not found.");
    }
    if (String(deleteError.message || "").includes("question_bank_in_use_by_live_class")) {
      throw new Error("This bank is being used by a class that is currently live and can't be deleted.");
    }
    if (String(deleteError.code) === "23503") {
      throw new Error("This bank has recorded student answers or live question history and can't be deleted.");
    }
    throw deleteError;
  }

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "question_bank",
    target_id: bank.id,
    action: "question_bank_deleted",
    metadata: { title: bank.title, question_count: questionCount || 0, force: Boolean(body.force) }
  });

  return { question_bank_id: bank.id, deleted: true };
}

async function drawQuestion(db: Db, courseId: string, body: Record<string, unknown>) {
  const slug = String(body.content_slug || "").trim();
  const item = await loadContentItem(db, courseId, slug);
  const difficulty = String(body.difficulty || "").trim();
  if (difficulty && !difficulties.includes(difficulty)) {
    throw new Error("Difficulty must be easy, medium or hard.");
  }
  const exclude = Array.isArray(body.exclude_keys)
    ? body.exclude_keys.map((key) => String(key)).slice(0, 200)
    : [];
  let checkpointAfterSlide: number | null = null;
  if (
    body.checkpoint_after_slide !== undefined
    && body.checkpoint_after_slide !== null
    && String(body.checkpoint_after_slide).trim() !== ""
  ) {
    checkpointAfterSlide = Number(body.checkpoint_after_slide);
    if (!Number.isInteger(checkpointAfterSlide) || checkpointAfterSlide < 1) {
      throw new Error("The checkpoint slide must be a positive integer.");
    }
  }

  const { data: bank, error: bankError } = await db
    .from("question_banks")
    .select("id")
    .eq("course_id", courseId)
    .eq("content_item_id", item.id)
    .eq("status", "active")
    .maybeSingle();
  if (bankError) throw bankError;
  if (!bank) throw new Error("This lecture has no question bank yet.");

  let query = db
    .from("questions")
    .select("id, prompt, prompt_es, difficulty, generation_key, explanation, explanation_es, segment_key, source_slide_numbers, source_slide_start, source_slide_end, checkpoint_after_slide")
    .eq("question_bank_id", bank.id)
    .eq("status", "active");
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (checkpointAfterSlide !== null) {
    query = query.eq("checkpoint_after_slide", checkpointAfterSlide);
  }
  const { data: candidates, error: candidateError } = await query;
  if (candidateError) throw candidateError;

  const pool = (candidates || []).filter(
    (question) => !exclude.includes(String(question.generation_key))
  );
  const usable = pool.length ? pool : candidates || [];
  if (!usable.length) throw new Error("No questions match that difficulty yet.");
  const picked = usable[Math.floor(Math.random() * usable.length)];

  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("id, option_text, option_text_es, is_correct, position")
    .eq("question_id", picked.id)
    .order("position", { ascending: true });
  if (optionError) throw optionError;

  return {
    question: {
      question_id: picked.id,
      generation_key: picked.generation_key,
      difficulty: picked.difficulty,
      segment_key: picked.segment_key,
      source_slide_numbers: picked.source_slide_numbers,
      source_slide_start: picked.source_slide_start,
      source_slide_end: picked.source_slide_end,
      checkpoint_after_slide: picked.checkpoint_after_slide,
      prompt: picked.prompt,
      prompt_es: picked.prompt_es,
      explanation: picked.explanation,
      explanation_es: picked.explanation_es,
      options: (options || []).map((option) => ({
        key: String(option.id),
        text: option.option_text,
        text_es: option.option_text_es,
        is_correct: option.is_correct
      }))
    },
    remaining: pool.length
  };
}
