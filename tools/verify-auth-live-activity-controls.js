const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-session-management/index.ts",
  "assets/course-materials/information-security/app/sessions.html",
  "assets/course-materials/information-security/app/sessions.js",
  "assets/course-materials/information-security/app/session-api.js",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "docs/course-platform/implementation/phase-5b-live-activity-controls-plan.md"
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

function requireMarkers(relativePath, label, markers) {
  if (!exists(relativePath)) return;
  const source = read(relativePath);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} missing: ${marker}`);
  }
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

requireMarkers("supabase/functions/course-session-management/index.ts", "course-session-management", [
  "allowedActivityTransitions",
  "update_activity_state",
  "extend_activity_window",
  "updateActivityState",
  "extendActivityWindow",
  "activity_instances",
  "time_limit_seconds",
  "ends_at",
  "activity_state_changed",
  "activity_window_extended"
]);

requireMarkers("assets/course-materials/information-security/app/sessions.html", "Session Console markup", [
  'id="activityStateSelect"',
  'id="updateActivityStateBtn"',
  'id="extendActivityMinutesInput"',
  'id="extendActivityWindowBtn"',
  'id="selectedActivityInstance"'
]);

requireMarkers("assets/course-materials/information-security/app/session-api.js", "Session API", [
  "updateActivityState",
  "extendActivityWindow",
  'action: "update_activity_state"',
  'action: "extend_activity_window"'
]);

requireMarkers("assets/course-materials/information-security/app/sessions.js", "Session Console script", [
  "allowedActivityTransitions",
  "activityStateSelect",
  "updateActivityStateBtn",
  "extendActivityMinutesInput",
  "extendActivityWindowBtn",
  "selectedActivityInstance",
  "renderActivityControls",
  "updateSelectedActivityState",
  "extendSelectedActivityWindow",
  "selectedActivityRelease"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-live-activity-controls.js",
  "live activity controls"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Teacher Session Console can start, pause, resume, close, and extend live activities"]
);

requireMarkers("docs/course-platform/implementation/phase-5b-live-activity-controls-plan.md", "Live activity controls plan", [
  "live activity controls",
  "update_activity_state",
  "extend_activity_window",
  "activity_instances",
  "Session Console"
]);

if (failures.length) {
  console.error("Authenticated live activity controls verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated live activity controls verification passed.");
console.log(`- ${requiredFiles.length} live-activity control files checked`);
