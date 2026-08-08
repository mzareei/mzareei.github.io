import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/0034_class_question_plans.sql"),
  "utf8"
);

assert.match(sql, /create table if not exists public\.class_question_plans/i);
assert.match(sql, /create table if not exists public\.class_question_plan_checkpoints/i);
assert.match(sql, /create table if not exists public\.class_question_plan_candidates/i);
assert.match(sql, /unique\s*\(\s*class_session_id\s*\)/i);
assert.match(sql, /position\s+int[^;]*check\s*\(\s*position\s*>=\s*1\s*\)/i);
assert.match(sql, /slide_hint\s+int[^;]*check\s*\(\s*slide_hint\s+is\s+null\s+or\s+slide_hint\s*>=\s*1\s*\)/i);
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
