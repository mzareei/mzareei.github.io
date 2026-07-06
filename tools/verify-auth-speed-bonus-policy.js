const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-activity-attempt/index.ts",
  "assets/course-materials/information-security/app/activity-player.js",
  "assets/course-materials/information-security/app/gradebook.js",
  "docs/course-platform/implementation/current-implementation-status.md",
  "supabase/README.md"
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

if (exists("supabase/functions/course-activity-attempt/index.ts")) {
  const fn = read("supabase/functions/course-activity-attempt/index.ts");
  const requiredMarkers = [
    "calculateSpeedBonus",
    "calculateFinalScore",
    "maxSpeedBonusPercent",
    "time_limit_seconds",
    "speed_bonus: speedBonus",
    "score_final: finalScore",
    "speed_bonus: graded.speed_bonus",
    "score_final: graded.score_final"
  ];
  for (const marker of requiredMarkers) {
    if (!fn.includes(marker)) fail(`course-activity-attempt missing speed policy marker: ${marker}`);
  }

  if (!/Math\.min\(100,\s*round1\(scorePercent \+ speedBonus\)\)/.test(fn)) {
    fail("Final score must be capped at 100 after the speed bonus.");
  }

  if (/speed_bonus:\s*0/.test(fn)) {
    fail("course-activity-attempt still hard-codes speed_bonus to 0.");
  }
}

if (exists("assets/course-materials/information-security/app/activity-player.js")) {
  const player = read("assets/course-materials/information-security/app/activity-player.js");
  const requiredPlayerMarkers = [
    "score.speed_bonus",
    "score.final",
    "Speed bonus"
  ];
  for (const marker of requiredPlayerMarkers) {
    if (!player.includes(marker)) fail(`Activity player missing speed-score marker: ${marker}`);
  }
}

if (exists("assets/course-materials/information-security/app/gradebook.js")) {
  const gradebook = read("assets/course-materials/information-security/app/gradebook.js");
  if (!gradebook.includes("Final score includes any small speed bonus")) {
    fail("Gradebook UI should clarify that final score may include the small speed bonus.");
  }
}

if (exists("docs/course-platform/implementation/current-implementation-status.md")) {
  const status = read("docs/course-platform/implementation/current-implementation-status.md");
  if (!status.includes("Small capped speed bonuses")) {
    fail("Implementation status is missing the speed bonus policy note.");
  }
}

if (exists("supabase/README.md")) {
  const readme = read("supabase/README.md");
  if (!readme.includes("node tools/verify-auth-speed-bonus-policy.js")) {
    fail("Supabase README is missing the speed bonus verifier.");
  }
}

if (failures.length) {
  console.error("Authenticated speed bonus policy verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated speed bonus policy verification passed.");
console.log("- Capped speed bonus feeds final scores without replacing correctness.");
