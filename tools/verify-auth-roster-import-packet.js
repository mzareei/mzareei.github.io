const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/operations/roster-import-guide.md",
  "docs/course-platform/operations/tc2007b-roster-template.csv",
  "docs/course-platform/implementation/phase-8g-roster-import-packet-plan.md",
  "docs/course-platform/operations/supabase-launch-checklist.md",
  "docs/course-platform/operations/live-supabase-evidence-packet.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

const requiredHeaders = [
  "institutional_email",
  "full_name",
  "student_identifier",
  "section_code",
  "role"
];

const requiredGuideMarkers = [
  "Roster Import Guide",
  "tc2007b-roster-template.csv",
  "institutional_email,full_name,student_identifier,section_code,role",
  "student",
  "teaching_assistant",
  "instructor",
  "observer",
  "Allowed aliases",
  "email",
  "name",
  "student_id",
  "matricula",
  "section",
  "Preview roster",
  "Apply accepted rows",
  "Email is outside the allowed institutional domains.",
  "Duplicate email in this import.",
  "Section code does not exist for this course.",
  "Role is not valid for roster import.",
  "Do not commit real rosters"
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

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("docs/course-platform/operations/tc2007b-roster-template.csv")) {
  const csv = read("docs/course-platform/operations/tc2007b-roster-template.csv").trim();
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const headers = lines.length ? parseCsvLine(lines[0]) : [];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) fail(`Roster template missing header: ${header}`);
  }
  if (lines.length < 6) fail("Roster template should include at least five safe sample rows.");
  if (/student\.name@tec\.mx/i.test(csv)) fail("Roster template still uses the old single sample row.");
  for (const role of ["student", "teaching_assistant", "instructor", "observer"]) {
    if (!csv.includes(`,${role}`)) fail(`Roster template missing sample role: ${role}`);
  }
  if (!csv.includes("@example.tec.mx")) fail("Roster template should use clearly fake example.tec.mx sample emails.");
  if (!csv.includes(",A,") || !csv.includes(",B,")) fail("Roster template should include Section A and Section B examples.");
}

if (exists("docs/course-platform/operations/roster-import-guide.md")) {
  const guide = read("docs/course-platform/operations/roster-import-guide.md");
  requireMarkers(guide, requiredGuideMarkers, "Roster import guide");
}

if (exists("docs/course-platform/implementation/phase-8g-roster-import-packet-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8g-roster-import-packet-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add safe roster template**",
    "[x] **Step 2: Add roster import guide**",
    "[x] **Step 3: Link roster packet from launch docs**",
    "[x] **Step 1: Run roster packet verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8G plan");
}

if (exists("docs/course-platform/operations/supabase-launch-checklist.md")) {
  const checklist = read("docs/course-platform/operations/supabase-launch-checklist.md");
  requireMarkers(checklist, [
    "docs/course-platform/operations/roster-import-guide.md",
    "docs/course-platform/operations/tc2007b-roster-template.csv"
  ], "Launch checklist");
}

if (exists("docs/course-platform/operations/live-supabase-evidence-packet.md")) {
  const packet = read("docs/course-platform/operations/live-supabase-evidence-packet.md");
  requireMarkers(packet, [
    "Roster template used",
    "Roster import guide reviewed",
    "docs/course-platform/operations/tc2007b-roster-template.csv",
    "example.tec.mx"
  ], "Live evidence packet");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "Roster import packet provides a safe CSV template and teacher guide for live roster testing",
    "node tools\\verify-auth-roster-import-packet.js"
  ], "Implementation status");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "docs/course-platform/operations/roster-import-guide.md",
    "docs/course-platform/operations/tc2007b-roster-template.csv",
    "node tools/verify-auth-roster-import-packet.js"
  ], "Supabase README");
}

if (failures.length) {
  console.error("Authenticated roster import packet verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated roster import packet verification passed.");
console.log("- Roster template and teacher import guide checked");
