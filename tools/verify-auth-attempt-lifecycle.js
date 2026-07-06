const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-activity-attempt/index.ts",
  "assets/course-materials/information-security/app/activity-api.js",
  "supabase/migrations/0009_activity_attempt_limits.sql",
  "assets/course-materials/information-security/app/activity-player.js"
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

if (exists("supabase/functions/course-activity-attempt/index.ts")) {
  const fn = read("supabase/functions/course-activity-attempt/index.ts");
  const requiredFunctionMarkers = [
    "Authorization",
    "auth.getUser",
    "profiles",
    "section_enrollments",
    "activity_instances",
    "activity_templates",
    "content_releases",
    "student_attempts",
    "student_responses",
    "question_options",
    "is_correct",
    "score_percent",
    "score_final",
    "allowed_attempts",
    "attempt_number",
    "attempts_remaining",
    "No attempts are remaining for this activity",
    "time_limit_seconds",
    "attempt_deadline_at",
    "assertAttemptWithinTimeLimit",
    "Activity time limit has expired",
    "attemptLimitPolicy",
    "assertReleasedForStudent",
    "visibleAttemptStates",
    "start_attempt",
    "submit_attempt",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-activity-attempt missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/activity-api.js")) {
  const api = read("assets/course-materials/information-security/app/activity-api.js");
  const requiredApiMarkers = [
    "course-activity-attempt",
    "action: \"start_attempt\"",
    "action: \"submit_attempt\"",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Activity API missing: ${marker}`);
  }
  if (/is_correct|answer_key|points_awarded/i.test(api)) {
    fail("Browser activity API must not contain grading keys or correctness fields.");
  }
}

if (exists("supabase/migrations/0009_activity_attempt_limits.sql")) {
  const migration = read("supabase/migrations/0009_activity_attempt_limits.sql");
  const requiredMigrationMarkers = [
    "student_attempts",
    "attempt_number",
    "student_attempts_activity_instance_id_profile_id_key",
    "student_attempts_activity_profile_attempt_idx"
  ];
  for (const marker of requiredMigrationMarkers) {
    if (!migration.includes(marker)) fail(`Attempt-limit migration missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/activity-player.js")) {
  const player = read("assets/course-materials/information-security/app/activity-player.js");
  const requiredPlayerMarkers = [
    "attempt_number",
    "allowed_attempts",
    "attempts_remaining"
  ];
  for (const marker of requiredPlayerMarkers) {
    if (!player.includes(marker)) fail(`Activity player missing attempt-limit marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("activityAttemptFunction")) {
    fail("Platform config is missing activityAttemptFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-activity-attempt]")) {
    fail("supabase/config.toml is missing course-activity-attempt.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-activity-attempt")) {
    fail("Supabase README is missing course-activity-attempt deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-attempt-lifecycle.js")) {
    fail("Supabase README is missing the attempt lifecycle verifier.");
  }
  if (!readme.includes("0009_activity_attempt_limits.sql")) {
    fail("Supabase README is missing migration 0009.");
  }
}

if (failures.length) {
  console.error("Authenticated attempt lifecycle verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated attempt lifecycle verification passed.");
console.log(`- ${requiredFiles.length} attempt lifecycle files checked`);
