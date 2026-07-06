const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "0004_authenticated_course_platform.sql");
const failures = [];

const requiredTables = [
  "profiles",
  "courses",
  "course_memberships",
  "course_sections",
  "section_enrollments",
  "roster_imports",
  "class_sessions",
  "content_items",
  "content_releases",
  "release_events"
];

const requiredReleaseStates = [
  "draft",
  "scheduled",
  "released",
  "live",
  "paused",
  "review_only",
  "closed",
  "archived"
];

const requiredSessionStates = [
  "planned",
  "open",
  "live",
  "paused",
  "continued",
  "closed",
  "cancelled"
];

const requiredRoles = [
  "platform_owner",
  "instructor",
  "teaching_assistant",
  "student",
  "observer"
];

function fail(message) {
  failures.push(message);
}

function includesAll(source, values, label) {
  for (const value of values) {
    if (!source.includes(`'${value}'`)) {
      fail(`Missing ${label}: ${value}`);
    }
  }
}

if (!fs.existsSync(migrationPath)) {
  fail("Missing migration: supabase/migrations/0004_authenticated_course_platform.sql");
} else {
  const migration = fs.readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
  const lower = migration.toLowerCase();

  for (const table of requiredTables) {
    const tablePattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i");
    if (!tablePattern.test(migration)) {
      fail(`Missing table: ${table}`);
    }
    if (!lower.includes(`alter table public.${table} enable row level security;`)) {
      fail(`Missing RLS enable statement for: ${table}`);
    }
    if (!lower.includes(`revoke all on public.${table} from anon, authenticated;`)) {
      fail(`Missing browser revoke statement for: ${table}`);
    }
  }

  includesAll(migration, requiredReleaseStates, "release state");
  includesAll(migration, requiredSessionStates, "class session state");
  includesAll(migration, requiredRoles, "role");

  if (!lower.includes("references auth.users(id)")) {
    fail("profiles.auth_user_id must reference auth.users(id).");
  }
  if (!lower.includes("continued_from_session_id")) {
    fail("class_sessions must support continued_from_session_id.");
  }
  if (!lower.includes("unique (course_id, section_code)")) {
    fail("course_sections must prevent duplicate section codes per course.");
  }
}

if (failures.length) {
  console.error("Authenticated platform verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Authenticated platform verification passed.");
console.log(`- ${requiredTables.length} foundation tables checked`);
console.log(`- ${requiredReleaseStates.length} release states checked`);
console.log(`- ${requiredSessionStates.length} class session states checked`);
