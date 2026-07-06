const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-3e-content-library-plan.md",
  "supabase/functions/course-content-library/index.ts",
  "assets/course-materials/information-security/app/content-library.html",
  "assets/course-materials/information-security/app/content-library.js",
  "assets/course-materials/information-security/app/content-library-api.js"
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

if (exists("supabase/functions/course-content-library/index.ts")) {
  const fn = read("supabase/functions/course-content-library/index.ts");
  const requiredFunctionMarkers = [
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "content_items",
    "content_releases",
    "list_content_items",
    "save_content_item",
    "create_draft_release",
    "contains_sensitive_content",
    "source_kind",
    "source_ref",
    "release_events",
    "content_item_saved",
    "draft_release_created",
    "audit_log",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-content-library missing: ${marker}`);
  }
  if (!/teaching_assistant[\s\S]*cannot|cannot[\s\S]*teaching_assistant/.test(fn)) {
    fail("course-content-library must explicitly keep teaching assistants out of content authoring.");
  }
}

if (exists("assets/course-materials/information-security/app/content-library.html")) {
  const html = read("assets/course-materials/information-security/app/content-library.html");
  const requiredMarkup = [
    "TC2007B · Content Library",
    'id="refreshContentLibraryBtn"',
    'id="saveContentItemBtn"',
    'id="contentItemRows"',
    'id="contentTitleInput"',
    'id="contentSlugInput"',
    'id="contentTypeSelect"',
    'id="contentSourceKindSelect"',
    'id="contentSourceRefInput"',
    'id="contentSensitiveInput"',
    'id="createDraftReleaseInput"',
    'id="draftReleaseSectionInput"',
    'id="draftReleaseSessionInput"',
    "content-library.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Content Library markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/content-library-api.js")) {
  const api = read("assets/course-materials/information-security/app/content-library-api.js");
  const requiredApiMarkers = [
    "course-content-library",
    "loadContentLibrary",
    "saveContentItem",
    "Authorization",
    "list_content_items",
    "save_content_item"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Content Library API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/content-library.js")) {
  const script = read("assets/course-materials/information-security/app/content-library.js");
  const requiredScriptMarkers = [
    "loadContentLibrary",
    "saveContentItem",
    "contentItemRows",
    "create_draft_release",
    "contains_sensitive_content",
    "source_kind",
    "source_ref",
    "draftReleaseSectionInput",
    "draftReleaseSessionInput"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Content Library UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("content-library.html")) {
    fail("Course App dashboard is missing Content Library teacher link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("contentLibraryFunction")) {
    fail("Platform config is missing contentLibraryFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-content-library]")) {
    fail("supabase/config.toml is missing course-content-library.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Instructors can create content items")) {
    fail("Implementation status is missing Content Library completion note.");
  }
  if (!status.includes("node tools\\verify-auth-content-library.js")) {
    fail("Implementation status is missing the Content Library verifier command.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-content-library")) {
    fail("Supabase README is missing course-content-library deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-content-library.js")) {
    fail("Supabase README is missing the Content Library verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated Content Library verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated Content Library verification passed.");
console.log(`- ${requiredFiles.length} Content Library files checked`);
