const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-6h-participation-events-plan.md",
  "supabase/functions/course-participation-events/index.ts",
  "assets/course-materials/information-security/app/participation.html",
  "assets/course-materials/information-security/app/participation.js",
  "assets/course-materials/information-security/app/participation-api.js"
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

if (exists("supabase/functions/course-participation-events/index.ts")) {
  const fn = read("supabase/functions/course-participation-events/index.ts");
  const requiredFunctionMarkers = [
    "auth.getUser",
    "course_memberships",
    "platform_owner",
    "instructor",
    "teaching_assistant",
    "section_enrollments",
    "participation_events",
    "list_participation_context",
    "record_participation_event",
    "assertSectionAllowed",
    "assertStudentInSection",
    "audit_log",
    "participation_event_recorded",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-participation-events missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/participation.html")) {
  const html = read("assets/course-materials/information-security/app/participation.html");
  const requiredMarkup = [
    "TC2007B · Participation",
    'id="refreshParticipationBtn"',
    'id="recordParticipationBtn"',
    'id="participationSectionInput"',
    'id="participationSessionInput"',
    'id="participationStudentInput"',
    'id="participationTypeSelect"',
    'id="participationPointsInput"',
    'id="participationNoteInput"',
    'id="participationEventRows"',
    "participation.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Participation markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/participation-api.js")) {
  const api = read("assets/course-materials/information-security/app/participation-api.js");
  const requiredApiMarkers = [
    "course-participation-events",
    "loadParticipationContext",
    "recordParticipationEvent",
    "Authorization",
    "list_participation_context",
    "record_participation_event"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Participation API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/participation.js")) {
  const script = read("assets/course-materials/information-security/app/participation.js");
  const requiredScriptMarkers = [
    "loadParticipationContext",
    "recordParticipationEvent",
    "participationSectionInput",
    "participationSessionInput",
    "participationStudentInput",
    "participationEventRows",
    "event_type",
    "points",
    "metadata"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Participation UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("participation.html")) {
    fail("Course App dashboard is missing Participation teacher link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("participationEventsFunction")) {
    fail("Platform config is missing participationEventsFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-participation-events]")) {
    fail("supabase/config.toml is missing course-participation-events.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Teachers can record low-stakes participation events")) {
    fail("Implementation status is missing participation-events completion note.");
  }
  if (!status.includes("node tools\\verify-auth-participation-events.js")) {
    fail("Implementation status is missing participation-events verifier command.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("npx supabase functions deploy course-participation-events")) {
    fail("Supabase README is missing course-participation-events deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-participation-events.js")) {
    fail("Supabase README is missing the participation-events verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated participation events verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated participation events verification passed.");
console.log(`- ${requiredFiles.length} participation event files checked`);
