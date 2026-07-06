const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-release-management/index.ts",
  "assets/course-materials/information-security/app/releases.js",
  "docs/course-platform/implementation/current-implementation-status.md",
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

requireMarkers("supabase/functions/course-release-management/index.ts", "course-release-management", [
  "releaseActions(permissions)",
  "assertInstructorOnly",
  "Teaching assistants cannot change release states",
  "if (!permissions.isCourseInstructor)",
  "actions: releaseActions(permissions)"
]);

requireMarkers("assets/course-materials/information-security/app/releases.js", "Release Console", [
  "canUpdateReleases",
  "result.actions",
  "Update controls are available only to instructors",
  "els.state.disabled",
  "els.reason.disabled"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-ta-release-guard.js",
  "teaching assistants can view assigned releases but cannot change release states"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Teaching assistants can view assigned releases but cannot change release states"]
);

if (failures.length) {
  console.error("Authenticated TA release guard verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated TA release guard verification passed.");
console.log(`- ${requiredFiles.length} TA release guard files checked`);
