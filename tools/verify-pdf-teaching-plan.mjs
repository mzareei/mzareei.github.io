import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.existsSync(path.join(root, relativePath))
  ? fs.readFileSync(path.join(root, relativePath), "utf8")
  : "";

const migration = read("supabase/migrations/0035_pdf_teaching_plans.sql");
const api = read("supabase/functions/course-generation/index.ts");
const helper = read("supabase/functions/_shared/generation-plan.ts");
const worker = read("supabase/functions/course-generation-worker/index.ts");
const deck = read("supabase/functions/course-generation-worker/deck.ts");
const checkpoints = read("supabase/functions/_shared/checkpoints.ts");
const { hasUsableQuestionContext } = await import(
  "../supabase/functions/_shared/generation-plan.ts"
);

const { assembleDeck } = await import(
  "../supabase/functions/course-generation-worker/deck.ts"
);
const {
  BANK_ONLY_QUESTIONS_SCHEMA,
  DECK_QUESTIONS_SCHEMA
} = await import("../supabase/functions/course-generation-worker/schemas.ts");

assert.ok(DECK_QUESTIONS_SCHEMA, "deck-and-bank generation needs its own question schema");
assert.ok(BANK_ONLY_QUESTIONS_SCHEMA, "bank-only generation needs its own question schema");
const deckQuestion = DECK_QUESTIONS_SCHEMA.properties.questions.items;
const bankOnlyQuestion = BANK_ONLY_QUESTIONS_SCHEMA.properties.questions.items;
for (const field of [
  "source_slide_numbers",
  "source_slide_start",
  "source_slide_end",
  "checkpoint_after_slide"
]) {
  assert.ok(deckQuestion.required.includes(field), `deck questions must require ${field}`);
  assert.equal(
    Object.hasOwn(bankOnlyQuestion.properties, field),
    false,
    `bank-only questions must not ask the model for ${field}`
  );
}

const { normalizeGeneratedQuestions } = await import(
  "../supabase/functions/course-generation-worker/questions.ts"
);
const { matchesFinalizedGeneration } = await import(
  "../supabase/functions/course-generation-worker/finalization.ts"
);

