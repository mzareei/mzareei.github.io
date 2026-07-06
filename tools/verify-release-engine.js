const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/releases.html",
  "assets/course-materials/information-security/app/releases.js",
  "assets/course-materials/information-security/app/release-api.js",
  "supabase/functions/course-release-management/index.ts"
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

if (exists("supabase/functions/course-release-management/index.ts")) {
  const fn = read("supabase/functions/course-release-management/index.ts");
  const requiredMarkers = [
    "Authorization",
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "content_releases",
    "release_events",
    "allowedTransitions",
    "update_state",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredMarkers) {
    if (!fn.includes(marker)) fail(`course-release-management missing: ${marker}`);
  }
  if (/is_correct|answer_key|selected_option_id/i.test(fn)) {
    fail("course-release-management must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/releases.html")) {
  const html = read("assets/course-materials/information-security/app/releases.html");
  const requiredMarkup = [
    'id="releaseRows"',
    'id="releaseStateSelect"',
    'id="releaseReasonInput"',
    'id="updateReleaseBtn"',
    'id="refreshReleasesBtn"',
    "releases.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Release console markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/release-api.js")) {
  const api = read("assets/course-materials/information-security/app/release-api.js");
  const requiredApi = ["course-release-management", "action: \"list\"", "action: \"update_state\"", "Authorization"];
  for (const marker of requiredApi) {
    if (!api.includes(marker)) fail(`Release API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/releases.js")) {
  const script = read("assets/course-materials/information-security/app/releases.js");
  const requiredScript = ["loadReleases", "updateReleaseState", "releaseStateSelect", "releaseReasonInput"];
  for (const marker of requiredScript) {
    if (!script.includes(marker)) fail(`Release UI script missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("releases.html")) {
    fail("Course App dashboard is missing release console link.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-release-management]")) {
    fail("supabase/config.toml is missing course-release-management.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-release-management")) {
    fail("Supabase README is missing course-release-management deploy command.");
  }
}

if (failures.length) {
  console.error("Release engine verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release engine verification passed.");
console.log(`- ${requiredFiles.length} release engine files checked`);
