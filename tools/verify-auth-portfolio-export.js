const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-7f-student-portfolio-export-plan.md",
  "supabase/functions/course-portfolio-entry/index.ts",
  "assets/course-materials/information-security/app/portfolio.html",
  "assets/course-materials/information-security/app/portfolio.js",
  "assets/course-materials/information-security/app/portfolio-api.js"
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

if (exists("docs/course-platform/implementation/phase-7f-student-portfolio-export-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-7f-student-portfolio-export-plan.md");
  const requiredPlanMarkers = [
    "# Phase 7F Student Portfolio Export Plan",
    "[x] **Step 1: Add focused portfolio export verifier**",
    "[x] **Step 2: Add trusted export action**",
    "[x] **Step 3: Add student export controls**",
    "[x] **Step 4: Run focused and full verification**"
  ];
  for (const marker of requiredPlanMarkers) {
    if (!plan.includes(marker)) fail(`Portfolio export plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-portfolio-entry/index.ts")) {
  const fn = read("supabase/functions/course-portfolio-entry/index.ts");
  const requiredFunctionMarkers = [
    "export_entries",
    "buildPortfolioExport",
    "exported_at",
    "student_identifier",
    "institutional_email",
    "entries",
    "sections",
    "filename"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-portfolio-entry missing export marker: ${marker}`);
  }
  if (/question_options|answer_key|selected_option_id|is_correct/i.test(fn)) {
    fail("Portfolio export must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/portfolio-api.js")) {
  const api = read("assets/course-materials/information-security/app/portfolio-api.js");
  const requiredApiMarkers = [
    "exportPortfolioEntries",
    "action: \"export_entries\""
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Portfolio API missing export marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/portfolio.html")) {
  const html = read("assets/course-materials/information-security/app/portfolio.html");
  const requiredMarkup = [
    'id="exportPortfolioBtn"',
    "Export portfolio"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Portfolio markup missing export marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/portfolio.js")) {
  const script = read("assets/course-materials/information-security/app/portfolio.js");
  const requiredScriptMarkers = [
    "exportPortfolioEntries",
    "exportPortfolio",
    "downloadPortfolioExport",
    "Blob",
    "application/json",
    "URL.createObjectURL",
    "portfolio-export"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Portfolio UI missing export marker: ${marker}`);
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Students can export their own portfolio evidence as a local JSON record.")) {
    fail("Implementation status is missing the student portfolio export note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-portfolio-export.js")) {
    fail("Supabase README is missing the portfolio export verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated portfolio export verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated portfolio export verification passed.");
console.log(`- ${requiredFiles.length} portfolio export files checked`);
