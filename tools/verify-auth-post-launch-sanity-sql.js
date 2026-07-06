const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/tests/post_launch_smoke_sanity_checks.sql",
  "docs/course-platform/implementation/phase-8h-post-launch-sanity-sql-plan.md",
  "docs/course-platform/operations/live-supabase-evidence-packet.md",
  "docs/course-platform/operations/supabase-launch-checklist.md",
  "docs/course-platform/operations/supabase-powershell-command-sheet.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

const requiredSqlMarkers = [
  "TC2007B post-launch smoke sanity checks",
  "with launch_params as",
  "'tc2007b'::text as course_id",
  "Project metadata",
  "Roster summary",
  "Section enrollment summary",
  "Release state summary",
  "Activity instance summary",
  "Student attempt summary",
  "Gradebook score summary",
  "Gradebook export evidence summary",
  "Exit ticket summary",
  "Portfolio entry summary",
  "Audit log summary",
  "RLS state summary",
  "public.profiles",
  "public.course_memberships",
  "public.section_enrollments",
  "public.content_releases",
  "public.activity_instances",
  "public.student_attempts",
  "public.student_responses",
  "public.gradebook_scores",
  "public.exit_tickets",
  "public.portfolio_entries",
  "public.audit_log",
  "count(*)",
  "group by",
  "order by",
  "No individual student names or emails are selected by default"
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

if (exists("supabase/tests/post_launch_smoke_sanity_checks.sql")) {
  const sql = read("supabase/tests/post_launch_smoke_sanity_checks.sql");
  requireMarkers(sql, requiredSqlMarkers, "Post-launch sanity SQL");
}

if (exists("docs/course-platform/implementation/phase-8h-post-launch-sanity-sql-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8h-post-launch-sanity-sql-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add post-launch SQL sanity checks**",
    "[x] **Step 2: Link SQL checks from launch/evidence docs**",
    "[x] **Step 1: Run post-launch SQL verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8H plan");
}

if (exists("docs/course-platform/operations/live-supabase-evidence-packet.md")) {
  const packet = read("docs/course-platform/operations/live-supabase-evidence-packet.md");
  requireMarkers(packet, [
    "Post-launch SQL sanity checks",
    "supabase/tests/post_launch_smoke_sanity_checks.sql"
  ], "Live evidence packet");
}

if (exists("docs/course-platform/operations/supabase-launch-checklist.md")) {
  const checklist = read("docs/course-platform/operations/supabase-launch-checklist.md");
  requireMarkers(checklist, [
    "supabase/tests/post_launch_smoke_sanity_checks.sql",
    "post-launch smoke sanity checks"
  ], "Launch checklist");
}

if (exists("docs/course-platform/operations/supabase-powershell-command-sheet.md")) {
  const sheet = read("docs/course-platform/operations/supabase-powershell-command-sheet.md");
  requireMarkers(sheet, [
    "supabase/tests/post_launch_smoke_sanity_checks.sql",
    "post-launch smoke sanity checks"
  ], "PowerShell command sheet");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "Post-launch SQL sanity checks summarize live roster, release, attempt, gradebook, exit-ticket, portfolio, audit, and RLS evidence",
    "node tools\\verify-auth-post-launch-sanity-sql.js"
  ], "Implementation status");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "supabase/tests/post_launch_smoke_sanity_checks.sql",
    "node tools/verify-auth-post-launch-sanity-sql.js"
  ], "Supabase README");
}

if (failures.length) {
  console.error("Authenticated post-launch sanity SQL verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated post-launch sanity SQL verification passed.");
console.log("- Post-launch aggregate SQL checks documented");
