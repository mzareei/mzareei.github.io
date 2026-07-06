const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-release-maintenance/index.ts",
  "supabase/config.toml",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "docs/course-platform/implementation/phase-3d-release-maintenance-plan.md"
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

requireMarkers("supabase/functions/course-release-maintenance/index.ts", "course-release-maintenance", [
  "COURSE_MAINTENANCE_SECRET",
  "assertMaintenanceSecret",
  "content_releases",
  ".eq(\"state\", \"scheduled\")",
  ".lte(\"opens_at\", nowIso)",
  ".eq(\"state\", \"live\")",
  ".lte(\"closes_at\", nowIso)",
  "newState: \"released\"",
  "newState: \"closed\"",
  "release_events",
  "actor_profile_id: null",
  "Service opened scheduled release after opens_at.",
  "Service closed live release after closes_at.",
  "opened_releases",
  "closed_releases"
]);

requireMarkers("supabase/config.toml", "Supabase config", [
  "[functions.course-release-maintenance]",
  "verify_jwt = false"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "COURSE_MAINTENANCE_SECRET",
  "npx supabase functions deploy course-release-maintenance",
  "node tools/verify-auth-release-maintenance.js",
  "service release maintenance"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Service release maintenance can open due scheduled releases and close due live releases"]
);

requireMarkers("docs/course-platform/implementation/phase-3d-release-maintenance-plan.md", "Release maintenance plan", [
  "course-release-maintenance",
  "scheduled",
  "released",
  "live",
  "closed",
  "release_events"
]);

if (failures.length) {
  console.error("Release maintenance verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release maintenance verification passed.");
console.log(`- ${requiredFiles.length} release maintenance files checked`);
