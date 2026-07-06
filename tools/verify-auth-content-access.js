const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-content-access/index.ts",
  "assets/course-materials/information-security/app/content-api.js",
  "assets/course-materials/information-security/app/content.html",
  "assets/course-materials/information-security/app/content.js",
  "assets/course-materials/information-security/app/app.js",
  "assets/course-materials/information-security/platform-config.js",
  "supabase/config.toml",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md"
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

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("supabase/functions/course-content-access/index.ts")) {
  const fn = read("supabase/functions/course-content-access/index.ts");
  const requiredFunctionMarkers = [
    "auth.getUser",
    "profiles",
    "section_enrollments",
    "content_releases",
    "content_items",
    "visibleContentStates",
    "release_id",
    "source_ref",
    "sectionAllowed",
    "Access denied",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-content-access missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/content-api.js")) {
  const api = read("assets/course-materials/information-security/app/content-api.js");
  const requiredApiMarkers = [
    "course-content-access",
    "action: \"open_content\"",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Content API missing: ${marker}`);
  }
  if (/is_correct|answer_key|points_awarded/i.test(api)) {
    fail("Content API must not contain grading keys or correctness fields.");
  }
}

if (exists("assets/course-materials/information-security/app/content.html")) {
  const html = read("assets/course-materials/information-security/app/content.html");
  const requiredMarkup = [
    'id="contentStatus"',
    'id="contentTitle"',
    'id="contentSummary"',
    'id="contentLaunch"',
    "content.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Content page markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/content.js")) {
  const script = read("assets/course-materials/information-security/app/content.js");
  const requiredScript = [
    "loadContentAccess",
    "URLSearchParams",
    "release",
    "Access denied",
    "contentLaunch"
  ];
  for (const marker of requiredScript) {
    if (!script.includes(marker)) fail(`Content page script missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("content.html?release=")) {
    fail("Dashboard released items must link through content.html?release=.");
  }
  if (!app.includes("renderReleasedItems")) {
    fail("Dashboard should render released content with a dedicated renderer.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("contentAccessFunction")) {
    fail("Platform config is missing contentAccessFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-content-access]")) {
    fail("supabase/config.toml is missing course-content-access.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-content-access")) {
    fail("Supabase README is missing course-content-access deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-content-access.js")) {
    fail("Supabase README is missing the content access verifier.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Authenticated content access gate")) {
    fail("Implementation status is missing the authenticated content access note.");
  }
}

if (failures.length) {
  console.error("Authenticated content access verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated content access verification passed.");
console.log(`- ${requiredFiles.length} content access files checked`);
