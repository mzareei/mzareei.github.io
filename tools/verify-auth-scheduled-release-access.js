const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-auth-context/index.ts",
  "supabase/functions/course-content-access/index.ts",
  "supabase/functions/course-activity-attempt/index.ts",
  "supabase/functions/course-student-progress/index.ts",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md"
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

requireMarkers("supabase/functions/course-auth-context/index.ts", "course-auth-context", [
  '"scheduled"',
  "isScheduledOpen",
  "isReleaseVisible",
  "effectiveReleaseState",
  "state: effectiveReleaseState"
]);

requireMarkers("supabase/functions/course-content-access/index.ts", "course-content-access", [
  '"scheduled"',
  "isScheduledOpen",
  "effectiveReleaseState",
  "scheduled release is not open yet",
  "state: effectiveReleaseState"
]);

requireMarkers("supabase/functions/course-activity-attempt/index.ts", "course-activity-attempt", [
  '"scheduled"',
  "isScheduledOpen",
  "isReleaseVisibleForAttempt",
  "scheduled release is not open yet"
]);

requireMarkers("supabase/functions/course-student-progress/index.ts", "course-student-progress", [
  '"scheduled"',
  "isScheduledOpen",
  "isReleaseVisible",
  "effectiveReleaseState",
  "state: effectiveReleaseState"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-scheduled-release-access.js",
  "scheduled releases whose open time has arrived"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Scheduled releases become visible after their open time"]
);

if (failures.length) {
  console.error("Scheduled release access verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Scheduled release access verification passed.");
console.log(`- ${requiredFiles.length} scheduled-release access files checked`);
