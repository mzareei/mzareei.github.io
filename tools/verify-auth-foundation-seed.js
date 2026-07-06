const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const seedPath = path.join(root, "supabase", "seed", "tc2007b_auth_foundation_demo.sql");
const readmePath = path.join(root, "supabase", "README.md");
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(seedPath)) {
  fail("Missing seed: supabase/seed/tc2007b_auth_foundation_demo.sql");
} else {
  const seed = fs.readFileSync(seedPath, "utf8").replace(/\r\n/g, "\n");
  const requiredSnippets = [
    "insert into public.courses",
    "insert into public.course_sections",
    "insert into public.content_items",
    "insert into public.content_releases",
    "'tc2007b'",
    "'A'",
    "'B'",
    "'released'",
    "'draft'",
    "'scheduled'",
    "week-01/lecture",
    "week-01/mission-01",
    "review-coach",
    "teacher"
  ];

  for (const snippet of requiredSnippets) {
    if (!seed.includes(snippet)) fail(`Seed is missing: ${snippet}`);
  }

  if (/institutional_email|student_identifier|auth_user_id/i.test(seed)) {
    fail("Foundation seed must not create real student/profile identity rows.");
  }
}

if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, "utf8");
  if (!readme.includes("tc2007b_auth_foundation_demo.sql")) {
    fail("Supabase README is missing the authenticated foundation seed.");
  }
}

if (failures.length) {
  console.error("Authenticated foundation seed verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated foundation seed verification passed.");
