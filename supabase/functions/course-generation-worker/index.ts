// Turns an uploaded lecture PDF into a web deck + a tiered bilingual question
// bank, one resumable step per invocation.
//
// Each step writes its output into generation_jobs.step_state before advancing
// the status, so a crash, a timeout, or a cold start resumes from the last
// completed step instead of re-spending Claude API calls. After finishing a
// step the worker re-invokes itself for the next one, so a job runs to
// completion without any cron; `advance` can also be called directly (the
// Content screen polls and nudges it, which is what makes progress visible).
//
// Nothing produced here is visible to students. The job ends at
// 'ready_for_review'; course-generation's approve() is the only thing that
// activates the bank and creates a (still draft) release.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { generateStructured, hasAnthropicKey, pdfBlock, textBlock, toBase64 } from "../_shared/anthropic.ts";
import { assembleDeck, type Slide } from "./deck.ts";
import { OUTLINE_SCHEMA, SLIDES_SCHEMA, QUESTIONS_SCHEMA } from "./schemas.ts";

type Db = ReturnType<typeof adminClient>;

const bucket = "course-content";
const maxAttemptsPerStep = 3;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json().catch(() => ({}));
    const db = adminClient();

    // Service-role only: this endpoint is invoked by course-generation and by
    // itself, never directly by a browser. The shared secret keeps it that way.
    const secret = Deno.env.get("GENERATION_WORKER_SECRET");
    if (secret && String(body.secret || "") !== secret) {
      return json({ error: "Not allowed." }, { status: 403 });
    }

    if (body.action === "health") {
      return json({ ok: true, anthropic_key_configured: hasAnthropicKey() });
    }

    const jobId = String(body.job_id || "").trim();
    if (!jobId) return json({ error: "A job id is required." }, { status: 400 });

    const result = await advance(db, jobId);
    return json(result);
  } catch (error) {
    return json({ error: error?.message || "The generation worker failed." }, { status: 400 });
  }
});

async function loadJob(db: Db, jobId: string) {
  const { data, error } = await db.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That generation job was not found.");
  return data as Record<string, unknown>;
}

