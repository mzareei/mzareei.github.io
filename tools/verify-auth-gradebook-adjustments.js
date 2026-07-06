const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
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
  const requiredMarkers = [
    "adjust_score",
    "lock_score",
    "grade_adjustments",
    "previous_score_final",
    "new_score_final",
    "reason",
    "status: \"locked\"",
    "locked_at",
    "score_adjusted",
    "score_locked",
    "score.status) === \"locked\""
  ];
  for (const marker of requiredMarkers) {
    if (!fn.includes(marker)) fail(`course-gradebook-summary missing adjustment marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook-api.js")) {
  const api = read("assets/course-materials/information-security/app/gradebook-api.js");
  const requiredApiMarkers = [
    "adjustGradebookScore",
    "lockGradebookScore",
    "action: \"adjust_score\"",
    "action: \"lock_score\""
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Gradebook API missing adjustment marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.html")) {
  const html = read("assets/course-materials/information-security/app/gradebook.html");
  const requiredMarkup = [
    'id="selectedScore"',
    'id="adjustedScoreInput"',
    'id="adjustmentReasonInput"',
    'id="applyAdjustmentBtn"',
    'id="lockScoreBtn"'
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Gradebook markup missing adjustment control: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.js")) {
  const script = read("assets/course-materials/information-security/app/gradebook.js");
  const requiredScriptMarkers = [
    "selectedScoreId",
    "adjustGradebookScore",
    "lockGradebookScore",
    "applyAdjustment",
    "lockSelectedScore",
    "adjustmentReasonInput"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Gradebook UI missing adjustment marker: ${marker}`);
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-gradebook-adjustments.js")) {
    fail("Supabase README is missing the gradebook adjustments verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook adjustments verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook adjustments verification passed.");
console.log("- Manual adjustments and score locking checked");
