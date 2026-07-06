const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/gradebook.html",
  "assets/course-materials/information-security/app/gradebook.js",
  "assets/course-materials/information-security/app/gradebook-api.js",
  "supabase/functions/course-gradebook-summary/index.ts"
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
    "Authorization",
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "gradebook_categories",
    "gradebook_items",
    "gradebook_scores",
    "grade_adjustments",
    "course_sections",
    "profiles",
    "export_csv",
    "text/csv",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-gradebook-summary missing: ${marker}`);
  }
  if (/question_options|is_correct|answer_key|selected_option_id/i.test(fn)) {
    fail("course-gradebook-summary must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.html")) {
  const html = read("assets/course-materials/information-security/app/gradebook.html");
  const requiredMarkup = [
    'id="gradebookRows"',
    'id="categoryFilter"',
    'id="sectionFilter"',
    'id="itemFilter"',
    'id="exportCsvBtn"',
    'id="refreshGradebookBtn"',
    "gradebook.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Gradebook markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook-api.js")) {
  const api = read("assets/course-materials/information-security/app/gradebook-api.js");
  const requiredApiMarkers = [
    "course-gradebook-summary",
    "action: \"summary\"",
    "action: \"export_csv\"",
    "Authorization",
    "downloadGradebookCsv"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Gradebook API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.js")) {
  const script = read("assets/course-materials/information-security/app/gradebook.js");
  const requiredScriptMarkers = [
    "loadGradebookSummary",
    "downloadGradebookCsv",
    "gradebookRows",
    "score_percent",
    "adjustment_count",
    "locked_at"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Gradebook UI script missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("gradebook.html")) {
    fail("Course App dashboard is missing gradebook review link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("gradebookSummaryFunction")) {
    fail("Platform config is missing gradebookSummaryFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-gradebook-summary]")) {
    fail("supabase/config.toml is missing course-gradebook-summary.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-gradebook-summary")) {
    fail("Supabase README is missing course-gradebook-summary deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-gradebook-review.js")) {
    fail("Supabase README is missing the gradebook review verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook review verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook review verification passed.");
console.log(`- ${requiredFiles.length} gradebook review files checked`);
