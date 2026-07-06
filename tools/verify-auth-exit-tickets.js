const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/implementation/phase-7d-authenticated-exit-tickets-plan.md",
  "supabase/migrations/0008_authenticated_exit_tickets.sql",
  "supabase/functions/course-exit-ticket/index.ts",
  "assets/course-materials/information-security/app/exit-ticket.html",
  "assets/course-materials/information-security/app/exit-ticket-api.js",
  "assets/course-materials/information-security/app/exit-ticket.js"
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

if (exists("docs/course-platform/implementation/phase-7d-authenticated-exit-tickets-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-7d-authenticated-exit-tickets-plan.md");
  const markers = [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Create authenticated exit_tickets table**",
    "[x] **Step 2: Add signed-in submit and list actions**",
    "[x] **Step 3: Include authenticated exit tickets in teacher insights**",
    "[x] **Step 1: Add student exit ticket page**",
    "[x] **Step 1: Run authenticated exit-ticket verifier**",
    "[x] **Step 2: Run all platform verifiers**"
  ];
  for (const marker of markers) {
    if (!plan.includes(marker)) fail(`Phase 7D plan missing: ${marker}`);
  }
}

if (exists("supabase/migrations/0008_authenticated_exit_tickets.sql")) {
  const migration = read("supabase/migrations/0008_authenticated_exit_tickets.sql").toLowerCase();
  const markers = [
    "create table if not exists public.exit_tickets",
    "course_id text not null references public.courses(id)",
    "section_id uuid not null references public.course_sections(id)",
    "class_session_id uuid references public.class_sessions(id)",
    "profile_id uuid not null references public.profiles(id)",
    "content_item_id uuid references public.content_items(id)",
    "confidence int not null check",
    "one_thing text not null check",
    "muddy_point text not null check",
    "next_action text not null",
    "alter table public.exit_tickets enable row level security",
    "revoke all on public.exit_tickets from anon, authenticated"
  ];
  for (const marker of markers) {
    if (!migration.includes(marker)) fail(`Exit-ticket migration missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-exit-ticket/index.ts")) {
  const fn = read("supabase/functions/course-exit-ticket/index.ts");
  const markers = [
    "Authorization",
    "auth.getUser",
    "profiles",
    "section_enrollments",
    "exit_tickets",
    "submit_ticket",
    "list_my_tickets",
    "class_sessions",
    "content_items",
    "confidence",
    "muddy_point",
    "status: 401",
    "status: 403"
  ];
  for (const marker of markers) {
    if (!fn.includes(marker)) fail(`course-exit-ticket missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-learning-insights/index.ts")) {
  const insights = read("supabase/functions/course-learning-insights/index.ts");
  const markers = [
    "exit_tickets",
    "course_exit_tickets",
    "loadAuthenticatedExitTickets",
    "loadLegacyExitTickets"
  ];
  for (const marker of markers) {
    if (!insights.includes(marker)) fail(`course-learning-insights missing authenticated exit-ticket marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/exit-ticket-api.js")) {
  const api = read("assets/course-materials/information-security/app/exit-ticket-api.js");
  const markers = [
    "course-exit-ticket",
    "action: \"list_my_tickets\"",
    "action: \"submit_ticket\"",
    "Authorization"
  ];
  for (const marker of markers) {
    if (!api.includes(marker)) fail(`Exit-ticket API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/exit-ticket.html")) {
  const html = read("assets/course-materials/information-security/app/exit-ticket.html");
  const markers = [
    'id="exitSectionSelect"',
    'id="exitSessionSelect"',
    'id="exitConfidenceInput"',
    'id="exitOneThingInput"',
    'id="exitMuddyPointInput"',
    'id="submitExitTicketBtn"',
    'id="exitTicketRows"',
    "exit-ticket.js"
  ];
  for (const marker of markers) {
    if (!html.includes(marker)) fail(`Exit-ticket page markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/exit-ticket.js")) {
  const script = read("assets/course-materials/information-security/app/exit-ticket.js");
  const markers = [
    "loadMyExitTickets",
    "submitExitTicket",
    "exitSectionSelect",
    "exitSessionSelect",
    "exitConfidenceInput",
    "exitMuddyPointInput"
  ];
  for (const marker of markers) {
    if (!script.includes(marker)) fail(`Exit-ticket script missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("exit-ticket.html")) {
    fail("Course App dashboard is missing authenticated exit-ticket link.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("exitTicketFunction")) {
    fail("platform-config.js is missing exitTicketFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-exit-ticket]")) {
    fail("supabase/config.toml is missing course-exit-ticket.");
  }
}

if (exists("supabase/tests/rls_auth_platform_checks.sql")) {
  const sql = read("supabase/tests/rls_auth_platform_checks.sql");
  if (!sql.includes("'exit_tickets'")) {
    fail("RLS platform checks are missing exit_tickets.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("0008_authenticated_exit_tickets.sql")) {
    fail("Supabase README is missing migration 0008.");
  }
  if (!readme.includes("npx supabase functions deploy course-exit-ticket")) {
    fail("Supabase README is missing course-exit-ticket deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-exit-tickets.js")) {
    fail("Supabase README is missing authenticated exit-ticket verifier command.");
  }
}

if (failures.length) {
  console.error("Authenticated exit-ticket verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated exit-ticket verification passed.");
console.log(`- ${requiredFiles.length} exit-ticket files checked`);
