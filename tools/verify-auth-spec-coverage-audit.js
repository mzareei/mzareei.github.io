const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/spec-coverage-audit.md",
  "docs/course-platform/implementation/phase-8d-spec-coverage-audit-plan.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

const successCriteria = Array.from({ length: 10 }, (_, index) => `SC-${index + 1}`);
const phases = Array.from({ length: 9 }, (_, index) => `Phase ${index}`);

const requiredAuditMarkers = [
  "Completion Status: Repository implementation substantially complete; live Supabase proof still required",
  "Repository Evidence",
  "Live Proof Required",
  "Cannot Mark Goal Complete Until",
  "Spec Success Criteria Coverage",
  "Implementation Order Coverage",
  "Live Supabase Completion Gates",
  "Apply all migrations through `0010_profile_identity_confirmations.sql`",
  "Configure Supabase Auth email OTP",
  "Deploy all Edge Functions listed in `supabase/course-platform-deployment-manifest.json`",
  "Run `supabase/tests/rls_auth_platform_checks.sql`",
  "Import a small real or test roster",
  "Complete one teacher-plus-student smoke test",
  "QR scan to gradebook export",
  "Confirm backup/export location before grade-bearing use",
  "This audit does not replace live Supabase integration testing"
];

const requiredVerifierMarkers = [
  "node tools\\verify-course-platform.js",
  "node tools\\verify-auth-course-platform.js",
  "node tools\\verify-auth-institutional-email-guard.js",
  "node tools\\verify-auth-content-access.js",
  "node tools\\verify-auth-activity-player.js",
  "node tools\\verify-auth-gradebook-export-evidence.js",
  "node tools\\verify-auth-session-continuation.js",
  "node tools\\verify-auth-student-records.js",
  "node tools\\verify-auth-operations-runbook.js",
  "node tools\\verify-auth-supabase-launch-checklist.js"
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

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("docs/course-platform/implementation/spec-coverage-audit.md")) {
  const audit = read("docs/course-platform/implementation/spec-coverage-audit.md");
  requireMarkers(audit, requiredAuditMarkers, "Spec coverage audit");
  requireMarkers(audit, requiredVerifierMarkers, "Spec coverage audit");
  requireMarkers(audit, successCriteria, "Spec coverage audit");
  requireMarkers(audit, phases, "Spec coverage audit");
}

if (exists("docs/course-platform/implementation/phase-8d-spec-coverage-audit-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8d-spec-coverage-audit-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add spec coverage audit**",
    "[x] **Step 2: Link audit from status and README**",
    "[x] **Step 1: Run spec coverage verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8D plan");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "Spec coverage audit maps the original success criteria and phases to repository evidence",
    "node tools\\verify-auth-spec-coverage-audit.js"
  ], "Implementation status");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "docs/course-platform/implementation/spec-coverage-audit.md",
    "node tools/verify-auth-spec-coverage-audit.js"
  ], "Supabase README");
}

if (failures.length) {
  console.error("Authenticated spec coverage audit verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated spec coverage audit verification passed.");
console.log(`- ${successCriteria.length} success criteria mapped`);
console.log(`- ${phases.length} implementation phases mapped`);
