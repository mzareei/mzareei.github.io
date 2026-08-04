const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-1c-role-permissions-plan.md",
  "supabase/functions/course-release-management/index.ts",
  "supabase/functions/course-session-management/index.ts",
  "supabase/functions/course-gradebook-summary/index.ts",
  "supabase/functions/course-learning-insights/index.ts"
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

if (exists("docs/course-platform/implementation/phase-1c-role-permissions-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-1c-role-permissions-plan.md");
  const markers = [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add teaching assistant support for section-scoped tools**",
    "[x] **Step 2: Keep grade-changing and roster actions instructor-only**",
    "[x] **Step 1: Run role permission verifier**",
    "[x] **Step 2: Run all platform verifiers**"
  ];
  for (const marker of markers) {
    if (!plan.includes(marker)) fail(`Role permissions plan missing: ${marker}`);
  }
}

const scopedFunctions = [
  "supabase/functions/course-release-management/index.ts",
  "supabase/functions/course-session-management/index.ts",
  "supabase/functions/course-gradebook-summary/index.ts",
  "supabase/functions/course-learning-insights/index.ts"
];

for (const file of scopedFunctions) {
  if (!exists(file)) continue;
  const source = read(file);
  const markers = [
    "teaching_assistant",
    "section_enrollments",
    "permittedSectionIds",
    "assertSectionAllowed"
  ];
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${file} missing role-scope marker: ${marker}`);
  }
  if (!/isCourseInstructor|isGlobalCourseInstructor/.test(source)) {
    fail(`${file} missing instructor-scope marker.`);
  }
}

const authContextPath = "supabase/functions/course-auth-context/index.ts";
if (exists(authContextPath)) {
  const authContext = read(authContextPath);
  for (const marker of ["teacher_sessions", "loadTeacherSessions", "section_enrollments", "permittedSectionIds"]) {
    if (!authContext.includes(marker)) fail(`${authContextPath} missing role-scope marker: ${marker}`);
  }
  if (!/isGlobalCourseInstructor|isGlobalOwner/.test(authContext)) {
    fail(`${authContextPath} must keep regular instructors section-scoped; only platform owners are global.`);
  }
}

for (const file of scopedFunctions) {
  if (!exists(file)) continue;
  const source = read(file);
  if (!/platform_owner/.test(source) || !/instructor/.test(source)) {
    fail(`${file} must distinguish platform-owner and instructor scope.`);
  }
  if (!/isGlobalCourseInstructor|isGlobalOwner/.test(source)) {
    fail(`${file} must keep regular instructors section-scoped; only platform owners are global.`);
  }
}

if (exists("supabase/functions/course-gradebook-summary/index.ts")) {
  const gradebook = read("supabase/functions/course-gradebook-summary/index.ts");
  const markers = [
    "assertInstructorOnly",
    "adjust_score",
    "lock_score",
    "Teaching assistants cannot change final grades"
  ];
  for (const marker of markers) {
    if (!gradebook.includes(marker)) fail(`course-gradebook-summary missing TA grade guard: ${marker}`);
  }
}

if (exists("supabase/functions/course-roster-management/index.ts")) {
  const roster = read("supabase/functions/course-roster-management/index.ts");
  if (!roster.includes('const teacherRoles = ["platform_owner", "instructor"]')) {
    fail("course-roster-management should keep roster import instructor-only.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-role-permissions.js")) {
    fail("Supabase README is missing role permission verifier command.");
  }
}

if (failures.length) {
  console.error("Authenticated role permission verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated role permission verification passed.");
console.log(`- ${requiredFiles.length} role-permission files checked`);
