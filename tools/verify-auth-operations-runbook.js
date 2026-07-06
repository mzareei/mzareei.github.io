const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/operations/semester-operations-runbook.md",
  "supabase/tests/rls_auth_platform_checks.sql",
  "docs/course-platform/implementation/phase-8-hardening-operations-plan.md"
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("docs/course-platform/operations/semester-operations-runbook.md")) {
  const runbook = read("docs/course-platform/operations/semester-operations-runbook.md");
  const requiredSections = [
    "Backup And Restore Procedure",
    "RLS Policy Tests",
    "Teacher Pre-Class Checklist",
    "Semester Rollover Procedure",
    "Privacy And Data Retention Notes",
    "Incident Procedures",
    "Wrong Roster",
    "Duplicate Student",
    "Missed Activity",
    "Connection Failure",
    "Section A",
    "Section B",
    "supabase db dump",
    "Point-in-Time Recovery",
    "restore downtime",
    "off-site backup"
  ];
  for (const marker of requiredSections) {
    if (!runbook.includes(marker)) fail(`Operations runbook missing: ${marker}`);
  }
}

if (exists("supabase/tests/rls_auth_platform_checks.sql")) {
  const sql = read("supabase/tests/rls_auth_platform_checks.sql").toLowerCase();
  const requiredSqlMarkers = [
    "do $$",
    "pg_class",
    "relrowsecurity",
    "raise exception",
    "portfolio_entries",
    "gradebook_scores",
    "student_attempts",
    "student_responses",
    "course_memberships",
    "content_releases",
    "revoke",
    "anon",
    "authenticated"
  ];
  for (const marker of requiredSqlMarkers) {
    if (!sql.includes(marker)) fail(`RLS test SQL missing: ${marker}`);
  }
}

if (exists("docs/course-platform/implementation/phase-8-hardening-operations-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8-hardening-operations-plan.md");
  const requiredPlanMarkers = [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add backup and restore procedure**",
    "[x] **Step 2: Add RLS test pack**",
    "[x] **Step 3: Add operating procedures**",
    "[x] **Step 1: Run operations verifier**",
    "[x] **Step 2: Run all platform verifiers**"
  ];
  for (const marker of requiredPlanMarkers) {
    if (!plan.includes(marker)) fail(`Phase 8 plan missing: ${marker}`);
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("docs/course-platform/operations/semester-operations-runbook.md")) {
    fail("Supabase README is missing the operations runbook link.");
  }
  if (!readme.includes("supabase/tests/rls_auth_platform_checks.sql")) {
    fail("Supabase README is missing the RLS test SQL reference.");
  }
  if (!readme.includes("node tools/verify-auth-operations-runbook.js")) {
    fail("Supabase README is missing the operations verifier command.");
  }
}

if (failures.length) {
  console.error("Authenticated operations runbook verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated operations runbook verification passed.");
console.log(`- ${requiredFiles.length} operations files checked`);
