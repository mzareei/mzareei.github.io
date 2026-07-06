const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/index.html",
  "assets/course-materials/information-security/app/app.js",
  "assets/course-materials/information-security/app/app.css",
  "supabase/functions/course-auth-context/index.ts",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "docs/course-platform/implementation/phase-2c-teacher-context-switchers-plan.md"
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

requireMarkers("assets/course-materials/information-security/app/index.html", "Course App markup", [
  'id="teacherContextPanel"',
  'id="courseContextSelect"',
  'id="sectionContextSelect"',
  'id="sessionContextSelect"',
  'id="teacherContextLinks"'
]);

requireMarkers("assets/course-materials/information-security/app/app.js", "Course App script", [
  "teacherContextPanel",
  "courseContextSelect",
  "sectionContextSelect",
  "sessionContextSelect",
  "renderTeacherContextSwitchers",
  "selectedTeacherContext",
  "teacher_sessions",
  "teacher-context"
]);

requireMarkers("assets/course-materials/information-security/app/app.css", "Course App styles", [
  ".teacher-context-panel",
  ".teacher-context-grid",
  ".teacher-context-links"
]);

requireMarkers("supabase/functions/course-auth-context/index.ts", "course-auth-context", [
  "teacher_sessions",
  "loadTeacherSessions",
  "isTeacherContext",
  "teacherRoles",
  "teaching_assistant",
  "permittedSectionIds",
  "class_sessions",
  "continued_from_session_id"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-teacher-context-switchers.js",
  "teacher context switchers"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Teacher dashboard includes course, section, and session switchers"]
);

requireMarkers("docs/course-platform/implementation/phase-2c-teacher-context-switchers-plan.md", "Teacher context switchers plan", [
  "teacher context switchers",
  "course",
  "section",
  "session",
  "teacher_sessions"
]);

if (failures.length) {
  console.error("Authenticated teacher context switcher verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated teacher context switcher verification passed.");
console.log(`- ${requiredFiles.length} teacher-context files checked`);