async function saveStep(db: Db, jobId: string, patch: Record<string, unknown>) {
  const { error } = await db
    .from("generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

async function failJob(db: Db, jobId: string, message: string) {
  await saveStep(db, jobId, { status: "failed", error: message.slice(0, 2000) });
}

/** Fire-and-forget self-invocation so a job keeps moving without a cron. */
function chain(jobId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/course-generation-worker`;
  const secret = Deno.env.get("GENERATION_WORKER_SECRET") || "";
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: jobId, secret })
  }).catch(() => {});
}

async function advance(db: Db, jobId: string) {
  const job = await loadJob(db, jobId);
  const status = String(job.status);
  const stepState = (job.step_state || {}) as Record<string, unknown>;

  if (["ready_for_review", "approved", "failed"].includes(status)) {
    return { job_id: jobId, status, done: true };
  }

  const attempts = Number(job.attempt_count || 0);
  if (attempts >= maxAttemptsPerStep * 6) {
    await failJob(db, jobId, "Too many retries; giving up.");
    return { job_id: jobId, status: "failed", done: true };
  }

  try {
    let nextStatus = status;
    switch (status) {
      case "queued":
        await stepExtract(db, job, stepState);
        nextStatus = "outlining";
        break;
      case "extracting":
        await stepExtract(db, job, stepState);
        nextStatus = "outlining";
        break;
      case "outlining":
        await stepSlides(db, job, stepState);
        nextStatus = "generating_questions";
        break;
      case "generating_deck":
        await stepSlides(db, job, stepState);
        nextStatus = "generating_questions";
        break;
      case "generating_questions":
        await stepQuestions(db, job, stepState);
        nextStatus = "assembling";
        break;
      case "assembling":
        await stepAssemble(db, job, stepState);
        nextStatus = "ready_for_review";
        break;
      default:
        throw new Error(`Unexpected job status "${status}".`);
    }

    await saveStep(db, jobId, { status: nextStatus, attempt_count: 0, error: null });
    if (nextStatus !== "ready_for_review") chain(jobId);
    return { job_id: jobId, status: nextStatus, done: nextStatus === "ready_for_review" };
  } catch (error) {
    const message = error?.message || "Step failed.";
    const nextAttempts = attempts + 1;
    if (nextAttempts >= maxAttemptsPerStep) {
      await failJob(db, jobId, message);
      return { job_id: jobId, status: "failed", error: message, done: true };
    }
    await saveStep(db, jobId, { attempt_count: nextAttempts, error: message.slice(0, 2000) });
    return { job_id: jobId, status, error: message, retrying: true };
  }
}

// ------------------------------------------------------------------ step 1
/** Read the PDF and pull out the lecture's structure and teaching content. */
async function stepExtract(db: Db, job: Record<string, unknown>, stepState: Record<string, unknown>) {
  if (stepState.outline) return; // already done, resuming

  const { data: upload, error } = await db
    .from("content_uploads")
    .select("storage_path, original_filename")
    .eq("id", job.content_upload_id)
    .maybeSingle();
  if (error) throw error;
  if (!upload) throw new Error("The uploaded PDF row is missing.");

  const { data: blob, error: downloadError } = await db.storage.from(bucket).download(String(upload.storage_path));
  if (downloadError) throw downloadError;
  const base64 = toBase64(new Uint8Array(await blob.arrayBuffer()));

  const outline = await generateStructured({
    system:
      "You are helping a university professor turn lecture slides into a teaching deck. " +
      "Read the PDF and extract what is actually taught: concepts, definitions, examples, " +
      "figures and cases. Never invent facts, statistics, citations or company names that " +
      "are not in the source. If a number appears without a source, flag it in figure_notes " +
      "rather than presenting it as established. Write in clear, plain academic English.",
    content: [
      pdfBlock(base64),
      textBlock(
        `This is the source material for a lecture titled "${job.lecture_title}". ` +
        "Extract its structure and teaching content so a slide deck can be built from it."
      )
    ],
    toolName: "record_outline",
    toolDescription: "Record the extracted structure and teaching content of the lecture.",
    schema: OUTLINE_SCHEMA,
    maxTokens: 8000
  });

  await saveStep(db, String(job.id), {
    step_state: { ...stepState, outline }
  });
}

// ------------------------------------------------------------------ step 2
/** Turn the outline into concrete bilingual slides. */
async function stepSlides(db: Db, job: Record<string, unknown>, stepState: Record<string, unknown>) {
  if (stepState.slides) return;
  const outline = stepState.outline;
  if (!outline) throw new Error("Outline is missing; re-run extraction.");

  const result = await generateStructured({
    system:
      "You write university lecture decks. Turn the outline into slides that TEACH rather " +
      "than transcribe: add a concrete example, an analogy, or a discussion question where " +
      "it helps understanding, especially debate-sparking ones. Every slide needs both " +
      "English and Spanish (Mexican academic register). Keep each slide to one idea and " +
      "keep bullets short — they are projected, not read. Do not invent facts or numbers " +
      "beyond the source material. Open with a title slide and close with a summary slide.",
    content: [
      textBlock(
        `Lecture title: ${job.lecture_title}\n\n` +
        `Extracted outline and content:\n${JSON.stringify(outline, null, 2)}\n\n` +
        "Produce 18-30 slides covering this material."
      )
    ],
    toolName: "record_slides",
    toolDescription: "Record the finished bilingual slide sequence for the deck.",
    schema: SLIDES_SCHEMA,
    maxTokens: 16000
  });

  const slides = (result.slides || []) as Slide[];
  if (!slides.length) throw new Error("No slides were generated.");

  await saveStep(db, String(job.id), { step_state: { ...stepState, slides } });
}

// ------------------------------------------------------------------ step 3
/** The tiered bilingual bank. Same contract as every hand-imported bank:
 *  4 options, exactly 1 correct, plausible distractors, 6 per difficulty. */
async function stepQuestions(db: Db, job: Record<string, unknown>, stepState: Record<string, unknown>) {
  if (stepState.questions) return;
  const outline = stepState.outline;
  if (!outline) throw new Error("Outline is missing; re-run extraction.");

  const result = await generateStructured({
    system:
      "You write multiple-choice questions for a university course. Rules, without exception: " +
      "exactly 4 options; exactly 1 correct; the three distractors must be genuinely " +
      "plausible to someone who half-understands the material (common misconceptions, " +
      "adjacent concepts, right idea applied to the wrong thing) — never filler or joke " +
      "answers, and never all-of-the-above. Every question must be answerable purely from " +
      "the lecture content given. Write each question and every option in both English and " +
      "Spanish. Vary what you assess: recall for easy, application for medium, analysis or " +
      "a scenario judgement for hard. Do not reuse the same stem across difficulties.",
    content: [
      textBlock(
        `Lecture title: ${job.lecture_title}\n\n` +
        `Lecture content:\n${JSON.stringify(outline, null, 2)}\n\n` +
        "Write exactly 6 easy, 6 medium and 6 hard questions (18 total)."
      )
    ],
    toolName: "record_questions",
    toolDescription: "Record the tiered bilingual question bank for this lecture.",
    schema: QUESTIONS_SCHEMA,
    maxTokens: 16000
  });

  const questions = (result.questions || []) as Record<string, unknown>[];
  const problems = validateQuestions(questions);
  if (problems.length) throw new Error(`Generated questions rejected: ${problems.slice(0, 5).join("; ")}`);

  await saveStep(db, String(job.id), { step_state: { ...stepState, questions } });
}

function validateQuestions(questions: Record<string, unknown>[]) {
  const problems: string[] = [];
  if (questions.length < 12) problems.push(`only ${questions.length} questions`);
  questions.forEach((question, index) => {
    const label = `Q${index + 1}`;
    const options = (question.options || []) as Record<string, unknown>[];
    if (options.length !== 4) problems.push(`${label} has ${options.length} options`);
    const correct = options.filter((option) => option.is_correct).length;
    if (correct !== 1) problems.push(`${label} has ${correct} correct options`);
    if (!String(question.prompt || "").trim()) problems.push(`${label} has no prompt`);
    if (!String(question.prompt_es || "").trim()) problems.push(`${label} has no Spanish prompt`);
    if (!["easy", "medium", "hard"].includes(String(question.difficulty))) {
      problems.push(`${label} has an invalid difficulty`);
    }
    options.forEach((option, optionIndex) => {
      if (!String(option.option_text || "").trim()) problems.push(`${label} option ${optionIndex + 1} is empty`);
      if (!String(option.option_text_es || "").trim()) {
        problems.push(`${label} option ${optionIndex + 1} has no Spanish text`);
      }
    });
  });
  return problems;
}

// ------------------------------------------------------------------ step 4
/** Assemble the single-file deck, upload it, and persist item + bank. */
async function stepAssemble(db: Db, job: Record<string, unknown>, stepState: Record<string, unknown>) {
  const courseId = String(job.course_id);
  const slug = String(job.lecture_slug);
  const slides = (stepState.slides || []) as Slide[];
  const questions = (stepState.questions || []) as Record<string, unknown>[];
  if (!slides.length) throw new Error("Slides are missing; re-run deck generation.");
  if (!questions.length) throw new Error("Questions are missing; re-run question generation.");

  // 1. Deck HTML into Storage, beside every other gated deck.
  const html = await assembleDeck({ title: String(job.lecture_title), slides });
  const storagePath = `courses/${courseId}/items/${slug}/deck.html`;
  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(storagePath, new Blob([html], { type: "text/html; charset=utf-8" }), {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
  if (uploadError) throw uploadError;

  // 2. content_item pointing at it.
  const { data: item, error: itemError } = await db
    .from("content_items")
    .upsert({
      course_id: courseId,
      slug,
      title: String(job.lecture_title),
      summary: String((stepState.outline as Record<string, unknown>)?.summary || "").slice(0, 500) || null,
      content_type: "lecture",
      source_kind: "storage_object",
      source_ref: storagePath,
      generation_job_id: job.id,
      updated_at: new Date().toISOString()
    }, { onConflict: "course_id,slug" })
    .select("id")
    .single();
  if (itemError) throw itemError;

  // 3. Question bank — created inactive; approve() flips it on.
  const { data: bank, error: bankError } = await db
    .from("question_banks")
    .upsert({
      course_id: courseId,
      content_item_id: item.id,
      title: `${job.lecture_title} — Question bank`,
      bank_type: "graded",
      status: "draft",
      generation_job_id: job.id,
      updated_at: new Date().toISOString()
    }, { onConflict: "course_id,content_item_id,bank_type" })
    .select("id")
    .single();
  if (bankError) throw bankError;

  // Regenerating replaces the whole set rather than appending duplicates.
  const { error: clearError } = await db
    .from("questions").delete().eq("question_bank_id", bank.id).eq("generation_job_id", job.id);
  if (clearError) throw clearError;

  for (const [index, question] of questions.entries()) {
    const { data: row, error: questionError } = await db
      .from("questions")
      .insert({
        question_bank_id: bank.id,
        prompt: String(question.prompt),
        prompt_es: String(question.prompt_es),
        question_type: "single_choice",
        difficulty: String(question.difficulty),
        topic_tags: (question.topic_tags as string[]) || [],
        points: 1,
        explanation: question.explanation ? String(question.explanation) : null,
        explanation_es: question.explanation_es ? String(question.explanation_es) : null,
        status: "draft",
        source: "generated",
        generation_key: `${slug}-gen-${index + 1}`,
        generation_job_id: job.id
      })
      .select("id")
      .single();
    if (questionError) throw questionError;

    const options = (question.options || []) as Record<string, unknown>[];
    const { error: optionError } = await db.from("question_options").insert(
      options.map((option, position) => ({
        question_id: row.id,
        option_text: String(option.option_text),
        option_text_es: String(option.option_text_es),
        is_correct: Boolean(option.is_correct),
        position
      }))
    );
    if (optionError) throw optionError;
  }

  await saveStep(db, String(job.id), {
    content_item_id: item.id,
    question_bank_id: bank.id,
    step_state: { ...stepState, assembled_at: new Date().toISOString(), deck_storage_path: storagePath }
  });

  await db.from("content_uploads")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", job.content_upload_id);
}
