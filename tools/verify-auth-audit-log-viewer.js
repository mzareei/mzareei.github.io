const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-8b-audit-log-viewer-plan.md",
  "supabase/functions/course-audit-log/index.ts",
  "assets/course-materials/information-security/app/audit.html",
  "assets/course-materials/information-security/app/audit.js",
  "assets/course-materials/information-security/app/audit-api.js"
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

if (exists("docs/course-platform/implementation/phase-8b-audit-log-viewer-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8b-audit-log-viewer-plan.md");
  const requiredPlanMarkers = [
    "# Phase 8B Audit Log Viewer Plan",
    "[x] **Step 1: Add focused audit-log viewer verifier**",
    "[x] **Step 2: Add instructor-only audit log function**",
    "[x] **Step 3: Add teacher audit log page**",
    "[x] **Step 4: Run focused and full verification**"
  ];
  for (const marker of requiredPlanMarkers) {
    if (!plan.includes(marker)) fail(`Audit log viewer plan missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-audit-log/index.ts")) {
  const fn = read("supabase/functions/course-audit-log/index.ts");
  const requiredFunctionMarkers = [
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "audit_log",
    "list_audit_events",
    "audit_events",
    "cleanTargetType",
    "cleanAction",
    "cleanLimit",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-audit-log missing marker: ${marker}`);
  }
  if (/question_options|answer_key|selected_option_id|is_correct/i.test(fn)) {
    fail("course-audit-log must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/audit.html")) {
  const html = read("assets/course-materials/information-security/app/audit.html");
  const requiredMarkup = [
    'id="targetTypeFilter"',
    'id="actionFilter"',
    'id="auditLimitInput"',
    'id="refreshAuditBtn"',
    'id="auditRows"',
    "audit.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Audit log markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/audit-api.js")) {
  const api = read("assets/course-materials/information-security/app/audit-api.js");
  const requiredApiMarkers = [
    "course-audit-log",
    "loadAuditEvents",
    "action: \"list_audit_events\"",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Audit API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/audit.js")) {
  const script = read("assets/course-materials/information-security/app/audit.js");
  const requiredScriptMarkers = [
    "loadAuditEvents",
    "auditRows",
    "targetTypeFilter",
    "actionFilter",
    "renderAuditRows",
    "metadata"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Audit UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("audit.html")) {
    fail("Course App dashboard is missing the audit log link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("auditLogFunction")) {
    fail("Platform config is missing auditLogFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-audit-log]")) {
    fail("supabase/config.toml is missing course-audit-log.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Instructors can review sensitive course audit events from the teacher console.")) {
    fail("Implementation status is missing the audit log viewer note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-audit-log")) {
    fail("Supabase README is missing course-audit-log deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-audit-log-viewer.js")) {
    fail("Supabase README is missing the audit log viewer verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated audit log viewer verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated audit log viewer verification passed.");
console.log(`- ${requiredFiles.length} audit log viewer files checked`);
