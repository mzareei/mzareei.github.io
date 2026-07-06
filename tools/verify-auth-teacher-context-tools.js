const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/teacher-context.js",
  "assets/course-materials/information-security/app/sessions.js",
  "assets/course-materials/information-security/app/session-api.js",
  "assets/course-materials/information-security/app/releases.js",
  "assets/course-materials/information-security/app/release-api.js",
  "assets/course-materials/information-security/app/gradebook.js",
  "assets/course-materials/information-security/app/insights.js",
  "assets/course-materials/information-security/app/insights-api.js",
  "supabase/functions/course-learning-insights/index.ts",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "docs/course-platform/implementation/phase-2d-context-aware-teacher-tools-plan.md"
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

requireMarkers("assets/course-materials/information-security/app/teacher-context.js", "teacher-context helper", [
  "teacherContextFromUrl",
  "contextQuery",
  "matchesTeacherContext",
  "URLSearchParams",
  "section",
  "session"
]);

requireMarkers("assets/course-materials/information-security/app/sessions.js", "sessions page", [
  "teacherContextFromUrl",
  "matchesTeacherContext",
  "contextLabel",
  "contextFilters",
  "filteredSessionRows",
  "selectedTeacherContext.sessionId"
]);

requireMarkers("assets/course-materials/information-security/app/session-api.js", "session API", [
  "filters = {}",
  "section_id: filters.sectionId",
  "session_id: filters.sessionId"
]);

requireMarkers("assets/course-materials/information-security/app/releases.js", "releases page", [
  "teacherContextFromUrl",
  "matchesTeacherContext",
  "contextLabel",
  "filteredReleaseRows",
  "selectedTeacherContext.sessionId"
]);

requireMarkers("assets/course-materials/information-security/app/release-api.js", "release API", [
  "filters = {}",
  "section_id: filters.sectionId",
  "session_id: filters.sessionId"
]);

requireMarkers("assets/course-materials/information-security/app/gradebook.js", "gradebook page", [
  "teacherContextFromUrl",
  "initialContextFilters",
  "selectedTeacherContext.sectionId",
  "section_id: selectedTeacherContext.sectionId"
]);

requireMarkers("assets/course-materials/information-security/app/insights.js", "insights page", [
  "teacherContextFromUrl",
  "loadLearningInsights(initialContextFilters())",
  "selectedTeacherContext.sectionId"
]);

requireMarkers("assets/course-materials/information-security/app/insights-api.js", "insights API", [
  "filters = {}",
  "section_id: filters.sectionId"
]);

requireMarkers("supabase/functions/course-learning-insights/index.ts", "learning insights function", [
  "cleanUuid(body.section_id",
  "selectedSectionId",
  "filterSelectedSections",
  "section_id"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-teacher-context-tools.js",
  "context-aware teacher tools"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Teacher tools honor selected course, section, and session context"]
);

requireMarkers("docs/course-platform/implementation/phase-2d-context-aware-teacher-tools-plan.md", "Context-aware tools plan", [
  "context-aware teacher tools",
  "teacher-context.js",
  "sessions",
  "releases",
  "gradebook",
  "insights"
]);

if (failures.length) {
  console.error("Authenticated context-aware teacher tools verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated context-aware teacher tools verification passed.");
console.log(`- ${requiredFiles.length} context-aware teacher tool files checked`);
