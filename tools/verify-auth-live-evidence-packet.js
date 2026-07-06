const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/operations/live-supabase-evidence-packet.md",
  "docs/course-platform/implementation/phase-8e-live-evidence-packet-plan.md",
  "docs/course-platform/operations/supabase-launch-checklist.md",
  "docs/course-platform/implementation/spec-coverage-audit.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

const evidenceMarkers = [
  "Live Supabase Evidence Packet",
  "Private teacher record",
  "Do not commit completed copies that contain student data",
  "Project And Release Metadata",
  "Migration Evidence",
  "Seed Evidence",
  "Auth And Redirect Evidence",
  "Edge Function Deployment Evidence",
  "Browser Configuration Evidence",
  "RLS Safety Evidence",
  "Roster Evidence",
  "Teacher Account Smoke Test",
  "Student Account Smoke Test",
  "Section Isolation Evidence",
  "Direct URL Access-Denied Evidence",
  "QR scan to gradebook export",
  "Gradebook Export Evidence",
  "Backup And Restore Evidence",
  "Go/No-Go Decision",
  "Live Completion Gates",
  "Evidence File Or Note",
  "Teacher initials"
];

const liveGateMarkers = [
  "Apply all migrations through `0010_profile_identity_confirmations.sql`",
  "Run safe seed files",
  "Configure Supabase Auth email OTP",
  "Deploy all Edge Functions",
  "Run `supabase/tests/rls_auth_platform_checks.sql`",
  "Import a small real or test roster",
  "Complete one teacher-plus-student smoke test",
  "Confirm backup/export location"
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

if (exists("docs/course-platform/operations/live-supabase-evidence-packet.md")) {
  const packet = read("docs/course-platform/operations/live-supabase-evidence-packet.md");
  requireMarkers(packet, evidenceMarkers, "Live evidence packet");
  requireMarkers(packet, liveGateMarkers, "Live evidence packet");
}

if (exists("docs/course-platform/implementation/phase-8e-live-evidence-packet-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8e-live-evidence-packet-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add live evidence packet**",
    "[x] **Step 2: Link evidence packet from launch and audit docs**",
    "[x] **Step 1: Run live evidence verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8E plan");
}

if (exists("docs/course-platform/operations/supabase-launch-checklist.md")) {
  const checklist = read("docs/course-platform/operations/supabase-launch-checklist.md");
  requireMarkers(checklist, [
    "docs/course-platform/operations/live-supabase-evidence-packet.md",
    "write the result in the evidence packet"
  ], "Launch checklist");
}

if (exists("docs/course-platform/implementation/spec-coverage-audit.md")) {
  const audit = read("docs/course-platform/implementation/spec-coverage-audit.md");
  requireMarkers(audit, [
    "docs/course-platform/operations/live-supabase-evidence-packet.md",
    "live evidence packet"
  ], "Spec coverage audit");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "Live Supabase evidence packet records migration, deployment, RLS, roster, smoke-test, export, and backup proof",
    "node tools\\verify-auth-live-evidence-packet.js"
  ], "Implementation status");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "docs/course-platform/operations/live-supabase-evidence-packet.md",
    "node tools/verify-auth-live-evidence-packet.js"
  ], "Supabase README");
}

if (failures.length) {
  console.error("Authenticated live evidence packet verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated live evidence packet verification passed.");
console.log("- Live Supabase proof packet checked");
