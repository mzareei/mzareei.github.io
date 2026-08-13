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
import {
  checkpointMetadataFromQuestion,
  validateCheckpointMetadata,
  validateFlexibleQuestionBank
} from "../_shared/checkpoints.ts";
import { validateTeachingBrief, validateTeachingPlan } from "../_shared/generation-plan.ts";
import { assembleDeck, type Slide } from "./deck.ts";
import {
  matchesFinalizedGeneration,
  type FinalizationExpectation
} from "./finalization.ts";
import { approvedQuestionContexts, normalizeGeneratedQuestions } from "./questions.ts";
import {
  BANK_ONLY_QUESTIONS_SCHEMA,
  DECK_QUESTIONS_SCHEMA,
  PLAN_SCHEMA,
  SLIDES_SCHEMA
} from "./schemas.ts";

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
    // itself, never directly by a browser. The shared secret keeps it that way —
    // and an UNSET secret must refuse everyone, not admit everyone: this guard
    // shipped fail-open once and left the Anthropic-spending worker reachable
    // with the public anon key.
    const secret = Deno.env.get("GENERATION_WORKER_SECRET") || "";
    if (!secret || String(body.secret || "") !== secret) {
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
    return json({ error: errorMessage(error, "The generation worker failed.") }, { status: 400 });
  }
});

async function loadJob(db: Db, jobId: string) {
  const { data, error } = await db.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That generation job was not found.");
  return data as Record<string, unknown>;
}

