const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-student-records/index.ts",
  "assets/course-materials/information-security/app/student-records-api.js",
  "assets/course-materials/information-security/app/student-records.html",
  "assets/course-materials/information-security/app/student-records.js",
  "assets/course-materials/information-security/app/app.js",
  "assets/course-materials/information-security/platform-config.js",
  "supabase/config.toml",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md"
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

if (exists("supabase/functions/course-student-records/index.ts")) {
  const fn = read("supabase/functions/course-student-records/index.ts");
  const requiredMarkers = [
    "auth.getUser",
    "course_memberships",
    "section_enrollments",
    "profiles",
    "gradebook_scores",
    "student_attempts",
    "exit_tickets",
    "portfolio_entries",
    "list_students",
    "student_record",
    "teaching_assistant",
    "assertStudentScope",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredMarkers) {
    if (!fn.includes(marker)) fail(`course-student-records missing: ${marker}`);
  }
  if (/question_options|is_correct|answer_key|selected_option_id/i.test(fn)) {
    fail("course-student-records must not expose answer keys or selected option records.");
  }
}

if (exists("assets/course-materials/information-security/app/student-records-api.js")) {
  const api = read("assets/course-materials/information-security/app/student-records-api.js");
  const requiredApiMarkers = [
    "course-student-records",
    "action: \"list_students\"",
    "action: \"student_record\"",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Student records API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/student-records.html")) {
  const html = read("assets/course-materials/information-security/app/student-records.html");
  const requiredMarkup = [
    'id="studentSelect"',
    'id="studentRecordStatus"',
    'id="studentRecordSummary"',
    'id="studentScoreRows"',
    'id="studentAttemptRows"',
    'id="studentExitTicketRows"',
    'id="studentPortfolioRows"',
    "student-records.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Student records markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/student-records.js")) {
  const script = read("assets/course-materials/information-security/app/student-records.js");
  const requiredScriptMarkers = [
    "loadStudentList",
    "loadStudentRecord",
    "studentScoreRows",
    "studentAttemptRows",
    "studentExitTicketRows",
    "studentPortfolioRows",
    "average_final"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Student records UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("student-records.html")) {
    fail("Course App dashboard is missing student records link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("studentRecordsFunction")) {
    fail("Platform config is missing studentRecordsFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-student-records]")) {
    fail("supabase/config.toml is missing course-student-records.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-student-records")) {
    fail("Supabase README is missing course-student-records deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-student-records.js")) {
    fail("Supabase README is missing student records verifier command.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Teacher student-record view")) {
    fail("Implementation status is missing the teacher student-record view note.");
  }
}

if (failures.length) {
  console.error("Authenticated student records verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated student records verification passed.");
console.log("- Teacher can inspect a student record across scores, attempts, exit tickets, and portfolio evidence.");
