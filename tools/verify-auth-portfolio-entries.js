const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/migrations/0007_portfolio_entries.sql",
  "supabase/functions/course-portfolio-entry/index.ts",
  "assets/course-materials/information-security/app/portfolio.html",
  "assets/course-materials/information-security/app/portfolio.js",
  "assets/course-materials/information-security/app/portfolio-api.js"
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

if (exists("supabase/migrations/0007_portfolio_entries.sql")) {
  const migration = read("supabase/migrations/0007_portfolio_entries.sql").toLowerCase();
  const requiredSchemaMarkers = [
    "create table if not exists public.portfolio_entries",
    "course_id text not null references public.courses(id)",
    "section_id uuid not null references public.course_sections(id)",
    "profile_id uuid not null references public.profiles(id)",
    "content_item_id uuid references public.content_items(id)",
    "gradebook_category_id uuid references public.gradebook_categories(id)",
    "entry_type text not null",
    "entry_json jsonb not null",
    "visibility text not null",
    "alter table public.portfolio_entries enable row level security;",
    "revoke all on public.portfolio_entries from anon, authenticated;"
  ];
  for (const marker of requiredSchemaMarkers) {
    if (!migration.includes(marker)) fail(`portfolio_entries migration missing: ${marker}`);
  }
}

if (exists("supabase/functions/course-portfolio-entry/index.ts")) {
  const fn = read("supabase/functions/course-portfolio-entry/index.ts");
  const requiredFunctionMarkers = [
    "Authorization",
    "auth.getUser",
    "profiles",
    "section_enrollments",
    "portfolio_entries",
    "gradebook_categories",
    "content_items",
    "submit_entry",
    "list_entries",
    "entry_json",
    "visibility",
    "status: 401",
    "status: 403"
  ];
  for (const marker of requiredFunctionMarkers) {
    if (!fn.includes(marker)) fail(`course-portfolio-entry missing: ${marker}`);
  }
  if (/question_options|answer_key|selected_option_id|is_correct/i.test(fn)) {
    fail("course-portfolio-entry must not expose quiz answer records.");
  }
}

if (exists("assets/course-materials/information-security/app/portfolio.html")) {
  const html = read("assets/course-materials/information-security/app/portfolio.html");
  const requiredMarkup = [
    'id="portfolioEntryRows"',
    'id="portfolioTitleInput"',
    'id="portfolioTypeSelect"',
    'id="portfolioCategorySelect"',
    'id="portfolioEvidenceInput"',
    'id="submitPortfolioEntryBtn"',
    'id="refreshPortfolioBtn"',
    "portfolio.js"
  ];
  for (const marker of requiredMarkup) {
    if (!html.includes(marker)) fail(`Authenticated portfolio markup missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/portfolio-api.js")) {
  const api = read("assets/course-materials/information-security/app/portfolio-api.js");
  const requiredApiMarkers = [
    "course-portfolio-entry",
    "loadPortfolioEntries",
    "submitPortfolioEntry",
    "action: \"list_entries\"",
    "action: \"submit_entry\"",
    "Authorization"
  ];
  for (const marker of requiredApiMarkers) {
    if (!api.includes(marker)) fail(`Authenticated portfolio API missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/portfolio.js")) {
  const script = read("assets/course-materials/information-security/app/portfolio.js");
  const requiredScriptMarkers = [
    "loadPortfolioEntries",
    "submitPortfolioEntry",
    "portfolioEntryRows",
    "portfolioCategorySelect",
    "entry_json",
    "gradebook_category_id"
  ];
  for (const marker of requiredScriptMarkers) {
    if (!script.includes(marker)) fail(`Authenticated portfolio UI missing: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/app.js")) {
  const app = read("assets/course-materials/information-security/app/app.js");
  if (!app.includes("portfolio.html")) {
    fail("Course App dashboard is missing authenticated portfolio link.");
  }
}

if (exists("assets/course-materials/information-security/app/progress.js")) {
  const progress = read("assets/course-materials/information-security/app/progress.js");
  if (!progress.includes("portfolio_entries")) {
    fail("Authenticated progress page is missing portfolio entry count.");
  }
}

if (exists("supabase/functions/course-student-progress/index.ts")) {
  const progressFn = read("supabase/functions/course-student-progress/index.ts");
  if (!progressFn.includes("portfolio_entries")) {
    fail("Student progress function is missing portfolio entry summary.");
  }
}

if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  if (!config.includes("portfolioEntryFunction")) {
    fail("Platform config is missing portfolioEntryFunction.");
  }
}

if (exists("supabase/config.toml")) {
  const config = read("supabase/config.toml");
  if (!config.includes("[functions.course-portfolio-entry]")) {
    fail("supabase/config.toml is missing course-portfolio-entry.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("0007_portfolio_entries.sql")) {
    fail("Supabase README is missing migration 0007.");
  }
  if (!readme.includes("npx supabase functions deploy course-portfolio-entry")) {
    fail("Supabase README is missing course-portfolio-entry deploy command.");
  }
  if (!readme.includes("node tools/verify-auth-portfolio-entries.js")) {
    fail("Supabase README is missing the authenticated portfolio verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated portfolio entries verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated portfolio entries verification passed.");
console.log(`- ${requiredFiles.length} portfolio files checked`);
