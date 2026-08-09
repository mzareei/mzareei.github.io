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

assert.match(migration, /ready_for_plan_review/);
assert.match(migration, /generation_mode/);
assert.match(migration, /teaching_brief/);
assert.match(migration, /proposed_plan/);
assert.match(api, /case "review_plan"/);
assert.match(api, /case "approve_plan"/);
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
assert.match(worker, /generation_validation_profile: "flexible"/);
assert.match(worker, /source_pdf_pages: question\.source_pdf_pages/);
assert.match(worker, /staging_deck_path/);
assert.doesNotMatch(worker, /deckCheckpointsFromQuestions\(questions\)/);

console.log("PDF teaching-plan contract: OK");
