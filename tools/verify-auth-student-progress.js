const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/progress.html",
  "assets/course-materials/information-security/app/progress.js",
  "assets/course-materials/information-security/app/progress-api.js",
  "supabase/functions/course-student-progress/index.ts"
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

if (exists("supabase/functions/course-student-progress/index.ts")) {
  const fn = read("supabase/functions/course-student-progress/index.ts");
  const requiredFunctionMarkers = [
    "Authorization",
    "auth.getUser",
    "profiles",
    "section_enrollments",
    "gradebook_scores",
    "gradebook_items",
    "gradebook_categories",
    "student_attempts",
    "student_responses",
    "questions",
    "topic_tags",
    "content_releases",
    "recommendations",
    "review_coach",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-student-progress missing: ${marker}`);
  }
  if (/question_options|answer_key|selected_option_id/i.test(fn)) {
    fail("course-student-progress must not expose answer keys or selected option records.");
  }
}

if (exists("assets/course-materials/information-security/app/progress.html")) {
  const html = read("assets/course-materials/information-security/app/progress.html");
  const requiredMarkup = [
    'id="progressStats"',
    'id="scoreRows"',
    'id="recommendationRows"',
    'id="releasedPracticeRows"',
    'id="refreshProgressBtn"',
    "progress.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Student progress markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/progress-api.js")) {
  const api = read("assets/course-materials/information-security/app/progress-api.js");
  const requiredApiMarkers = [
    "course-student-progress",
    "loadStudentProgress",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Student progress API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/progress.js")) {
  const script = read("assets/course-materials/information-security/app/progress.js");
  const requiredScriptMarkers = [
    "loadStudentProgress",
    "progressStats",
    "scoreRows",
    "recommendationRows",
    "releasedPracticeRows",
    "review_coach"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Student progress UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("progress.html")) {
    fail("Course App dashboard is missing authenticated progress link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("studentProgressFunction")) {
    fail("Platform config is missing studentProgressFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-student-progress]")) {
    fail("supabase/config.toml is missing course-student-progress.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-student-progress")) {
    fail("Supabase README is missing course-student-progress deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-student-progress.js")) {
    fail("Supabase README is missing the student progress verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated student progress verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated student progress verification passed.");
console.log(`- ${requiredFiles.length} student progress files checked`);
