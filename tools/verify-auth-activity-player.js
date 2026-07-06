const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/activity.html",
  "assets/course-materials/information-security/app/activity-player.js",
  "supabase/seed/tc2007b_auth_activity_demo.sql"
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

if (exists("assets/course-materials/information-security/app/activity.html")) {
  const html = read("assets/course-materials/information-security/app/activity.html");
  const requiredMarkup = [
    'id="activityInstanceInput"',
    'id="loadActivityBtn"',
    'id="questionList"',
    'id="submitActivityBtn"',
    'id="activityScore"',
    'id="activityTimer"',
    "activity-player.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Activity player markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/activity-player.js")) {
  const script = read("assets/course-materials/information-security/app/activity-player.js");
  const requiredScript = [
    "startActivityAttempt",
    "submitActivityAttempt",
    "activityInstanceInput",
    "questionList",
    "submitActivityBtn",
    "URLSearchParams",
    "attempt_deadline_at",
    "startCountdown",
    "clearCountdown",
    "setInterval"
  ];
  for (const marker of requiredScript) {
    if (!script.includes(marker)) fail(`Activity player script missing: ${marker}`);
  }
  if (/is_correct|answer_key|points_awarded/i.test(script)) {
    fail("Activity player must not contain grading keys or correctness fields.");
  }
}

if (exists("supabase/seed/tc2007b_auth_activity_demo.sql")) {
  const seed = read("supabase/seed/tc2007b_auth_activity_demo.sql");
  const requiredSeed = [
    "insert into public.activity_templates",
    "insert into public.activity_instances",
    "insert into public.question_banks",
    "insert into public.questions",
    "insert into public.question_options",
    "'week-01-mission-01'",
    "'A'",
    "'B'",
    "'quiz'",
    "'active'"
  ];
  for (const marker of requiredSeed) {
    if (!seed.includes(marker)) fail(`Activity demo seed missing: ${marker}`);
  }
  if (/institutional_email|auth_user_id|student_identifier/i.test(seed)) {
    fail("Activity demo seed must not create real student/profile identity rows.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("tc2007b_auth_activity_demo.sql")) {
    fail("Supabase README is missing the authenticated activity demo seed.");
  }
  if (!readme.includes("node tools/verify-auth-activity-player.js")) {
    fail("Supabase README is missing the activity player verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated activity player verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated activity player verification passed.");
console.log(`- ${requiredFiles.length} activity player files checked`);
