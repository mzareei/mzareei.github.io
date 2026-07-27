const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-1h-identity-confirmation-plan.md",
  "supabase/migrations/0010_profile_identity_confirmations.sql",
  "supabase/functions/course-identity-confirmation/index.ts",
  "assets/course-materials/information-security/app/identity.html",
  "assets/course-materials/information-security/app/identity.js",
  "assets/course-materials/information-security/app/identity-api.js"
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

if (exists("supabase/migrations/0010_profile_identity_confirmations.sql")) {
  const migration = read("supabase/migrations/0010_profile_identity_confirmations.sql").toLowerCase();
  const requiredMigrationMarkers = [
    "create table if not exists public.profile_identity_confirmations",
    "course_id text not null references public.courses",
    "profile_id uuid not null references public.profiles",
    "status text not null",
    "confirmed",
    "reported_issue",
    "issue_note",
    "confirmed_at",
    "unique (course_id, profile_id)",
    "alter table public.profile_identity_confirmations enable row level security;",
    "revoke all on public.profile_identity_confirmations from anon, authenticated;"
  ];
  for (const marker of requiredMigrationMarkers) {
    if (!migration.includes(marker)) fail(`Identity confirmation migration missing: ${marker}`);
  }
}

if (exists("supabase/tests/rls_auth_platform_checks.sql")) {
  const rls = read("supabase/tests/rls_auth_platform_checks.sql");
  if (!rls.includes("'profile_identity_confirmations'")) {
    fail("RLS safety test is missing profile_identity_confirmations.");
  }
}

if (exists("supabase/functions/course-identity-confirmation/index.ts")) {
  const fn = read("supabase/functions/course-identity-confirmation/index.ts");
  const requiredFunctionMarkers = [
    "../_shared/identity.ts",
    "auth.getUser",
    "assertCourseEmailAllowed",
    "assertProfileMatchesAuthEmail",
    "profile_identity_confirmations",
    "section_enrollments",
    "list_identity_confirmation",
    "confirm_identity",
    "report_identity_issue",
    "identity_confirmed",
    "identity_issue_reported",
    "audit_log",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-identity-confirmation missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/identity.html")) {
  const html = read("assets/course-materials/information-security/app/identity.html");
  const requiredMarkup = [
    "TC2007B · Identity Confirmation",
    'id="refreshIdentityBtn"',
    'id="confirmIdentityBtn"',
    'id="reportIdentityIssueBtn"',
    'id="identityStatus"',
    'id="identityProfileSummary"',
    'id="identitySectionRows"',
    'id="identityIssueNoteInput"',
    "identity.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Identity confirmation markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/identity-api.js")) {
  const api = read("assets/course-materials/information-security/app/identity-api.js");
  const requiredApiMarkers = [
    "course-identity-confirmation",
    "loadIdentityConfirmation",
    "confirmIdentity",
    "reportIdentityIssue",
    "Authorization",
    "list_identity_confirmation",
    "confirm_identity",
    "report_identity_issue"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Identity confirmation API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/identity.js")) {
  const script = read("assets/course-materials/information-security/app/identity.js");
  const requiredScriptMarkers = [
    "loadIdentityConfirmation",
    "confirmIdentity",
    "reportIdentityIssue",
    "identityProfileSummary",
    "identitySectionRows",
    "identityIssueNoteInput",
    "confirmation"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Identity confirmation UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("identity.html")) {
    fail("Course App dashboard is missing identity confirmation link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("identityConfirmationFunction")) {
    fail("Platform config is missing identityConfirmationFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-identity-confirmation]")) {
    fail("supabase/config.toml is missing course-identity-confirmation.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Students can confirm or report their roster identity")) {
    fail("Implementation status is missing identity confirmation completion note.");
  }
  if (!status.includes("node tools\\verify-auth-identity-confirmation.js")) {
    fail("Implementation status is missing the identity confirmation verifier command.");
  }
  if (!status.includes("0010_profile_identity_confirmations.sql")) {
    fail("Implementation status live steps must mention migration 0010.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("0010_profile_identity_confirmations.sql")) {
    fail("Supabase README is missing migration 0010.");
  }
  if (!readme.includes("npx supabase functions deploy course-identity-confirmation")) {
    fail("Supabase README is missing course-identity-confirmation deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-identity-confirmation.js")) {
    fail("Supabase README is missing the identity confirmation verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated identity confirmation verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated identity confirmation verification passed.");
console.log(`- ${requiredFiles.length} identity confirmation files checked`);