const finalizedDeckProof = {
  job: {
    id: "job-1",
    status: "ready_for_review",
    generation_mode: "deck_and_bank",
    content_item_id: "item-1",
    question_bank_id: "bank-1",
    step_state: { deck_storage_path: "courses/tc2007b/generation/job-1/deck.html" }
  },
  contentItem: {
    id: "item-1",
    generation_job_id: "job-1",
    source_ref: "courses/tc2007b/generation/job-1/deck.html"
  },
  questionBank: { id: "bank-1", generation_job_id: "job-1" }
};
const finalizedDeckExpectation = {
  jobId: "job-1",
  mode: "deck_and_bank",
  stagingDeckPath: "courses/tc2007b/generation/job-1/deck.html"
};
assert.equal(
  matchesFinalizedGeneration(finalizedDeckProof, finalizedDeckExpectation),
  true,
  "a matching committed finalization must reconcile a lost RPC response"
);
assert.equal(
  matchesFinalizedGeneration(
    {
      ...finalizedDeckProof,
      contentItem: {
        ...finalizedDeckProof.contentItem,
        source_ref: "courses/tc2007b/items/old/deck.html"
      }
    },
    finalizedDeckExpectation
  ),
  false,
  "a mismatched serving path must not be treated as finalized"
);
assert.equal(
  matchesFinalizedGeneration(
    { ...finalizedDeckProof, questionBank: null },
    finalizedDeckExpectation
  ),
  false,
  "a missing matching bank must not be treated as finalized"
);
assert.equal(
  matchesFinalizedGeneration(
    {
      job: {
        id: "job-2",
        status: "ready_for_review",
        generation_mode: "bank_only",
        content_item_id: null,
        question_bank_id: "bank-2",
        step_state: { deck_storage_path: null }
      },
      contentItem: null,
      questionBank: { id: "bank-2", generation_job_id: "job-2" }
    },
    { jobId: "job-2", mode: "bank_only", stagingDeckPath: null }
  ),
  true,
  "bank-only reconciliation must require its matching bank and no deck item"
);
const approvedPlan = {
  source_pages: [1, 2, 3, 4].map((source_pdf_page) => ({
    source_pdf_page,
    topic: `Topic ${source_pdf_page}`,
    topic_es: `Tema ${source_pdf_page}`,
    evidence: `Evidence ${source_pdf_page}`
  })),
  checkpoints: [{
    key: "multi-factor-authentication",
    topic: "Multi-factor authentication",
    source_pdf_pages: [2, 3],
    suggested_after_pdf_page: 3,
    candidate_goal: 2
  }],
  end_quiz_goal: 1
};
assert.equal(hasUsableQuestionContext(approvedPlan), true);
assert.equal(
  hasUsableQuestionContext({ ...approvedPlan, checkpoints: [], end_quiz_goal: 2 }),
  true,
  "an end quiz is a usable question-generation context"
);
assert.equal(
  hasUsableQuestionContext({ ...approvedPlan, checkpoints: [], end_quiz_goal: null }),
  false,
  "a plan with no checkpoints and no end quiz must be rejected before generation"
);
const finalizedSlides = [1, 2, 3, 4].map((slide_number) => ({
  slide_number,
  kind: slide_number === 1 ? "title" : "bullets",
  section: "Authentication",
  section_es: "Autenticación",
  heading: `Slide ${slide_number}`,
  heading_es: `Diapositiva ${slide_number}`,
  source_pdf_pages: [slide_number]
}));
const generatedQuestion = {
  prompt: "Which factor is independent?",
  prompt_es: "¿Qué factor es independiente?",
  difficulty: "medium",
  segment_key: "multi-factor-authentication",
  source_pdf_pages: [2],
  topic_tags: ["mfa"],
  options: [
    { option_text: "Knowledge", option_text_es: "Conocimiento", is_correct: true },
    { option_text: "Color", option_text_es: "Color", is_correct: false },
    { option_text: "Brand", option_text_es: "Marca", is_correct: false },
    { option_text: "Layout", option_text_es: "Diseño", is_correct: false }
  ]
};

const [deckQuestionMapping] = normalizeGeneratedQuestions({
  mode: "deck_and_bank",
  questions: [generatedQuestion],
  plan: approvedPlan,
  slides: finalizedSlides
});
assert.deepEqual(deckQuestionMapping.source_pdf_pages, [2]);
assert.deepEqual(deckQuestionMapping.source_slide_numbers, [2]);
assert.equal(deckQuestionMapping.source_slide_start, 2);
assert.equal(deckQuestionMapping.source_slide_end, 2);
assert.equal(deckQuestionMapping.checkpoint_after_slide, 3);

const [bankOnlyQuestionMapping] = normalizeGeneratedQuestions({
  mode: "bank_only",
  questions: [generatedQuestion],
  plan: approvedPlan,
  slides: []
});
assert.equal(bankOnlyQuestionMapping.segment_key, "multi-factor-authentication");
assert.deepEqual(bankOnlyQuestionMapping.source_pdf_pages, [2]);
for (const field of [
  "source_slide_numbers",
  "source_slide_start",
  "source_slide_end",
  "checkpoint_after_slide"
]) {
  assert.equal(Object.hasOwn(bankOnlyQuestionMapping, field), false);
}

const renderedDeck = await assembleDeck({
  title: "Grounded lecture",
  slides: [{
    slide_number: 1,
    kind: "title",
    section: "Introduction",
    section_es: "Introducción",
    heading: "Grounded topic",
    heading_es: "Tema fundamentado",
    source_pdf_pages: [2, 3]
  }],
  checkpoints: []
});

