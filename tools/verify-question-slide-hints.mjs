import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const [migration, importFn, bankFn] = await Promise.all([
  readFile(new URL("supabase/migrations/0036_question_slide_hints.sql", root), "utf8"),
  readFile(new URL("supabase/functions/course-content-import/index.ts", root), "utf8"),
  readFile(new URL("supabase/functions/course-question-bank/index.ts", root), "utf8")
]);

assert.match(migration, /alter table public\.questions/i);
assert.match(
  migration,
  /add column if not exists suggested_slide_hint integer\s*\n?\s*check\s*\(\s*suggested_slide_hint is null or suggested_slide_hint\s*>=\s*1\s*\)/i,
  "suggested_slide_hint must be nullable and, when set, a positive integer"
);
assert.match(
  migration,
  /add column if not exists suggested_topic text\s*\n?\s*check\s*\(\s*suggested_topic is null or length\(trim\(suggested_topic\)\)\s*<=\s*160\s*\)/i,
  "suggested_topic must be nullable and, when set, at most 160 trimmed characters"
);

assert.match(
  importFn,
  /suggested_slide_hint:\s*Number\.isInteger\(question\.covers_up_to_slide\)/,
  "the import write must carry covers_up_to_slide into suggested_slide_hint"
);
assert.match(
  importFn,
  /suggested_topic:\s*typeof question\.topic === "string"/,
  "the import write must carry topic into suggested_topic"
);

assert.match(
  bankFn,
  /suggested_slide_hint,\s*suggested_topic/,
  "list_questions must select the new informal hint columns"
);

console.log("question slide hints verified");
