const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-4d-legacy-quiz-compatibility-plan.md",
  "docs/course-platform/operations/legacy-quiz-migration.md",
  "supabase/functions/course-quiz-compatibility/index.ts"
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

if (exists("docs/course-platform/implementation/phase-4d-legacy-quiz-compatibility-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-4d-legacy-quiz-compatibility-plan.md");
  const markers = [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add legacy quiz list and migration actions**",
    "[x] **Step 2: Document the compatibility path**",
    "[x] **Step 1: Run legacy quiz compatibility verifier**",
    "[x] **Step 2: Run all platform verifiers**"
  ];
  for (const marker of markers) {
    if (!plan.includes(marker)) fail(`Phase 4D plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-quiz-compatibility/index.ts")) {
  const fn = read("supabase/functions/course-quiz-compatibility/index.ts");
  const markers = [
    "Authorization",
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "list_legacy_lectures",
    "migrate_lecture_bank",
    "quiz_lectures",
    "quiz_questions",
    "quiz_options",
    "content_items",
    "question_banks",
    "questions",
    "question_options",
    "activity_templates",
    "activity_instances",
    "normalizeDifficulty",
    "section_ids",
    "migrated_question_count",
    "skipped_question_count",
    "status: 401",
    "status: 403"
  ];
  for (const marker of markers) {
    if (!fn.includes(marker)) fail(`course-quiz-compatibility missing: ${marker}`);
  }
  if (/selected_option_id|quiz_answers|quiz_attempts/i.test(fn)) {
    fail("Compatibility migration must copy banks, not legacy student attempts or answers.");
  }
}

if (exists("docs/course-platform/operations/legacy-quiz-migration.md")) {
  const doc = read("docs/course-platform/operations/legacy-quiz-migration.md");
  const markers = [
    "Legacy Quiz Migration",
    "list_legacy_lectures",
    "migrate_lecture_bank",
    "quiz_*",
    "question_banks",
    "activity_instances",
    "Do not migrate legacy student attempts"
  ];
  for (const marker of markers) {
    if (!doc.includes(marker)) fail(`Legacy quiz migration doc missing: ${marker}`);
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-quiz-compatibility]")) {
    fail("supabase/config.toml is missing course-quiz-compatibility.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-quiz-compatibility")) {
    fail("Supabase README is missing course-quiz-compatibility deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-quiz-compatibility.js")) {
    fail("Supabase README is missing legacy quiz compatibility verifier command.");
  }
  if (!readme.includes("docs/course-platform/operations/legacy-quiz-migration.md")) {
    fail("Supabase README is missing the legacy quiz migration doc reference.");
  }
}

if (failures.length) {
  console.error("Authenticated legacy quiz compatibility verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated legacy quiz compatibility verification passed.");
console.log(`- ${requiredFiles.length} compatibility files checked`);