async function saveStepIfStatus(
  db: Db,
  jobId: string,
  expectedStatus: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await db
    .from("generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", expectedStatus)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

async function failJob(db: Db, jobId: string, expectedStatus: string, message: string) {
  return saveStepIfStatus(db, jobId, expectedStatus, {
    status: "failed",
    error: message.slice(0, 2000)
  });
}

function currentJobOutcome(jobId: string, job: Record<string, unknown>) {
  const currentStatus = String(job.status);
  const done = ["ready_for_plan_review", "ready_for_review", "approved", "failed"]
    .includes(currentStatus);
  return {
    job_id: jobId,
    status: currentStatus,
    done,
    ...(done ? {} : { superseded: true })
  };
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

  if (["ready_for_plan_review", "ready_for_review", "approved", "failed"].includes(status)) {
    return { job_id: jobId, status, done: true };
  }

  const attempts = Number(job.attempt_count || 0);
  if (attempts >= maxAttemptsPerStep * 6) {
    const failed = await failJob(db, jobId, status, "Too many retries; giving up.");
    return failed
      ? { job_id: jobId, status: "failed", done: true }
      : currentJobOutcome(jobId, await loadJob(db, jobId));
  }

  try {
    let nextStatus = status;
    switch (status) {
      case "queued":
        await stepExtractProposal(db, job, stepState, status);
        nextStatus = "ready_for_plan_review";
        break;
      case "extracting":
        await stepExtractProposal(db, job, stepState, status);
        nextStatus = "ready_for_plan_review";
        break;
      case "generating_deck":
        if (job.generation_mode === "bank_only") {
          nextStatus = "generating_questions";
          break;
        }
        await stepSlides(db, job, stepState, status);
        nextStatus = "generating_questions";
        break;
      case "generating_questions":
        await stepQuestions(db, job, stepState, status);
        nextStatus = "grounding";
        break;
      case "grounding":
        await stepGrounding(db, job, stepState, status);
        nextStatus = "assembling";
        break;
      case "assembling":
        await stepAssemble(db, job, stepState);
        // The transactional finalizer has already persisted the bundle,
        // switched source_ref, and marked the job ready. There must be no
        // fallible write after it succeeds: otherwise a catch below could mark
        // a published bundle failed.
        return { job_id: jobId, status: "ready_for_review", done: true };
      default:
        throw new Error(`Unexpected job status "${status}".`);
    }

    const transitioned = await saveStepIfStatus(db, jobId, status, {
      status: nextStatus,
      attempt_count: 0,
      error: null
    });
    if (!transitioned) return currentJobOutcome(jobId, await loadJob(db, jobId));
    if (!["ready_for_plan_review", "ready_for_review"].includes(nextStatus)) chain(jobId);
    return { job_id: jobId, status: nextStatus, done: nextStatus === "ready_for_review" };
  } catch (error) {
    const message = errorMessage(error, "Step failed.");
    const nextAttempts = attempts + 1;
    const current = await loadJob(db, jobId);
    if (String(current.status) !== status) {
      return currentJobOutcome(jobId, current);
    }
    if (nextAttempts >= maxAttemptsPerStep) {
      const failed = await failJob(db, jobId, status, message);
      if (failed) {
        return { job_id: jobId, status: "failed", error: message, done: true };
      }
      return currentJobOutcome(jobId, await loadJob(db, jobId));
    }
    const retrying = await saveStepIfStatus(db, jobId, status, {
      attempt_count: nextAttempts,
      error: message.slice(0, 2000)
    });
    if (!retrying) return currentJobOutcome(jobId, await loadJob(db, jobId));
    return { job_id: jobId, status, error: message, retrying: true, done: false };
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ------------------------------------------------------------------ step 1
/** Read the PDF and pull out the lecture's structure and teaching content. */
async function stepExtractProposal(
  db: Db,
  job: Record<string, unknown>,
  stepState: Record<string, unknown>,
  expectedStatus: string
) {
  if (stepState.proposed_plan) return;

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

  const teachingBrief = validateTeachingBrief(job.teaching_brief);
  const proposedPlan = validateTeachingPlan(await generateStructured({
    system:
      "The uploaded PDF is the complete source of truth. The typed title is a display label only. " +
      "List every PDF page in order, including title, agenda, reference and administrative pages. " +
      "Do not add, omit, reorder, or infer curriculum. " +
      "Read the PDF and extract what is actually taught: concepts, definitions, examples, " +
      "figures and cases. Never invent facts, statistics, citations or company names that " +
      "are not in the source. If a number appears without a source, flag it in figure_notes " +
      "rather than presenting it as established. Write in clear, plain academic English.",
    content: [
      pdfBlock(base64),
      textBlock(JSON.stringify({ teaching_brief: teachingBrief })),
      textBlock(
        `This is the source material for a lecture titled "${job.lecture_title}". ` +
        "Extract its structure and teaching content so a slide deck can be built from it."
      )
    ],
    toolName: "record_outline",
    toolDescription: "Record the extracted structure and teaching content of the lecture.",
    schema: PLAN_SCHEMA,
    maxTokens: 8000
  }));

  const saved = await saveStepIfStatus(db, String(job.id), expectedStatus, {
    proposed_plan: proposedPlan,
    grounding_status: "pending",
    step_state: { ...stepState, proposed_plan: proposedPlan }
  });
  if (!saved) throw new Error("Job status changed while saving the extracted plan.");
}

// ------------------------------------------------------------------ step 2
/** Turn the outline into concrete bilingual slides. */
async function stepSlides(
  db: Db,
  job: Record<string, unknown>,
  stepState: Record<string, unknown>,
  expectedStatus: string
) {
  if (stepState.slides) {
    const cachedSlides = asArray<Slide>(stepState.slides);
    const cachedProblems = validateSlides(cachedSlides);
    if (cachedProblems.length) {
      throw new Error(`Generated slides rejected: ${cachedProblems.slice(0, 5).join("; ")}`);
    }
    return;
  }
  const outline = validateTeachingPlan(job.approved_plan);

  const result = await generateStructured({
    system:
      "You write university lecture decks. Turn the outline into slides that TEACH rather " +
      "than transcribe: add a concrete example, an analogy, or a discussion question where " +
      "it helps understanding, especially debate-sparking ones. Every slide needs both " +
      "English and Spanish (Mexican academic register). Keep each slide to one idea and " +
      "keep bullets short — they are projected, not read. Do not invent facts or numbers " +
      "beyond the source material. Open with a title slide and close with a summary slide.",
    content: [
      textBlock(JSON.stringify({ teaching_brief: job.teaching_brief, approved_plan: outline })),
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

  const slides = asArray<Slide>(result.slides);
  if (!slides.length) throw new Error("The model returned no slides; retrying.");
  const slideProblems = validateSlides(slides);
  if (slideProblems.length) {
    throw new Error(`Generated slides rejected: ${slideProblems.slice(0, 5).join("; ")}`);
  }

  const saved = await saveStepIfStatus(db, String(job.id), expectedStatus, {
    step_state: { ...stepState, slides }
  });
  if (!saved) throw new Error("Job status changed while saving generated slides.");
}

// ------------------------------------------------------------------ step 3
/** Build a flexible bilingual bank from the instructor-approved PDF plan. */
async function stepQuestions(
  db: Db,
  job: Record<string, unknown>,
  stepState: Record<string, unknown>,
  expectedStatus: string
) {
  if (stepState.questions) return;
  const slides = asArray<Slide>(stepState.slides);
  const approvedPlan = validateTeachingPlan(job.approved_plan);
  const bankOnly = job.generation_mode === "bank_only";
  if (!bankOnly && !slides.length) {
    throw new Error("Finalized slides are missing; re-run deck generation.");
  }
  const questionContexts = approvedQuestionContexts(approvedPlan);
  const contextInstructions =
    "Use exactly the approved question contexts and their segment keys. " +
    "When candidateGoal is present, generate that many questions for the context; " +
    "do not invent additional checkpoint groups.";
  const modeContent = bankOnly
    ? [
      textBlock(JSON.stringify({
        teaching_brief: job.teaching_brief,
        approved_plan: approvedPlan,
        approved_question_contexts: questionContexts
      })),
      textBlock(
        `Lecture label: ${job.lecture_title}\n\n` +
        `${contextInstructions} Generate from the approved PDF curriculum only. ` +
        "Cite source_pdf_pages and segment_key. There is no generated slide deck, " +
        "so do not create or cite slide numbers or slide checkpoints."
      )
    ]
    : [
      textBlock(JSON.stringify({
        teaching_brief: job.teaching_brief,
        approved_plan: approvedPlan,
        approved_question_contexts: questionContexts
      })),
      textBlock(
        `Lecture label: ${job.lecture_title}\n\n` +
        `Finalized teaching slides:\n${JSON.stringify(slides, null, 2)}\n\n` +
        `${contextInstructions} Cite source_pdf_pages and the finalized slides containing ` +
        "the answer. The worker will deterministically align each question with its approved " +
        "checkpoint suggestion; use no facts outside those cited sources."
      )
    ];

  const result = await generateStructured({
    system:
      "You write multiple-choice questions for a university course. Rules, without exception: " +
      "exactly 4 options; exactly 1 correct; the three distractors must be genuinely " +
      "plausible to someone who half-understands the material (common misconceptions, " +
      "adjacent concepts, right idea applied to the wrong thing) — never filler or joke " +
      "answers, and never all-of-the-above. Every question must be answerable purely from " +
      "the lecture content given. Write each question and every option in both English and " +
      "Spanish. Vary what you assess: recall for easy, application for medium, analysis or " +
      "a scenario judgement for hard. Do not reuse the same stem across difficulties. " +
      "Use no facts outside the approved PDF curriculum and cited source pages.",
    content: modeContent,
    toolName: "record_questions",
    toolDescription: "Record the tiered bilingual question bank for this lecture.",
    schema: bankOnly ? BANK_ONLY_QUESTIONS_SCHEMA : DECK_QUESTIONS_SCHEMA,
    maxTokens: 16000
  });

  const questions = normalizeGeneratedQuestions({
    mode: bankOnly ? "bank_only" : "deck_and_bank",
    questions: asArray<Record<string, unknown>>(result.questions),
    plan: approvedPlan,
    slides
  });
  const sourcePdfPages = approvedPlan.source_pages.map((page) => page.source_pdf_page);
  const problems = bankOnly
    ? validateQuestions(questions, sourcePdfPages)
    : validateDeckQuestions(questions, sourcePdfPages, slides.length);
  if (problems.length) throw new Error(`Generated questions rejected: ${problems.slice(0, 5).join("; ")}`);

  const saved = await saveStepIfStatus(db, String(job.id), expectedStatus, {
    step_state: { ...stepState, questions }
  });
  if (!saved) throw new Error("Job status changed while saving generated questions.");
}

/** The tool schema asks for an array, but a model can still answer with a bare
 *  object or a wrapper. Coerce rather than letting `.forEach` explode with an
 *  error the instructor can make no sense of. */
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const inner = Object.values(value as Record<string, unknown>).find(Array.isArray);
    if (inner) return inner as T[];
  }
  return [];
}

function validateSlides(slides: Slide[]) {
  const problems: string[] = [];
  slides.forEach((slide, index) => {
    if (slide.slide_number !== index + 1) {
      problems.push(
        `slide ${index + 1} has slide_number ${String(slide.slide_number)} instead of ${index + 1}`
      );
    }
  });
  return problems;
}

function validateQuestions(questions: Record<string, unknown>[], sourcePdfPages: number[]) {
  const problems: string[] = [];
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
  problems.push(...validateFlexibleQuestionBank(questions, sourcePdfPages));
  return problems;
}

function validateDeckQuestions(
  questions: Record<string, unknown>[],
  sourcePdfPages: number[],
  teachingSlideCount: number
) {
  const problems = validateQuestions(questions, sourcePdfPages);
  questions.forEach((question, index) => {
    for (const problem of validateCheckpointMetadata(
      checkpointMetadataFromQuestion(question),
      teachingSlideCount
    )) {
      problems.push(`Q${index + 1}: ${problem}`);
    }
  });
  return problems;
}

async function stepGrounding(
  db: Db,
  job: Record<string, unknown>,
  stepState: Record<string, unknown>,
  expectedStatus: string
) {
  const plan = validateTeachingPlan(job.approved_plan);
  const slides = asArray<Slide>(stepState.slides);
  const questions = asArray<Record<string, unknown>>(stepState.questions);
  if (job.generation_mode === "deck_and_bank" && !slides.length) throw new Error("Generated slides are missing.");
  const { data: upload, error: uploadError } = await db.from("content_uploads")
    .select("storage_path").eq("id", job.content_upload_id).maybeSingle();
  if (uploadError || !upload) throw uploadError || new Error("The uploaded PDF row is missing.");
  const { data: blob, error: downloadError } = await db.storage.from(bucket).download(String(upload.storage_path));
  if (downloadError) throw downloadError;
  const base64 = toBase64(new Uint8Array(await blob.arrayBuffer()));
  const grounding = await generateStructured({
    system: "Independently verify every PDF page/order/source mapping and reject unsupported or reordered generated content.",
    content: [pdfBlock(base64), textBlock(JSON.stringify({ approved_plan: plan, slides, questions }))],
    toolName: "verify_pdf_grounding",
    toolDescription: "Verify generated output against its original PDF.",
    schema: { type: "object", properties: { passed: { type: "boolean" }, problems: { type: "array", items: { type: "string" } } }, required: ["passed", "problems"] },
    maxTokens: 4000
  });
  const groundingProblems = Array.isArray(grounding.problems)
    ? grounding.problems.map(String)
    : [];
  if (grounding.passed !== true) {
    throw new Error(
      "Generated output rejected by PDF grounding: "
      + (groundingProblems.join("; ") || "independent grounding did not pass")
    );
  }
  const sourcePdfPages = plan.source_pages.map((page) => page.source_pdf_page);
  const problems = job.generation_mode === "bank_only"
    ? validateQuestions(questions, sourcePdfPages)
    : validateDeckQuestions(questions, sourcePdfPages, slides.length);
  if (problems.length) throw new Error("Generated output rejected by PDF grounding: " + problems.join("; "));
  if (job.generation_mode === "deck_and_bank") {
    const html = await assembleDeck({ title: String(job.lecture_title), slides, checkpoints: [] });
    const stagingPath = "courses/" + String(job.course_id) + "/generation/" + String(job.id) + "/deck.html";
    const { error } = await db.storage.from(bucket).upload(
      stagingPath, new Blob([html], { type: "text/html; charset=utf-8" }),
      { contentType: "text/html; charset=utf-8", upsert: true }
    );
    if (error) throw error;
    stepState.staging_deck_path = stagingPath;
  }
  const saved = await saveStepIfStatus(db, String(job.id), expectedStatus, {
    grounding_status: "passed",
    step_state: stepState
  });
  if (!saved) throw new Error("Job status changed while saving grounding results.");
}

// ------------------------------------------------------------------ step 4
/** Assemble the single-file deck, upload it, and persist item + bank. */
async function stepAssemble(db: Db, job: Record<string, unknown>, stepState: Record<string, unknown>) {
  const slides = asArray<Slide>(stepState.slides);
  const questions = asArray<Record<string, unknown>>(stepState.questions);
  if (job.generation_mode === "bank_only") return stepAssembleBankOnly(db, job, stepState, questions);
  if (!slides.length) throw new Error("Slides are missing; re-run deck generation.");
  if (!questions.length) throw new Error("Questions are missing; re-run question generation.");
  const slideProblems = validateSlides(slides);
  if (slideProblems.length) {
    throw new Error(
      `Generated slides rejected before persistence: ${slideProblems.slice(0, 5).join("; ")}`
    );
  }
  const questionProblems = validateDeckQuestions(
    questions,
    validateTeachingPlan(job.approved_plan).source_pages.map((page) => page.source_pdf_page),
    slides.length
  );
  if (questionProblems.length) {
    throw new Error(
      `Generated questions rejected before persistence: ${questionProblems.slice(0, 5).join("; ")}`
    );
  }

  const stagingDeckPath = String(stepState.staging_deck_path || "");
  if (!stagingDeckPath) throw new Error("The grounded staged deck is missing.");
  const priorVersion = await preparePriorVersion(db, job, stagingDeckPath);
  await finalizeOrReconcile(db, {
    jobId: String(job.id),
    mode: "deck_and_bank",
    stagingDeckPath
  }, {
    p_job_id: job.id,
    p_staging_deck_path: stagingDeckPath,
    p_questions: questions,
    p_prior_version: priorVersion
  });
}

async function stepAssembleBankOnly(
  db: Db, job: Record<string, unknown>, stepState: Record<string, unknown>, questions: Record<string, unknown>[]
) {
  if (!questions.length) throw new Error("Questions are missing; re-run question generation.");
  const questionProblems = validateQuestions(
    questions,
    validateTeachingPlan(job.approved_plan).source_pages.map((page) => page.source_pdf_page)
  );
  if (questionProblems.length) {
    throw new Error(
      `Generated questions rejected before persistence: ${questionProblems.slice(0, 5).join("; ")}`
    );
  }
  await finalizeOrReconcile(db, {
    jobId: String(job.id),
    mode: "bank_only",
    stagingDeckPath: null
  }, {
    p_job_id: job.id,
    p_staging_deck_path: null,
    p_questions: questions,
    p_prior_version: null
  });
}

async function finalizeOrReconcile(
  db: Db,
  expected: FinalizationExpectation,
  parameters: Record<string, unknown>
) {
  let rpcError: unknown = null;
  try {
    const { error } = await db.rpc("finalize_pdf_generation_bundle", parameters);
    rpcError = error;
  } catch (error) {
    rpcError = error;
  }
  if (!rpcError) return;

  const finalized = await reconcileFinalization(db, expected);
  if (!finalized) throw rpcError;
}

async function reconcileFinalization(db: Db, expected: FinalizationExpectation) {
  const job = await loadJob(db, expected.jobId);
  const bankId = String(job.question_bank_id || "");
  let questionBank: Record<string, unknown> | null = null;
  if (bankId) {
    const { data, error } = await db
      .from("question_banks")
      .select("id, generation_job_id")
      .eq("id", bankId)
      .eq("generation_job_id", expected.jobId)
      .maybeSingle();
    if (error) throw error;
    questionBank = data as Record<string, unknown> | null;
  }

  const contentItemId = String(job.content_item_id || "");
  let contentItem: Record<string, unknown> | null = null;
  if (contentItemId) {
    const { data, error } = await db
      .from("content_items")
      .select("id, generation_job_id, source_ref")
      .eq("id", contentItemId)
      .eq("generation_job_id", expected.jobId)
      .maybeSingle();
    if (error) throw error;
    contentItem = data as Record<string, unknown> | null;
  }

  return matchesFinalizedGeneration({ job, contentItem, questionBank }, expected)
    ? job
    : null;
}

async function preparePriorVersion(
  db: Db,
  job: Record<string, unknown>,
  stagingDeckPath: string
) {
  const courseId = String(job.course_id);
  const slug = String(job.lecture_slug);
  const { data: existingItem, error: itemError } = await db
    .from("content_items")
    .select("id, owner_profile_id, source_ref")
    .eq("course_id", courseId)
    .eq("slug", slug)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!existingItem || String(existingItem.source_ref) === stagingDeckPath) return null;

  const generatedBy = job.created_by ? String(job.created_by) : null;
  if (
    existingItem.owner_profile_id != null
    && generatedBy
    && String(existingItem.owner_profile_id) !== generatedBy
  ) {
    throw new Error("generation_slug_not_owned");
  }

  const sourceRef = String(existingItem.source_ref);
  const { data: priorBlob, error: downloadError } = await db.storage.from(bucket).download(sourceRef);
  if (downloadError || !priorBlob) {
    throw downloadError || new Error("The currently served deck could not be snapshotted.");
  }
  const priorBytes = new Uint8Array(await priorBlob.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", priorBytes);
  const sha = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const backupPath = `courses/${courseId}/items/${slug}/.versions/generated-${job.id}-${sha.slice(0, 8)}.html`;
  const { error: backupError } = await db.storage.from(bucket).upload(
    backupPath,
    new Blob([priorBytes], { type: "text/html; charset=utf-8" }),
    { contentType: "text/html; charset=utf-8", upsert: true }
  );
  if (backupError) throw backupError;

  return {
    source_ref: sourceRef,
    storage_path: backupPath,
    content_sha256: sha,
    content_bytes: priorBytes.byteLength
  };
}
