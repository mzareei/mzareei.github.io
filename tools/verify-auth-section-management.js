const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-1g-section-management-plan.md",
  "supabase/functions/course-section-management/index.ts",
  "assets/course-materials/information-security/app/sections.html",
  "assets/course-materials/information-security/app/sections.js",
  "assets/course-materials/information-security/app/section-api.js"
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

if (exists("docs/course-platform/implementation/phase-1g-section-management-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-1g-section-management-plan.md");
  const requiredPlanMarkers = [
    "# Phase 1G Section Management Plan",
    "[x] **Step 1: Add focused section-management verifier**",
    "[x] **Step 2: Add instructor-only section management function**",
    "[x] **Step 3: Add teacher section management page**",
    "[x] **Step 4: Run focused and full verification**"
  ];
  for (const marker of requiredPlanMarkers) {
    if (!plan.includes(marker)) fail(`Section management plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-section-management/index.ts")) {
  const fn = read("supabase/functions/course-section-management/index.ts");
  const requiredFunctionMarkers = [
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "course_sections",
    "list_sections",
    "save_section",
    "cleanSectionCode",
    "cleanSectionName",
    "cleanMeetingPattern",
    "cleanCampus",
    "cleanSectionStatus",
    "section_saved",
    "audit_log",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-section-management missing marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/section-api.js")) {
  const api = read("assets/course-materials/information-security/app/section-api.js");
  const requiredApiMarkers = [
    "course-section-management",
    "loadCourseSections",
    "saveCourseSection",
    "action: \"list_sections\"",
    "action: \"save_section\"",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Section API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/sections.html")) {
  const html = read("assets/course-materials/information-security/app/sections.html");
  const requiredMarkup = [
    'id="sectionRows"',
    'id="sectionCodeInput"',
    'id="sectionNameInput"',
    'id="sectionMeetingPatternInput"',
    'id="sectionCampusInput"',
    'id="sectionStatusSelect"',
    'id="saveSectionBtn"',
    'id="newSectionBtn"',
    "sections.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Section management markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/sections.js")) {
  const script = read("assets/course-materials/information-security/app/sections.js");
  const requiredScriptMarkers = [
    "loadCourseSections",
    "saveCourseSection",
    "sectionRows",
    "selectedSectionId",
    "renderSections",
    "selectSection",
    "saveSection",
    "clearSectionForm"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Section management UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("sections.html")) {
    fail("Course App dashboard is missing section management link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("sectionManagementFunction")) {
    fail("Platform config is missing sectionManagementFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-section-management]")) {
    fail("supabase/config.toml is missing course-section-management.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Instructors can create and update course sections before importing rosters.")) {
    fail("Implementation status is missing the section management note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-section-management")) {
    fail("Supabase README is missing course-section-management deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-section-management.js")) {
    fail("Supabase README is missing the section management verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated section management verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated section management verification passed.");
console.log(`- ${requiredFiles.length} section management files checked`);
