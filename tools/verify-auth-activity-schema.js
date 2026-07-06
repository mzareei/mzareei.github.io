const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "0005_authenticated_activity_storage.sql");
const readmePath = path.join(root, "supabase", "README.md");
const failures = [];

const requiredTables = [
  "activity_templates",
  "activity_instances",
  "question_banks",
  "questions",
  "question_options",
  "student_attempts",
  "student_responses"
];

const requiredActivityTypes = [
  "quiz",
  "mission",
  "exit_ticket",
  "case_file",
  "portfolio",
  "participation_pulse"
];

const requiredAttemptStatuses = [
  "started",
  "submitted",
  "late",
  "excused",
  "missing",
  "locked"
];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(migrationPath)) {
  fail("Missing migration: supabase/migrations/0005_authenticated_activity_storage.sql");
} else {
  const migration = fs.readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
  const lower = migration.toLowerCase();

  for (const table of requiredTables) {
    const tablePattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i");
    if (!tablePattern.test(migration)) fail(`Missing table: ${table}`);
    if (!lower.includes(`alter table public.${table} enable row level security;`)) {
      fail(`Missing RLS enable statement for: ${table}`);
    }
    if (!lower.includes(`revoke all on public.${table} from anon, authenticated;`)) {
      fail(`Missing browser revoke statement for: ${table}`);
    }
  }

  for (const type of requiredActivityTypes) {
    if (!migration.includes(`'${type}'`)) fail(`Missing activity type: ${type}`);
  }

  for (const status of requiredAttemptStatuses) {
    if (!migration.includes(`'${status}'`)) fail(`Missing attempt status: ${status}`);
  }

  const requiredReferences = [
    "references public.content_items(id)",
    "references public.course_sections(id)",
    "references public.class_sessions(id)",
    "references public.profiles(id)",
    "references public.activity_instances(id)",
    "references public.question_banks(id)",
    "references public.questions(id)",
    "references public.question_options(id)"
  ];

  for (const reference of requiredReferences) {
    if (!lower.includes(reference)) fail(`Missing reference: ${reference}`);
  }

  if (!lower.includes("unique (activity_instance_id, profile_id)")) {
    fail("student_attempts must prevent duplicate active attempts per activity/profile.");
  }
  if (!lower.includes("response_json jsonb")) {
    fail("student_responses must store structured response_json.");
  }
}

if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, "utf8");
  if (!readme.includes("0005_authenticated_activity_storage.sql")) {
    fail("Supabase README is missing migration 0005.");
  }
  if (!readme.includes("node tools/verify-auth-activity-schema.js")) {
    fail("Supabase README is missing the activity schema verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated activity schema verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated activity schema verification passed.");
console.log(`- ${requiredTables.length} activity tables checked`);