assert.match(
  renderedDeck,
  /<section class="slide title-slide active"[^>]*data-teaching-slide="1"[^>]*data-source-pdf-pages="2,3">/,
  "rendered teaching slides must expose their PDF-page provenance"
);
assert.doesNotMatch(
  renderedDeck,
  /<section class="slide checkpoint-slide"/,
  "generated decks must not embed automatic checkpoint slides"
);

assert.match(migration, /ready_for_plan_review/);
assert.match(migration, /generation_mode/);
assert.match(migration, /teaching_brief/);
assert.match(migration, /proposed_plan/);
assert.match(api, /case "review_plan"/);
assert.match(api, /case "approve_plan"/);
assert.match(
  api,
  /async function approvePlan[\s\S]*hasUsableQuestionContext\(approvedPlan\)/,
  "plan approval must reject an empty question-generation plan"
);
assert.match(helper, /function validateTeachingBrief/);
assert.match(helper, /function validateTeachingPlan/);
assert.match(worker, /stepExtractProposal/);
assert.match(worker, /nextStatus = "ready_for_plan_review"/);
assert.match(worker, /pdfBlock\(base64\)/);
assert.match(worker, /source_pdf_page/);
assert.match(worker, /title is a display label/i);
assert.doesNotMatch(worker, /Write exactly 18 questions/);
assert.match(worker, /async function stepGrounding/);
assert.match(worker, /grounding_status: "passed"/);
assert.match(worker, /generation_mode === "bank_only"/);
assert.match(worker, /generation\/.*deck\.html/);
assert.match(deck, /data-source-pdf-pages/);
assert.match(deck, /source_pdf_pages\.join/);
assert.match(checkpoints, /function validateFlexibleQuestionBank/);
assert.match(
  migration,
  /insert into public\.question_banks[\s\S]*generation_validation_profile[\s\S]*'flexible'/,
  "every newly generated bank must persist the flexible validation profile"
);
assert.match(
  migration,
  /insert into public\.questions[\s\S]*source_pdf_pages[\s\S]*source_slide_numbers/,
  "transactional persistence must retain PDF and slide provenance columns"
);
assert.match(worker, /staging_deck_path/);
assert.doesNotMatch(worker, /deckCheckpointsFromQuestions\(questions\)/);

const extractStart = worker.indexOf("async function stepExtractProposal(");
const slidesStart = worker.indexOf("async function stepSlides(");
assert.ok(extractStart >= 0 && slidesStart > extractStart, "proposal extraction must be present");
assert.match(
  worker.slice(extractStart, slidesStart),
  /textBlock\(JSON\.stringify\(\{\s*teaching_brief:\s*teachingBrief\s*\}\)\)/,
  "the teaching brief must be an explicit extraction proposal input"
);
assert.doesNotMatch(
  worker,
  /group them into 3–5 concept checkpoints/,
  "question grouping must come from the approved checkpoint plan"
);

