const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-8c-supabase-launch-checklist-plan.md",
  "docs/course-platform/operations/supabase-launch-checklist.md",
  "docs/course-platform/operations/semester-operations-runbook.md",
  "supabase/course-platform-deployment-manifest.json",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md"
];

const requiredMigrations = [
  "0001_quiz_pilot.sql",
  "0002_exit_tickets.sql",
  "0003_portfolio_submissions.sql",
  "0004_authenticated_course_platform.sql",
  "0005_authenticated_activity_storage.sql",
  "0006_gradebook_foundation.sql",
  "0007_portfolio_entries.sql",
  "0008_authenticated_exit_tickets.sql",
  "0009_activity_attempt_limits.sql",
  "0010_profile_identity_confirmations.sql"
];

const requiredSeeds = [
  "tc2007b_auth_foundation_demo.sql",
  "tc2007b_auth_activity_demo.sql",
  "tc2007b_demo_question_bank.sql"
];

const requiredFunctions = [
  "quiz-create-session",
  "quiz-start-attempt",
  "quiz-submit-attempt",
  "quiz-session-summary",
  "quiz-import-questions",
  "course-submit-reflection",
  "course-reflection-summary",
  "course-submit-portfolio",
  "course-portfolio-summary",
  "course-participation-summary",
  "course-auth-context",
  "course-identity-confirmation",
  "course-section-management",
  "course-roster-management",
  "course-content-library",
  "course-release-management",
  "course-release-maintenance",
  "course-session-management",
  "course-content-access",
  "course-activity-attempt",
  "course-quiz-compatibility",
  "course-gradebook-summary",
  "course-student-records",
  "course-student-progress",
  "course-learning-insights",
  "course-participation-events",
  "course-exit-ticket",
  "course-portfolio-entry",
  "course-audit-log"
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

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} missing: ${marker}`);
  }
}

function listDirectoryNames(relativePath, filter) {
  const directoryPath = path.join(root, relativePath);
  if (!fs.existsSync(directoryPath)) return [];
  return fs.readdirSync(directoryPath, { withFileTypes: true })
    .filter(filter)
    .map((entry) => entry.name)
    .sort();
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("supabase/course-platform-deployment-manifest.json")) {
  let manifest;
  try {
    manifest = JSON.parse(read("supabase/course-platform-deployment-manifest.json"));
  } catch (error) {
    fail(`Deployment manifest is not valid JSON: ${error.message}`);
  }

  if (manifest) {
    for (const migration of requiredMigrations) {
      if (!manifest.migrations?.includes(migration)) {
        fail(`Deployment manifest missing migration: ${migration}`);
      }
    }
    for (const seed of requiredSeeds) {
      if (!manifest.seeds?.includes(seed)) {
        fail(`Deployment manifest missing seed: ${seed}`);
      }
    }
    for (const functionName of requiredFunctions) {
      if (!manifest.edge_functions?.includes(functionName)) {
        fail(`Deployment manifest missing Edge Function: ${functionName}`);
      }
    }

    const actualMigrations = listDirectoryNames("supabase/migrations", (entry) => entry.isFile() && entry.name.endsWith(".sql"));
    const actualSeeds = listDirectoryNames("supabase/seed", (entry) => entry.isFile() && entry.name.endsWith(".sql"));
    const actualFunctions = listDirectoryNames("supabase/functions", (entry) => entry.isDirectory() && entry.name !== "_shared");
    const manifestFunctions = [...(manifest.edge_functions || [])].sort();

    for (const migration of requiredMigrations) {
      if (!actualMigrations.includes(migration)) fail(`Required migration file is missing from supabase/migrations: ${migration}`);
    }
    for (const seed of requiredSeeds) {
      if (!actualSeeds.includes(seed)) fail(`Required seed file is missing from supabase/seed: ${seed}`);
    }
    for (const functionName of actualFunctions) {
      if (!manifest.edge_functions?.includes(functionName)) {
        fail(`Actual Edge Function is missing from deployment manifest: ${functionName}`);
      }
    }
    for (const functionName of manifestFunctions) {
      if (!actualFunctions.includes(functionName)) {
        fail(`Deployment manifest lists missing Edge Function directory: ${functionName}`);
      }
    }

    requireMarkers(JSON.stringify(manifest), [
      "supabase/tests/rls_auth_platform_checks.sql",
      "assets/course-materials/information-security/platform-config.js",
      "Supabase Auth email OTP",
      "approved institutional email domain",
      "teacher account",
      "rostered student account",
      "QR scan to gradebook export"
    ], "Deployment manifest");
  }
}

if (exists("docs/course-platform/operations/supabase-launch-checklist.md")) {
  const checklist = read("docs/course-platform/operations/supabase-launch-checklist.md");
  requireMarkers(checklist, [
    "Do not use for grade-bearing activities until",
    "Supabase Project",
    "Auth And Email",
    "Database Migrations",
    "Seed Data",
    "Edge Functions",
    "Browser Configuration",
    "RLS Safety Check",
    "Teacher And Student Smoke Test",
    "QR scan to gradebook export",
    "Backups Before First Grade",
    "Rollback Stop Points",
    "npx supabase functions deploy course-gradebook-summary",
    "platform-config.js",
    "supabase/tests/rls_auth_platform_checks.sql",
    "course-platform-deployment-manifest.json"
  ], "Launch checklist");

  for (const migration of requiredMigrations) {
    if (!checklist.includes(migration)) fail(`Launch checklist missing migration: ${migration}`);
  }
  for (const functionName of requiredFunctions) {
    if (!checklist.includes(`npx supabase functions deploy ${functionName}`)) {
      fail(`Launch checklist missing deploy command for: ${functionName}`);
    }
  }
}

if (exists("docs/course-platform/operations/semester-operations-runbook.md")) {
  const runbook = read("docs/course-platform/operations/semester-operations-runbook.md");
  requireMarkers(runbook, [
    "docs/course-platform/operations/supabase-launch-checklist.md",
    "first live Supabase setup"
  ], "Semester operations runbook");
}

if (exists("docs/course-platform/implementation/phase-8c-supabase-launch-checklist-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8c-supabase-launch-checklist-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add deployment manifest**",
    "[x] **Step 2: Add teacher-facing launch checklist**",
    "[x] **Step 3: Link launch checklist from operations docs**",
    "[x] **Step 1: Run launch checklist verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8C plan");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "docs/course-platform/operations/supabase-launch-checklist.md",
    "supabase/course-platform-deployment-manifest.json",
    "node tools/verify-auth-supabase-launch-checklist.js"
  ], "Supabase README");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "Supabase launch checklist",
    "node tools\\verify-auth-supabase-launch-checklist.js"
  ], "Implementation status");
}

if (failures.length) {
  console.error("Authenticated Supabase launch checklist verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated Supabase launch checklist verification passed.");
console.log(`- ${requiredMigrations.length} migrations listed`);
console.log(`- ${requiredFunctions.length} Edge Functions listed`);
