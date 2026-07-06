const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/_shared/identity.ts",
  "supabase/functions/course-auth-context/index.ts",
  "supabase/functions/course-content-access/index.ts",
  "supabase/functions/course-activity-attempt/index.ts",
  "supabase/functions/course-exit-ticket/index.ts",
  "supabase/functions/course-portfolio-entry/index.ts",
  "supabase/functions/course-student-progress/index.ts",
  "assets/course-materials/information-security/app/app.js",
  "supabase/README.md",
  "docs/course-platform/implementation/current-implementation-status.md"
];

const guardedFunctions = [
  "supabase/functions/course-auth-context/index.ts",
  "supabase/functions/course-content-access/index.ts",
  "supabase/functions/course-activity-attempt/index.ts",
  "supabase/functions/course-exit-ticket/index.ts",
  "supabase/functions/course-portfolio-entry/index.ts",
  "supabase/functions/course-student-progress/index.ts"
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

function requireMarkers(relativePath, label, markers) {
  if (!exists(relativePath)) return;
  const source = read(relativePath);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} missing: ${marker}`);
  }
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing file: ${file}`);
}

requireMarkers("supabase/functions/_shared/identity.ts", "shared identity guard", [
  "defaultAllowedInstitutionalDomains",
  "assertInstitutionalEmailAllowed",
  "assertProfileMatchesAuthEmail",
  "Institutional email domain is not approved"
]);

for (const file of guardedFunctions) {
  requireMarkers(file, file, [
    "../_shared/identity.ts",
    "assertInstitutionalEmailAllowed",
    "assertProfileMatchesAuthEmail"
  ]);
}

requireMarkers("assets/course-materials/information-security/app/app.js", "Course App sign-in", [
  "isAllowedInstitutionalEmail",
  "allowedInstitutionalDomains",
  "Use your approved institutional email"
]);

requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-institutional-email-guard.js",
  "trusted functions reject unapproved institutional email domains"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["Trusted functions reject unapproved institutional email domains"]
);

if (failures.length) {
  console.error("Authenticated institutional email guard verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated institutional email guard verification passed.");
console.log(`- ${requiredFiles.length} institutional-email guard files checked`);
