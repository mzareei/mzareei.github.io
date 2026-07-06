const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-5-class-continuation-plan.md",
  "supabase/functions/course-session-management/index.ts",
  "assets/course-materials/information-security/app/sessions.html",
  "assets/course-materials/information-security/app/session-api.js",
  "assets/course-materials/information-security/app/sessions.js"
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

if (exists("docs/course-platform/implementation/phase-5-class-continuation-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-5-class-continuation-plan.md");
  const markers = [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add trusted session actions**",
    "[x] **Step 2: Preserve continuation links and moved releases**",
    "[x] **Step 1: Add teacher Session Console**",
    "[x] **Step 2: Surface paused and continued work to students**",
    "[x] **Step 1: Run session continuation verifier**",
    "[x] **Step 2: Run all platform verifiers**"
  ];
  for (const marker of markers) {
    if (!plan.includes(marker)) fail(`Phase 5 plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-session-management/index.ts")) {
  const fn = read("supabase/functions/course-session-management/index.ts");
  const requiredFunctionMarkers = [
    "Authorization",
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "allowedSessionTransitions",
    "class_sessions",
    "activity_templates",
    "activity_instances",
    "content_releases",
    "release_events",
    "list_sessions",
    "update_session_state",
    "continue_session",
    "continued_from_session_id",
    "activity_instance_id",
    "moved_release_ids",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-session-management missing: ${marker}`);
  }
  if (/is_correct|answer_key|selected_option_id/i.test(fn)) {
    fail("course-session-management must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/session-api.js")) {
  const api = read("assets/course-materials/information-security/app/session-api.js");
  const markers = [
    "course-session-management",
    "action: \"list_sessions\"",
    "action: \"update_session_state\"",
    "action: \"continue_session\"",
    "Authorization"
  ];
  for (const marker of markers) {
    if (!api.includes(marker)) fail(`Session API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/sessions.html")) {
  const html = read("assets/course-materials/information-security/app/sessions.html");
  const markers = [
    'id="sessionRows"',
    'id="sessionStateSelect"',
    'id="continueSessionBtn"',
    'id="releaseCarryList"',
    'id="liveActivitySelect"',
    'id="activityQrCanvas"',
    'id="activityJoinLink"',
    'id="copyActivityLinkBtn"',
    'id="continuationDateInput"',
    "qrious",
    "sessions.js"
  ];
  for (const marker of markers) {
    if (!html.includes(marker)) fail(`Session console markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/sessions.js")) {
  const script = read("assets/course-materials/information-security/app/sessions.js");
  const markers = [
    "loadSessions",
    "updateSessionState",
    "continueSession",
    "releaseCarryList",
    "continued_from_session_id",
    "activity_instance_id",
    "renderActivityLauncher",
    "activity.html?activity=",
    "QRious",
    "navigator.clipboard",
    "moved_release_ids"
  ];
  for (const marker of markers) {
    if (!script.includes(marker)) fail(`Session console script missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("sessions.html")) {
    fail("Course App dashboard is missing Session Console link.");
  }
  if (!app.includes("session_state") || !app.includes("continued_from_session_id")) {
    fail("Student dashboard must surface paused or continued session state.");
  }
}

if (exists("supabase/functions/course-auth-context/index.ts")) {
  const contextFn = read("supabase/functions/course-auth-context/index.ts");
  const markers = [
    '"paused"',
    "continued_from_session_id",
    "session_state",
    "continued_from_session_title"
  ];
  for (const marker of markers) {
    if (!contextFn.includes(marker)) fail(`course-auth-context missing continuation marker: ${marker}`);
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-session-management]")) {
    fail("supabase/config.toml is missing course-session-management.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-session-management")) {
    fail("Supabase README is missing course-session-management deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-session-continuation.js")) {
    fail("Supabase README is missing session continuation verifier command.");
  }
}

if (failures.length) {
  console.error("Authenticated session continuation verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated session continuation verification passed.");
console.log(`- ${requiredFiles.length} session continuation files checked`);
