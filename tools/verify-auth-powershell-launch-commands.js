const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "docs/course-platform/operations/supabase-powershell-command-sheet.md",
  "docs/course-platform/implementation/phase-8f-powershell-launch-commands-plan.md",
  "supabase/course-platform-deployment-manifest.json",
  "docs/course-platform/operations/supabase-launch-checklist.md",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
];

const requiredSections = [
  "PowerShell Command Sheet",
  "Run From Repository Root",
  "Local Repository Verification",
  "Link Supabase Project",
  "Set Function Secrets",
  "Deploy Edge Functions",
  "Run SQL In Supabase",
  "Browser Configuration",
  "Live Evidence Packet",
  "Do Not Paste Service-Role Keys",
  "npx supabase link --project-ref <your-project-ref>",
  "npx supabase secrets set QUIZ_TEACHER_PIN",
  "COURSE_MAINTENANCE_SECRET",
  "docs/course-platform/operations/live-supabase-evidence-packet.md",
  "supabase/tests/rls_auth_platform_checks.sql",
  "node tools\\verify-auth-live-evidence-packet.js"
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

function requireMarkers(source, markers, label) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} missing: ${marker}`);
  }
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

let manifest = null;
if (exists("supabase/course-platform-deployment-manifest.json")) {
  try {
    manifest = JSON.parse(read("supabase/course-platform-deployment-manifest.json"));
  } catch (error) {
    fail(`Deployment manifest is not valid JSON: ${error.message}`);
  }
}

if (exists("docs/course-platform/operations/supabase-powershell-command-sheet.md")) {
  const sheet = read("docs/course-platform/operations/supabase-powershell-command-sheet.md");
  requireMarkers(sheet, requiredSections, "PowerShell command sheet");

  if (manifest) {
    for (const functionName of manifest.edge_functions || []) {
      if (!sheet.includes(`npx supabase functions deploy ${functionName}`)) {
        fail(`PowerShell command sheet missing deploy command for: ${functionName}`);
      }
    }

    for (const migration of manifest.migrations || []) {
      if (!sheet.includes(migration)) {
        fail(`PowerShell command sheet missing migration reference: ${migration}`);
      }
    }

    for (const seed of manifest.seeds || []) {
      if (!sheet.includes(seed)) {
        fail(`PowerShell command sheet missing seed reference: ${seed}`);
      }
    }
  }
}

if (exists("docs/course-platform/implementation/phase-8f-powershell-launch-commands-plan.md")) {
  const plan = read("docs/course-platform/implementation/phase-8f-powershell-launch-commands-plan.md");
  requireMarkers(plan, [
    "[x] **Step 1: Confirm RED**",
    "[x] **Step 1: Add PowerShell launch command sheet**",
    "[x] **Step 2: Link command sheet from launch docs**",
    "[x] **Step 1: Run command-sheet verifier**",
    "[x] **Step 2: Run full platform verifier suite**"
  ], "Phase 8F plan");
}

if (exists("docs/course-platform/operations/supabase-launch-checklist.md")) {
  const checklist = read("docs/course-platform/operations/supabase-launch-checklist.md");
  requireMarkers(checklist, [
    "docs/course-platform/operations/supabase-powershell-command-sheet.md",
    "PowerShell command sheet"
  ], "Launch checklist");
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  requireMarkers(status, [
    "PowerShell launch command sheet lists local checks, Supabase linking, secrets, function deploys, SQL steps, and evidence recording",
    "node tools\\verify-auth-powershell-launch-commands.js"
  ], "Implementation status");
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  requireMarkers(readme, [
    "docs/course-platform/operations/supabase-powershell-command-sheet.md",
    "node tools/verify-auth-powershell-launch-commands.js"
  ], "Supabase README");
}

if (failures.length) {
  console.error("Authenticated PowerShell launch command verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated PowerShell launch command verification passed.");
console.log(`- ${(manifest?.edge_functions || []).length} deploy commands checked`);
