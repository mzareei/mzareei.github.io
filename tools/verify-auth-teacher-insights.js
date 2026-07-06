const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/insights.html",
  "assets/course-materials/information-security/app/insights.js",
  "assets/course-materials/information-security/app/insights-api.js",
  "supabase/functions/course-learning-insights/index.ts"
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

if (exists("supabase/functions/course-learning-insights/index.ts")) {
  const fn = read("supabase/functions/course-learning-insights/index.ts");
  const requiredFunctionMarkers = [
    "Authorization",
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "gradebook_scores",
    "gradebook_items",
    "gradebook_categories",
    "student_attempts",
    "student_responses",
    "questions",
    "topic_tags",
    "course_exit_tickets",
    "section_summaries",
    "topic_summaries",
    "activity_summaries",
    "student_summaries",
    "exit_ticket_trends",
    "recommendations",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-learning-insights missing: ${marker}`);
  }
  if (/question_options|answer_key|selected_option_id/i.test(fn)) {
    fail("course-learning-insights must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/insights.html")) {
  const html = read("assets/course-materials/information-security/app/insights.html");
  const requiredMarkup = [
    'id="sectionSummaryRows"',
    'id="topicSummaryRows"',
    'id="activitySummaryRows"',
    'id="studentSummaryRows"',
    'id="exitTicketTrendRows"',
    'id="recommendationRows"',
    'id="refreshInsightsBtn"',
    "insights.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Teacher insights markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/insights-api.js")) {
  const api = read("assets/course-materials/information-security/app/insights-api.js");
  const requiredApiMarkers = [
    "course-learning-insights",
    "loadLearningInsights",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Teacher insights API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/insights.js")) {
  const script = read("assets/course-materials/information-security/app/insights.js");
  const requiredScriptMarkers = [
    "loadLearningInsights",
    "sectionSummaryRows",
    "topicSummaryRows",
    "activitySummaryRows",
    "studentSummaryRows",
    "exitTicketTrendRows",
    "recommendations"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Teacher insights UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("insights.html")) {
    fail("Course App dashboard is missing learning insights link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("learningInsightsFunction")) {
    fail("Platform config is missing learningInsightsFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-learning-insights]")) {
    fail("supabase/config.toml is missing course-learning-insights.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-learning-insights")) {
    fail("Supabase README is missing course-learning-insights deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-teacher-insights.js")) {
    fail("Supabase README is missing the teacher insights verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated teacher insights verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated teacher insights verification passed.");
console.log(`- ${requiredFiles.length} teacher insights files checked`);
