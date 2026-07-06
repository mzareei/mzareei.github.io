const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-6f-gradebook-settings-plan.md",
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

if (exists("docs/course-platform/implementation/phase-6f-gradebook-settings-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-6f-gradebook-settings-plan.md");
  const requiredPlanMarkers = [
    "# Phase 6F Gradebook Settings Plan",
    "[x] **Step 1: Add focused gradebook settings verifier**",
    "[x] **Step 2: Add instructor-only category settings action**",
    "[x] **Step 3: Add teacher category settings controls**",
    "[x] **Step 4: Run focused and full verification**"
  ];
  for (const marker of requiredPlanMarkers) {
    if (!plan.includes(marker)) fail(`Gradebook settings plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-gradebook-summary/index.ts")) {
  const fn = read("supabase/functions/course-gradebook-summary/index.ts");
  const requiredFunctionMarkers = [
    "save_category",
    "saveGradebookCategory",
    "cleanCategoryName",
    "cleanWeightPercent",
    "cleanDropLowestCount",
    "cleanCategoryStatus",
    "gradebook_category_saved",
    "assertInstructorOnly",
    "audit_log",
    "gradebook_categories"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-gradebook-summary missing settings marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook-api.js")) {
  const api = read("assets/course-materials/information-security/app/gradebook-api.js");
  const requiredApiMarkers = [
    "saveGradebookCategory",
    "action: \"save_category\"",
    "category_id",
    "drop_lowest_count",
    "weight_percent"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Gradebook API missing settings marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.html")) {
  const html = read("assets/course-materials/information-security/app/gradebook.html");
  const requiredMarkup = [
    'id="categoryNameInput"',
    'id="categoryWeightInput"',
    'id="categoryDropLowestInput"',
    'id="categoryStatusSelect"',
    'id="saveCategoryBtn"',
    'id="newCategoryBtn"'
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Gradebook markup missing settings control: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.js")) {
  const script = read("assets/course-materials/information-security/app/gradebook.js");
  const requiredScriptMarkers = [
    "saveGradebookCategory",
    "saveCategorySettings",
    "renderCategorySettings",
    "clearCategorySettings",
    "categoryNameInput",
    "categoryWeightInput",
    "categoryDropLowestInput",
    "categoryStatusSelect"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Gradebook UI missing settings marker: ${marker}`);
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Instructors can create or update gradebook categories, weights, drop-lowest policy, and status.")) {
    fail("Implementation status is missing the gradebook settings note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-gradebook-settings.js")) {
    fail("Supabase README is missing the gradebook settings verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook settings verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook settings verification passed.");
console.log(`- ${requiredFiles.length} gradebook settings files checked`);
