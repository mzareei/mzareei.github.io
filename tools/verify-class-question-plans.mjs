import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/0034_class_question_plans.sql"),
  "utf8"
);
const helper = fs.readFileSync(
  path.join(root, "supabase/functions/_shared/class-question-plan.ts"),
  "utf8"
);
const planFunction = fs.readFileSync(
  path.join(root, "supabase/functions/course-class-question-plan/index.ts"),
  "utf8"
);
const config = fs.readFileSync(
  path.join(root, "supabase/config.toml"),
  "utf8"
);

assert.match(sql, /create table if not exists public\.class_question_plans/i);
assert.match(sql, /create table if not exists public\.class_question_plan_checkpoints/i);
assert.match(sql, /create table if not exists public\.class_question_plan_candidates/i);
assert.match(
  sql,
  /alter table public\.pulse_rounds\s+add column if not exists plan_checkpoint_id uuid references public\.class_question_plan_checkpoints\(id\) on delete restrict/i
);
assert.match(sql, /unique\s*\(\s*class_session_id\s*\)/i);
assert.match(sql, /position\s+int[^;]*check\s*\(\s*position\s*>=\s*1\s*\)/i);
assert.match(sql, /slide_hint\s+int[^;]*check\s*\(\s*slide_hint\s+is\s+null\s+or\s+slide_hint\s*>=\s*1\s*\)/i);
assert.match(
  sql,
  /create table if not exists public\.class_question_plan_candidates[^]*position\s+int\s+not null[^;]*check\s*\(\s*position\s*>=\s*1\s*\)/i
);
assert.match(
  sql,
  /unique\s*\(\s*checkpoint_id\s*,\s*question_id\s*\)/i,
  "candidate rows must prevent duplicate question picks per checkpoint"
);
assert.match(sql, /alter table public\.class_question_plans enable row level security/i);
assert.match(sql, /alter table public\.class_question_plan_checkpoints enable row level security/i);
assert.match(sql, /alter table public\.class_question_plan_candidates enable row level security/i);
assert.match(
  sql,
  /create index if not exists class_question_plans_class_session_id_idx on public\.class_question_plans\s*\(\s*class_session_id\s*\)/i
);
assert.match(
  sql,
  /create index if not exists class_question_plan_candidates_checkpoint_id_idx on public\.class_question_plan_candidates\s*\(\s*checkpoint_id\s*\)/i
);
assert.match(
  sql,
  /create index if not exists pulse_rounds_plan_checkpoint_id_idx on public\.pulse_rounds\s*\(\s*plan_checkpoint_id\s*\)/i
);
assert.match(helper, /throw new Error\("class_question_plan_topic_required"\)/);
assert.match(helper, /throw new Error\("class_question_plan_slide_hint_invalid"\)/);
assert.match(helper, /throw new Error\("class_question_plan_checkpoint_locked"\)/);

for (const action of [
  "get",
  "create",
  "copy",
  "add_checkpoint",
  "update_checkpoint",
  "remove_checkpoint",
  "set_candidates",
  "mark_skipped"
]) {
  assert.match(planFunction, new RegExp(`body\\.action === "${action}"|case "${action}"`));
}

assert.match(planFunction, /assertSectionAllowed\s*\(/);
assert.match(
  planFunction,
  /\.eq\("question_bank_id",\s*plan\.question_bank_id\)|question\.question_bank_id\s*!==\s*plan\.question_bank_id/
);
assert.match(
  planFunction,
  /assertMutableCheckpoint\s*\(\s*checkpoint\.state\s*,\s*checkpoint\.sentRoundCount\s*\)/
);
assert.match(
  planFunction,
  /\.from\("pulse_rounds"\)[^]*select\("id",\s*\{\s*count:\s*"exact",\s*head:\s*true\s*\}\)[^]*\.eq\("plan_checkpoint_id",\s*checkpointId\)/
);
assert.match(planFunction, /\.from\("class_question_plan_candidates"\)[^]*\.upsert\(/);
assert.match(
  planFunction,
  /\.delete\(\)[^]*\.eq\("checkpoint_id",\s*checkpoint\.id\)[^]*\.not\("question_id",\s*"in",/
);
assert.doesNotMatch(
  planFunction,
  /\.from\("class_question_plan_candidates"\)[^]*\.delete\(\)[^]*\.eq\("checkpoint_id",\s*checkpoint\.id\)[^]*if \(questionIds\.length\)[^]*\.from\("class_question_plan_candidates"\)[^]*\.insert\(/,
  "set_candidates must not delete the old list before replacement rows have been persisted"
);
assert.match(config, /\[functions\.course-class-question-plan\][^\[]*verify_jwt\s*=\s*true/i);

console.log("verify-class-question-plans: ok");
