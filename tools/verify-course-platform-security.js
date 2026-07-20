const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const quizApiPath = path.join(root, "assets", "course-materials", "information-security", "week-01", "lecture", "quiz", "quiz-api.js");
const removedSeedPath = path.join(root, "supabase", "seed", "tc2007b_demo_question_bank.sql");
const api = fs.readFileSync(quizApiPath, "utf8");
const declarationStart = api.indexOf("const demoQuestionBanks = ");
const declarationEnd = api.indexOf("\n\nexport function isConfigured", declarationStart);
const declaration = api.slice(declarationStart, declarationEnd);
const objectSource = declaration
  .slice("const demoQuestionBanks = ".length)
  .trim()
  .replace(/;[\s\S]*$/, "");

assert.deepStrictEqual(Function(`return (${objectSource});`)(), {});
assert.doesNotMatch(declaration, /(?:^|[,{]\s*)["']?(?:answer|correct_answer)["']?\s*:/mi);
assert.ok(!fs.existsSync(removedSeedPath), "The removed answer-bearing seed must not return to the repository.");

const result = spawnSync(process.execPath, ["tools/verify-course-platform.js"], {
  cwd: root,
  encoding: "utf8"
});

assert.strictEqual(
  result.status,
  0,
  `Expected the course-platform verifier to accept the intentionally empty public quiz bank.\n${result.stderr || result.stdout}`
);

assert.match(result.stdout, /Course platform verification passed\./);

console.log("Course-platform security verifier passed.");
