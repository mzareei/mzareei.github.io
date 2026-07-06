const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-roster-management/index.ts",
  "assets/course-materials/information-security/app/roster.html",
  "assets/course-materials/information-security/app/roster.js",
  "assets/course-materials/information-security/app/roster-api.js",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "docs/course-platform/implementation/phase-1f-roster-corrections-plan.md"
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

requireMarkers("supabase/functions/course-roster-management/index.ts", "course-roster-management", [
  "correct_roster_profile",
  "merge_roster_profile",
  "correctRosterProfile",
  "mergeRosterProfile",
  "assertProfileInCourse",
  "profile_corrected",
  "profile_merged",
  "audit_log",
  "student_attempts",
  "gradebook_scores",
  "portfolio_entries",
  "exit_tickets",
  "participation_events"
]);

requireMarkers("assets/course-materials/information-security/app/roster.html", "Roster markup", [
  'id="selectedRosterProfile"',
  'id="correctionEmailInput"',
  'id="correctionNameInput"',
  'id="correctionStudentIdInput"',
  'id="correctionStatusSelect"',
  'id="correctionReasonInput"',
  'id="saveRosterCorrectionBtn"',
  'id="mergeSourceProfileInput"',
  'id="mergeTargetProfileInput"',
  'id="mergeRosterProfileBtn"'
]);

requireMarkers("assets/course-materials/information-security/app/roster-api.js", "Roster API", [
  "correctRosterProfile",
  "mergeRosterProfile",
  'action: "correct_roster_profile"',
  'action: "merge_roster_profile"'
]);

requireMarkers("assets/course-materials/information-security/app/roster.js", "Roster script", [
  "correctRosterProfile",
  "mergeRosterProfile",
  "selectRosterProfile",
  "saveRosterCorrection",
  "mergeSelectedRosterProfile",
  "selectedRosterProfile",
  "correctionReasonInput",
  "profile_id"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-roster-corrections.js",
  "roster correction and profile merge"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Teacher roster tools can correct profile details and merge duplicate profiles"]
);

requireMarkers("docs/course-platform/implementation/phase-1f-roster-corrections-plan.md", "Roster corrections plan", [
  "roster correction",
  "profile merge",
  "correct_roster_profile",
  "merge_roster_profile",
  "audit_log"
]);

if (failures.length) {
  console.error("Authenticated roster correction verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated roster correction verification passed.");
console.log(`- ${requiredFiles.length} roster correction files checked`);
