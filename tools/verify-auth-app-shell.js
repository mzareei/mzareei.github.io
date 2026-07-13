const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "assets/course-materials/information-security/app/index.html",
  "assets/course-materials/information-security/app/app.css",
  "assets/course-materials/information-security/app/app.js",
  "assets/course-materials/information-security/app/auth-api.js",
  "assets/course-materials/information-security/platform-config.js",
  "supabase/functions/course-auth-context/index.ts"
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function fail(message) {
  failures.push(message);
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

if (exists("assets/course-materials/information-security/app/index.html")) {
  const html = read("assets/course-materials/information-security/app/index.html");
  const requiredMarkup = [
    'id="emailInput"',
    'id="sendCodeBtn"',
    'id="otpInput"',
    'id="verifyCodeBtn"',
    'Send sign-in email',
    'Optional one-time code',
    'id="signedInPanel"',
    'id="releasedItems"',
    'platform-config.js',
    'app.js'
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`App shell markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  const requiredConfig = ["TC2007B_PLATFORM_CONFIG", "courseId", "supabaseUrl", "supabaseAnonKey", "authContextFunction"];
  for (const marker of requiredConfig) {
    if (!config.includes(marker)) fail(`Platform config missing: ${marker}`);
  }
  if (/service[_-]?role|SUPABASE_SECRET_KEYS|sb_secret_/i.test(config)) {
    fail("Platform config must not contain server secrets.");
  }
}

if (exists("assets/course-materials/information-security/app/auth-api.js")) {
  const api = read("assets/course-materials/information-security/app/auth-api.js");
  const requiredApi = ["signInWithOtp", "shouldCreateUser: true", "emailRedirectTo", "verifyOtp", "getSession", "signOut", "course-auth-context"];
  for (const marker of requiredApi) {
    if (!api.includes(marker)) fail(`Auth API missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-auth-context/index.ts")) {
  const fn = read("supabase/functions/course-auth-context/index.ts");
  const requiredFunctionMarkers = [
    "Authorization",
    "auth.getUser",
    "profiles",
    "course_memberships",
    "section_enrollments",
    "content_releases",
    "status: 401"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-auth-context missing: ${marker}`);
  }
  if (/is_correct|answer_key|selected_option_id/i.test(fn)) {
    fail("course-auth-context must not return answer keys or selected answer records.");
  }
}

if (exists("_courses/information-security.md")) {
  const course = read("_courses/information-security.md");
  if (!course.includes("/assets/course-materials/information-security/app/")) {
    fail("Course page is missing Course App link.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-auth-context")) {
    fail("Supabase README is missing course-auth-context deploy command.");
  }
}

if (failures.length) {
  console.error("Authenticated app shell verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated app shell verification passed.");
console.log(`- ${requiredFiles.length} app/auth files checked`);
