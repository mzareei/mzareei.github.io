const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-6i-gradebook-status-records-plan.md",
  "supabase/functions/course-gradebook-summary/index.ts",
  "assets/course-materials/information-security/app/gradebook-api.js",
  "assets/course-materials/information-security/app/gradebook.html",
  "assets/course-materials/information-security/app/gradebook.js"
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

if (exists("supabase/functions/course-gradebook-summary/index.ts")) {
  const fn = read("supabase/functions/course-gradebook-summary/index.ts");
  const requiredFunctionMarkers = [
    "set_score_status",
    "setScoreStatus",
    "cleanScoreStatus",
    "missing",
    "excused",
    "gradebook_score_status_set",
    "loadRosterStudents",
    "section_enrollments",
    "unique (gradebook_item_id, profile_id)",
    "status: input.status",
    "assertInstructorOnly"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-gradebook-summary missing status-record marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook-api.js")) {
  const api = read("assets/course-materials/information-security/app/gradebook-api.js");
  const requiredApiMarkers = [
    "setGradebookScoreStatus",
    "action: \"set_score_status\"",
    "gradebook_item_id",
    "profile_id",
    "section_id",
    "score_status"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Gradebook API missing status-record marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.html")) {
  const html = read("assets/course-materials/information-security/app/gradebook.html");
  const requiredMarkup = [
    'id="manualStatusItemSelect"',
    'id="manualStatusStudentSelect"',
    'id="manualStatusSelect"',
    'id="manualStatusScoreInput"',
    'id="manualStatusReasonInput"',
    'id="applyStatusBtn"'
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Gradebook markup missing status-record control: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.js")) {
  const script = read("assets/course-materials/information-security/app/gradebook.js");
  const requiredScriptMarkers = [
    "setGradebookScoreStatus",
    "applyStatusRecord",
    "manualStatusItemSelect",
    "manualStatusStudentSelect",
    "manualStatusSelect",
    "renderManualStatusControls",
    "students"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Gradebook UI missing status-record marker: ${marker}`);
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Instructors can create official missing or excused gradebook records")) {
    fail("Implementation status is missing gradebook status-record completion note.");
  }
  if (!status.includes("node tools\\verify-auth-gradebook-status-records.js")) {
    fail("Implementation status is missing the gradebook status-record verifier command.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-gradebook-status-records.js")) {
    fail("Supabase README is missing the gradebook status-record verifier.");
  }
  if (!readme.includes("official missing/excused gradebook records")) {
    fail("Supabase README is missing gradebook status-record documentation.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook status records verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook status records verification passed.");
console.log("- Missing/excused official score records checked");
