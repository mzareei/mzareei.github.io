const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-6g-weighted-grade-summary-plan.md",
  "supabase/functions/course-gradebook-summary/index.ts",
  "supabase/functions/course-student-progress/index.ts",
  "assets/course-materials/information-security/app/gradebook.js",
  "assets/course-materials/information-security/app/progress.js"
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

if (exists("docs/course-platform/implementation/phase-6g-weighted-grade-summary-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-6g-weighted-grade-summary-plan.md");
  const requiredPlanMarkers = [
    "# Phase 6G Weighted Grade Summary Plan",
    "[x] **Step 1: Add focused weighted-summary verifier**",
    "[x] **Step 2: Add weighted grade calculations to trusted functions**",
    "[x] **Step 3: Show weighted summaries in teacher and student views**",
    "[x] **Step 4: Run focused and full verification**"
  ];
  for (const marker of requiredPlanMarkers) {
    if (!plan.includes(marker)) fail(`Weighted grade summary plan missing: ${marker}`);
  }
}

for (const fnPath of [
  "supabase/functions/course-gradebook-summary/index.ts",
  "supabase/functions/course-student-progress/index.ts"
]) {
  if (!exists(fnPath)) continue;
  const fn = read(fnPath);
  const requiredFunctionMarkers = [
    "buildWeightedGradeSummary",
    "weighted_summary",
    "category_summaries",
    "weighted_course_percent",
    "configured_weight_percent",
    "drop_lowest_count",
    "category_weight_percent",
    "dropped_score_count",
    "applyDropLowest"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`${fnPath} missing weighted-summary marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.js")) {
  const script = read("assets/course-materials/information-security/app/gradebook.js");
  const requiredScriptMarkers = [
    "weighted_summary",
    "weighted_course_percent",
    "configured_weight_percent",
    "renderWeightedCategorySummary",
    "category_summaries",
    "Dropped scores"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Gradebook UI missing weighted-summary marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/progress.js")) {
  const script = read("assets/course-materials/information-security/app/progress.js");
  const requiredScriptMarkers = [
    "weighted_summary",
    "weighted_course_percent",
    "configured_weight_percent",
    "category_summaries",
    "Weighted course",
    "Weighted categories"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Student progress UI missing weighted-summary marker: ${marker}`);
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Teacher and student summaries calculate weighted course progress from category weights and drop-lowest rules.")) {
    fail("Implementation status is missing the weighted grade summary note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-weighted-grade-summary.js")) {
    fail("Supabase README is missing the weighted grade summary verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated weighted grade summary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated weighted grade summary verification passed.");
console.log(`- ${requiredFiles.length} weighted-summary files checked`);
