const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "0006_gradebook_foundation.sql");
const readmePath = path.join(root, "supabase", "README.md");
const failures = [];

const requiredTables = [
  "gradebook_categories",
  "gradebook_items",
  "gradebook_scores",
  "grade_adjustments",
  "participation_events",
  "audit_log"
];

const requiredScoreStatuses = [
  "draft",
  "posted",
  "excused",
  "missing",
  "locked"
];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(migrationPath)) {
  fail("Missing migration: supabase/migrations/0006_gradebook_foundation.sql");
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

  const requiredReferences = [
    "references public.courses(id)",
    "references public.gradebook_categories(id)",
    "references public.activity_templates(id)",
    "references public.profiles(id)",
    "references public.course_sections(id)",
    "references public.student_attempts(id)",
    "references public.gradebook_scores(id)",
    "references public.class_sessions(id)"
  ];

  for (const reference of requiredReferences) {
    if (!lower.includes(reference)) fail(`Missing reference: ${reference}`);
  }

  for (const status of requiredScoreStatuses) {
    if (!migration.includes(`'${status}'`)) fail(`Missing gradebook score status: ${status}`);
  }

  const requiredFields = [
    "weight_percent numeric",
    "drop_lowest_count int",
    "max_score numeric",
    "score_raw numeric",
    "score_percent numeric",
    "score_final numeric",
    "locked_at timestamptz",
    "previous_score_final numeric",
    "new_score_final numeric",
    "reason text",
    "event_type text",
    "points numeric",
    "metadata jsonb",
    "target_type text",
    "target_id uuid",
    "action text"
  ];

  for (const field of requiredFields) {
    if (!lower.includes(field)) fail(`Missing gradebook/audit field: ${field}`);
  }

  if (!lower.includes("unique (gradebook_item_id, profile_id)")) {
    fail("gradebook_scores must keep one official score per student per item.");
  }
  if (!lower.includes("gradebook_scores_item_section_idx")) {
    fail("Missing gradebook score review index.");
  }
  if (!lower.includes("audit_log_course_created_idx")) {
    fail("Missing audit log chronological index.");
  }
}

if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, "utf8");
  if (!readme.includes("0006_gradebook_foundation.sql")) {
    fail("Supabase README is missing migration 0006.");
  }
  if (!readme.includes("node tools/verify-auth-gradebook-schema.js")) {
    fail("Supabase README is missing the gradebook schema verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook schema verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook schema verification passed.");
console.log(`- ${requiredTables.length} gradebook and audit tables checked`);