const assembleStart = worker.indexOf("async function stepAssemble(");
const bankOnlyStart = worker.indexOf("async function stepAssembleBankOnly(");
assert.ok(assembleStart >= 0 && bankOnlyStart > assembleStart, "assembly functions must be present");
const deckAssembly = worker.slice(assembleStart, bankOnlyStart);
assert.match(
  deckAssembly,
  /finalizeOrReconcile\(db/,
  "deck publication must use one transactional database finalizer"
);
assert.doesNotMatch(
  deckAssembly,
  /items\/\$\{slug\}\/deck\.html|\.storage\s*\.from\(bucket\)\s*\.upload\(/s,
  "assembly must never overwrite a live deck object before durable writes finish"
);
assert.match(
  migration,
  /create or replace function public\.finalize_pdf_generation_bundle[\s\S]*source_ref\s*=\s*p_staging_deck_path[\s\S]*status\s*=\s*'ready_for_review'/,
  "the live source pointer and successful job state must commit in the same SQL transaction"
);
assert.match(
  migration,
  /grant execute on function public\.finalize_pdf_generation_bundle\(uuid, text, jsonb, jsonb\)\s+to service_role;/,
  "the service-role worker must be allowed to invoke the private finalizer"
);
assert.match(
  worker,
  /async function reconcileFinalization[\s\S]*matchesFinalizedGeneration/,
  "an RPC error must re-read and verify the durable finalization"
);
assert.match(
  worker,
  /async function finalizeOrReconcile[\s\S]*try \{[\s\S]*await db\.rpc[\s\S]*catch \(error\)[\s\S]*reconcileFinalization/,
  "returned and thrown RPC transport errors must both enter reconciliation"
);
assert.match(
  worker,
  /async function saveStepIfStatus[\s\S]*\.eq\("status", expectedStatus\)/,
  "error transitions must be conditional on the status originally loaded"
);
assert.doesNotMatch(
  worker,
  /saveStep\(db, jobId, \{ status: "failed"/,
  "a stale worker must never unconditionally mark a newer job state failed"
);

const cancelStart = api.indexOf("async function cancelJob(");
const reviewBundleStart = api.indexOf("async function reviewBundle(");
assert.ok(cancelStart >= 0 && reviewBundleStart > cancelStart, "cancellation handler must be present");
const cancellation = api.slice(cancelStart, reviewBundleStart);
assert.match(
  cancellation,
  /const expectedStatus = String\(job\.status\)/,
  "cancellation must retain the status that it originally authorized"
);
assert.match(
  cancellation,
  /\.eq\("id", job\.id\)[\s\S]*\.eq\("status", expectedStatus\)/,
  "cancellation must compare-and-set against the originally authorized status"
);
assert.match(
  cancellation,
  /\.maybeSingle\(\)/,
  "a lost cancellation race must return no row instead of raising a false failure"
);
assert.match(
  cancellation,
  /\.select\("\*"\)/,
  "the cancellation response must preserve generation_mode for the typed frontend job contract"
);
assert.match(
  cancellation,
  /if \(!data\)[\s\S]*loadJob\(db, courseId, job\.id\)/,
  "a lost cancellation race must return the current durable job state"
);

const listJobsStart = api.indexOf("async function listJobs(");
assert.ok(listJobsStart >= 0 && listJobsStart < cancelStart, "list_jobs must be present before cancellation");
const listedJobs = api.slice(listJobsStart, cancelStart);
assert.match(
  listedJobs,
  /\.select\("[^"]*generation_mode[^"]*"\)/,
  "list_jobs must return generation_mode for first-render review mode selection"
);
assert.match(
  listedJobs,
  /return \{ jobs: data \|\| \[\] \}/,
  "list_jobs must return its complete selected job objects"
);

assert.doesNotMatch(
  worker,
  /async function saveStep\(/,
  "worker writes must never use an id-only save helper"
);
for (const [stepName, nextStepName] of [
  ["stepExtractProposal", "stepSlides"],
  ["stepSlides", "stepQuestions"],
  ["stepQuestions", "asArray"],
  ["stepGrounding", "stepAssemble"]
]) {
  const stepStart = worker.indexOf(`async function ${stepName}(`);
  const nextStepStart = worker.indexOf(`function ${nextStepName}`, stepStart + 1);
  assert.ok(stepStart >= 0 && nextStepStart > stepStart, `${stepName} must be present`);
  const stepBody = worker.slice(stepStart, nextStepStart);
  assert.match(
    stepBody,
    /expectedStatus: string/,
    `${stepName} must receive the status loaded before its asynchronous work`
  );
  assert.match(
    stepBody,
    /saveStepIfStatus\(db, String\(job\.id\), expectedStatus/,
    `${stepName} must conditionally persist successful output`
  );
}
assert.match(
  worker,
  /const transitioned = await saveStepIfStatus\(db, jobId, status, \{[\s\S]*status: nextStatus/,
  "advancing a successful step must compare-and-set the originally loaded status"
);
assert.match(
  worker,
  /if \(!transitioned\) return currentJobOutcome\(jobId, await loadJob\(db, jobId\)\)/,
  "a stale successful worker must return the newer durable state without chaining"
);

console.log("PDF teaching-plan contract: OK");
