import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(root, "supabase/migrations/0030_prepare_clean_platform_reset.sql");
const executionPath = path.join(root, "supabase/migrations/0031_execute_clean_platform_reset.sql");

function fail(message) {
  console.error(`verify-clean-platform-reset: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(migrationPath)) fail("migration 0030 is missing");
const sql = fs.readFileSync(migrationPath, "utf8");
const required = [
  /clean_tc2007b_platform\(p_execute boolean\)/i,
  /p_execute is false/i,
  /exactly one active TC2007B platform owner/i,
  /delete from auth\.users/i,
  /where id <> owner_auth_user_id/i,
  /'401'.*'Group 401'.*'active'/is,
  /'402'.*'Group 402'.*'planned'/is,
  /'501'.*'Group 501'.*'planned'/is,
  /'502'.*'Group 502'.*'planned'/is,
  /insert into public\.course_memberships/is,
  /'platform_owner'/i,
  /'instructor'/i,
  /insert into public\.section_enrollments/is,
  /retained asset fingerprint changed/i,
  /historical rows remain after reset/i,
  /revoke all on function public\.clean_tc2007b_platform/i,
];
for (const pattern of required) {
  if (!pattern.test(sql)) fail(`missing migration contract ${pattern}`);
}

const retained = [
  "content_items", "activity_templates", "question_banks", "questions",
  "question_options", "content_uploads", "generation_jobs", "quiz_courses",
  "quiz_lectures", "quiz_questions", "quiz_options",
];
for (const table of retained) {
  if (!new RegExp(`['"]${table}['"]`, "i").test(sql)) {
    fail(`retained asset table ${table} is not fingerprinted`);
  }
}

const zeroRow = [
  "class_sessions", "class_presentation_state", "class_student_notes",
  "content_releases", "release_events", "activity_instances", "student_attempts",
  "student_responses", "pulse_rounds", "pulse_answers", "exit_tickets",
  "course_exit_tickets", "portfolio_entries", "course_portfolio_submissions",
  "gradebook_categories", "gradebook_items", "gradebook_scores", "grade_adjustments",
  "participation_events", "roster_imports", "profile_identity_confirmations",
  "external_access_grants", "audit_log", "quiz_sessions", "quiz_attempts",
  "quiz_attempt_questions", "quiz_answers",
];
for (const table of zeroRow) {
  if (!new RegExp(`public\\.${table}`, "i").test(sql)) fail(`operational table ${table} is not handled`);
}

if (fs.existsSync(executionPath)) {
  const executeSql = fs.readFileSync(executionPath, "utf8");
  if (!/select public\.clean_tc2007b_platform\(true\)/i.test(executeSql)) {
    fail("migration 0031 does not execute the guarded reset");
  }
  if (!/drop function public\.clean_tc2007b_platform\(boolean\)/i.test(executeSql)) {
    fail("migration 0031 does not drop the one-shot reset function");
  }
}

console.log("verify-clean-platform-reset: OK");
