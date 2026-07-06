const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/operations/semester-setup-decisions.md",
  "docs/course-platform/implementation/phase-8i-semester-setup-decisions-plan.md",
  "docs/course-platform/operations/supabase-launch-checklist.md",
  "docs/course-platform/operations/live-supabase-evidence-packet.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

const decisionMarkers = [
  "TC2007B Semester Setup Decisions",
  "Private teacher planning copy",
  "Do not commit completed copies",
  "Course Term And Sections",
  "Institutional Email Domains",
  "Teaching Assistant Plan",
  "Official Grading Weights",
  "Content Storage And Privacy",
  "LMS Gradebook Import Format",
  "Data Retention After Semester",
  "Release And Pacing Defaults",
  "Speed Bonus Policy",
  "Grade-Bearing Go-Live Decision",
  "Backup And Export Location",
  "Decision Summary",
  "Allowed institutional domain or domains",
  "Will teaching assistants be used in the first semester?",
  "Official grading category weights",
  "Supabase records",
  "protected app files",
  "mix of both",
  "LMS import",
  "Retention period",
  "Teacher initials"
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

if (exists("docs/course-platform/operations/semester-setup-decisions.md")) {
  const decisions = read("docs/course-platform/operations/semester-setup-decisions.md");
  requireMarkers(decisions, decisionMarkers, "Semester setup decisions");
}

if (exists("docs/course-platform/implementation/phase-8i-semester-setup-decisions-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8i-semester-setup-decisions-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add semester setup decisions packet**",
    "[x] **Step 2: Link decisions packet from launch and evidence docs**",
    "[x] **Step 1: Run semester setup verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8I plan");
}

if (exists("docs/course-platform/operations/supabase-launch-checklist.md")) {
  const checklist = read("docs/course-platform/operations/supabase-launch-checklist.md");
  requireMarkers(checklist, [
    "docs/course-platform/operations/semester-setup-decisions.md",
    "semester setup decisions"
  ], "Launch checklist");
}

if (exists("docs/course-platform/operations/live-supabase-evidence-packet.md")) {
  const packet = read("docs/course-platform/operations/live-supabase-evidence-packet.md");
  requireMarkers(packet, [
    "Semester Setup Decisions",
    "docs/course-platform/operations/semester-setup-decisions.md",
    "Approved institutional domains",
    "Official grading weights",
    "Data retention policy"
  ], "Live evidence packet");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "Semester setup decisions packet captures institutional domains, teaching assistants, grading weights, content storage, LMS export needs, and data retention before grade-bearing launch",
    "node tools\\verify-auth-semester-setup-decisions.js"
  ], "Implementation status");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "docs/course-platform/operations/semester-setup-decisions.md",
    "node tools/verify-auth-semester-setup-decisions.js"
  ], "Supabase README");
}

if (failures.length) {
  console.error("Authenticated semester setup decisions verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated semester setup decisions verification passed.");
console.log("- Semester setup decision packet and launch links checked");
