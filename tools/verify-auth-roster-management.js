const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-1b-roster-management-plan.md",
  "supabase/functions/course-roster-management/index.ts",
  "assets/course-materials/information-security/app/roster.html",
  "assets/course-materials/information-security/app/roster-api.js",
  "assets/course-materials/information-security/app/roster.js"
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

if (exists("docs/course-platform/implementation/phase-1b-roster-management-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-1b-roster-management-plan.md");
  const markers = [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add roster preview and apply actions**",
    "[x] **Step 2: Link signed-in users to roster profiles by institutional email**",
    "[x] **Step 1: Add teacher roster import screen**",
    "[x] **Step 1: Run roster management verifier**",
    "[x] **Step 2: Run all platform verifiers**"
  ];
  for (const marker of markers) {
    if (!plan.includes(marker)) fail(`Phase 1B roster plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-roster-management/index.ts")) {
  const fn = read("supabase/functions/course-roster-management/index.ts");
  const markers = [
    "Authorization",
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "preview_roster",
    "apply_roster",
    "list_roster",
    "allowed_domains",
    "roster_imports",
    "profiles",
    "institutional_email",
    "student_identifier",
    "section_enrollments",
    "accepted_count",
    "rejected_rows",
    "status: 401",
    "status: 403"
  ];
  for (const marker of markers) {
    if (!fn.includes(marker)) fail(`course-roster-management missing: ${marker}`);
  }
  if (/service_role|SUPABASE_SERVICE_ROLE_KEY/.test(fn)) {
    fail("course-roster-management must rely on shared admin client, not literal service-role secrets.");
  }
}

if (exists("supabase/functions/course-auth-context/index.ts")) {
  const context = read("supabase/functions/course-auth-context/index.ts");
  const markers = [
    "loadOrClaimProfile",
    "institutional_email",
    "auth_user_id",
    "user.email",
    "claimed_by_email"
  ];
  for (const marker of markers) {
    if (!context.includes(marker)) fail(`course-auth-context missing profile claim marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/roster-api.js")) {
  const api = read("assets/course-materials/information-security/app/roster-api.js");
  const markers = [
    "course-roster-management",
    "action: \"preview_roster\"",
    "action: \"apply_roster\"",
    "action: \"list_roster\"",
    "Authorization"
  ];
  for (const marker of markers) {
    if (!api.includes(marker)) fail(`Roster API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/roster.html")) {
  const html = read("assets/course-materials/information-security/app/roster.html");
  const markers = [
    'id="rosterCsvInput"',
    'id="allowedDomainsInput"',
    'id="previewRosterBtn"',
    'id="applyRosterBtn"',
    'id="rosterRows"',
    "roster.js"
  ];
  for (const marker of markers) {
    if (!html.includes(marker)) fail(`Roster page markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/roster.js")) {
  const script = read("assets/course-materials/information-security/app/roster.js");
  const markers = [
    "previewRoster",
    "applyRoster",
    "listRoster",
    "parseRosterCsv",
    "institutional_email",
    "section_code",
    "allowed_domains"
  ];
  for (const marker of markers) {
    if (!script.includes(marker)) fail(`Roster UI script missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("roster.html")) {
    fail("Course App dashboard is missing roster import link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("rosterManagementFunction")) {
    fail("platform-config.js is missing rosterManagementFunction.");
  }
  if (!config.includes("allowedInstitutionalDomains")) {
    fail("platform-config.js is missing allowedInstitutionalDomains.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-roster-management]")) {
    fail("supabase/config.toml is missing course-roster-management.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-roster-management")) {
    fail("Supabase README is missing course-roster-management deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-roster-management.js")) {
    fail("Supabase README is missing roster management verifier command.");
  }
}

if (failures.length) {
  console.error("Authenticated roster management verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated roster management verification passed.");
console.log(`- ${requiredFiles.length} roster management files checked`);
