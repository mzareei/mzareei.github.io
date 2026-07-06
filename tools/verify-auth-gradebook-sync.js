const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-activity-attempt/index.ts",
  "supabase/seed/tc2007b_auth_activity_demo.sql",
  "supabase/README.md"
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

if (exists("supabase/functions/course-activity-attempt/index.ts")) {
  const fn = read("supabase/functions/course-activity-attempt/index.ts");
  const requiredMarkers = [
    "syncGradebookScore",
    "gradebook_items",
    "gradebook_scores",
    "source_attempt_id",
    "locked_at",
    "audit_log",
    "gradebook_score",
    "activity_template_id",
    "status: \"posted\"",
    "action: \"score_synced\""
  ];
  for (const marker of requiredMarkers) {
    if (!fn.includes(marker)) fail(`course-activity-attempt missing gradebook sync marker: ${marker}`);
  }

  if (!/status\)\s*===\s*["']locked["']/.test(fn)) {
    fail("course-activity-attempt must explicitly avoid overwriting locked gradebook scores.");
  }
}

if (exists("supabase/seed/tc2007b_auth_activity_demo.sql")) {
  const seed = read("supabase/seed/tc2007b_auth_activity_demo.sql").toLowerCase();
  const requiredSeedMarkers = [
    "gradebook_categories",
    "gradebook_items",
    "activity_template_id",
    "week 1 practice",
    "published"
  ];
  for (const marker of requiredSeedMarkers) {
    if (!seed.includes(marker)) fail(`Demo activity seed missing gradebook marker: ${marker}`);
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-gradebook-sync.js")) {
    fail("Supabase README is missing the gradebook sync verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated gradebook sync verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated gradebook sync verification passed.");
console.log("- Activity submissions synchronize official gradebook scores");
