const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-7g-authenticated-review-coach-plan.md",
  "assets/course-materials/information-security/app/review-coach.html",
  "assets/course-materials/information-security/app/review-coach.js",
  "assets/course-materials/information-security/app/progress-api.js"
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

if (exists("assets/course-materials/information-security/app/review-coach.html")) {
  const html = read("assets/course-materials/information-security/app/review-coach.html");
  const requiredMarkup = [
    "TC2007B · Review Coach",
    'id="coachStatus"',
    'id="refreshCoachBtn"',
    'id="coachSummary"',
    'id="weakTopicRows"',
    'id="coachRecommendationRows"',
    'id="coachPracticeRows"',
    "review-coach.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Review Coach markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/review-coach.js")) {
  const script = read("assets/course-materials/information-security/app/review-coach.js");
  const requiredScriptMarkers = [
    "loadStudentProgress",
    "review_coach",
    "weak_topics",
    "recommendations",
    "released_practice",
    "coachSummary",
    "weakTopicRows",
    "coachRecommendationRows",
    "coachPracticeRows"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Review Coach UI missing: ${marker}`);
  }
  if (/is_correct|answer_key|question_options|selected_option_id/i.test(script)) {
    fail("Review Coach page must not expose answer keys or selected option records.");
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("review-coach.html")) {
    fail("Course App dashboard is missing authenticated Review Coach link.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Students have an authenticated Review Coach page")) {
    fail("Implementation status is missing authenticated Review Coach completion note.");
  }
  if (!status.includes("node tools\\verify-auth-review-coach.js")) {
    fail("Implementation status is missing the Review Coach verifier command.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-review-coach.js")) {
    fail("Supabase README is missing the Review Coach verifier.");
  }
  if (!readme.includes("authenticated Review Coach")) {
    fail("Supabase README is missing authenticated Review Coach documentation.");
  }
}

if (failures.length) {
  console.error("Authenticated Review Coach verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated Review Coach verification passed.");
console.log(`- ${requiredFiles.length} Review Coach files checked`);
