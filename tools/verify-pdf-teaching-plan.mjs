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

assert.match(migration, /ready_for_plan_review/);
assert.match(migration, /generation_mode/);
assert.match(migration, /teaching_brief/);
assert.match(migration, /proposed_plan/);
assert.match(api, /case "review_plan"/);
assert.match(api, /case "approve_plan"/);
assert.match(helper, /function validateTeachingBrief/);
assert.match(helper, /function validateTeachingPlan/);

console.log("PDF teaching-plan contract: OK");
