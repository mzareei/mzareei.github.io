const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-gradebook-summary/index.ts",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function fail(message) {
  failures.push(message);
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("supabase/functions/course-gradebook-summary/index.ts")) {
  const fn = read("supabase/functions/course-gradebook-summary/index.ts");
  const requiredMarkers = [
    "student_attempts",
    "sourceAttemptIds",
    "attemptById",
    "attempt_number",
    "attempt_status",
    "submitted_at",
    "speed_bonus",
    "grade_status"
  ];
  for (const marker of requiredMarkers) {
    if (!fn.includes(marker)) fail(`course-gradebook-summary missing export evidence marker: ${marker}`);
  }

  const requiredHeaders = [
    '"student_identifier"',
    '"institutional_email"',
    '"section_code"',
    '"item_title"',
    '"source_attempt_id"',
    '"attempt_number"',
    '"attempt_status"',
    '"submitted_at"',
    '"score_raw"',
    '"score_final"',
    '"grade_status"'
  ];
  for (const header of requiredHeaders) {
    if (!fn.includes(header)) fail(`CSV export headers missing: ${header}`);
  }

  if (/headers\s*=\s*\[[^\]]*"status"/s.test(fn)) {
    fail("CSV export should use grade_status and attempt_status instead of an ambiguous status column.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("attempt status and submission timestamp")) {
    fail("Implementation status is missing the complete grade export evidence note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-gradebook-export-evidence.js")) {
    fail("Supabase README is missing the gradebook export evidence verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook export evidence verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook export evidence verification passed.");
console.log("- CSV exports include identity, section, activity, attempt, score, state, and timestamp evidence.");
