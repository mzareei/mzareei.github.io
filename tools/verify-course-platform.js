const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const courseRoot = path.join(root, "assets", "course-materials", "information-security");
const quizApiPath = path.join(courseRoot, "week-01", "lecture", "quiz", "quiz-api.js");
const configPath = path.join(courseRoot, "week-01", "lecture", "quiz", "config.js");
const fullSeedPath = path.join(root, "supabase", "seed", "tc2007b_demo_question_bank.sql");
const supabaseRoot = path.join(root, "supabase");

const failures = [];

function fail(message) {
  failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walk(dir, predicate = () => true, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseObjectAfter(fileText, marker, endMarker) {
  const normalized = fileText.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(marker);
  const end = normalized.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not parse ${marker.trim()}`);
  }
  const objectSource = normalized.slice(start + marker.length, end).trim().replace(/;$/, "");
  return Function(`return (${objectSource});`)();
}

function parseAssignmentObject(fileText, marker) {
  const start = fileText.indexOf(marker);
  const end = fileText.indexOf("\n};", start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not parse ${marker.trim()}`);
  }
  const objectSource = `${fileText.slice(start + marker.length, end)}\n}`;
  return Function(`return (${objectSource});`)();
}

function verifyQuestionBanks() {
  const api = read(quizApiPath);
  const config = parseAssignmentObject(read(configPath), "window.QUIZ_CONFIG = ");
  const banks = parseObjectAfter(api, "const demoQuestionBanks = ", "\n\nexport function isConfigured");
  const lectureIds = Object.keys(config.lectures || {});
  const minimum = Number(config.defaultQuestionCount || 10);

  for (const lectureId of lectureIds) {
    const questions = banks[lectureId] || [];
    if (questions.length < minimum) {
      fail(`${lectureId} has ${questions.length} questions; expected at least ${minimum}.`);
    }
    const seenIds = new Set();
    questions.forEach((question, index) => {
      if (!question.id || seenIds.has(question.id)) {
        fail(`${lectureId} question ${index + 1} has a missing or duplicate id.`);
      }
      seenIds.add(question.id);
      if (!question.prompt || question.prompt.length < 8) {
        fail(`${lectureId} ${question.id || index + 1} has a weak prompt.`);
      }
      if (!Array.isArray(question.options) || question.options.length < 2) {
        fail(`${lectureId} ${question.id || index + 1} needs at least two options.`);
      }
      if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
        fail(`${lectureId} ${question.id || index + 1} has an invalid answer index.`);
      }
      const optionSet = new Set(question.options || []);
      if (optionSet.size !== (question.options || []).length) {
        fail(`${lectureId} ${question.id || index + 1} has duplicate answer options.`);
      }
    });
  }

  for (const lectureId of Object.keys(banks)) {
    if (!lectureIds.includes(lectureId)) {
      fail(`${lectureId} has a question bank but is missing from config.js.`);
    }
  }

  const totalQuestions = Object.values(banks).reduce((sum, questions) => sum + questions.length, 0);
  const fullSeed = fs.existsSync(fullSeedPath) ? read(fullSeedPath) : "";
  for (const lectureId of lectureIds) {
    if (!fullSeed.includes(`'${lectureId}'`)) {
      fail(`Full Supabase seed is missing ${lectureId}.`);
    }
  }
  const seedQuestionCount = (fullSeed.match(/insert into public\.quiz_questions/g) || []).length;
  if (seedQuestionCount !== totalQuestions) {
    fail(`Full Supabase seed has ${seedQuestionCount} question inserts; expected ${totalQuestions}.`);
  }

  return { lectures: lectureIds.length, questions: totalQuestions };
}

function verifyJavaScriptSyntax() {
  const jsFiles = walk(courseRoot, (filePath) => filePath.endsWith(".js"));
  for (const filePath of jsFiles) {
    try {
      execFileSync(process.execPath, ["--check", filePath], { stdio: "pipe" });
    } catch (error) {
      fail(`JavaScript syntax check failed: ${path.relative(root, filePath)}\n${error.stderr || error.message}`);
    }
  }
  return jsFiles.length;
}

function verifyLocalLinks() {
  const htmlFiles = walk(courseRoot, (filePath) => filePath.endsWith(".html"));
  const attrPattern = /[\s<](?:href|src)=["']([^"']+)["']/g;
  for (const filePath of htmlFiles) {
    const html = read(filePath);
    for (const match of html.matchAll(attrPattern)) {
      const target = match[1].trim();
      if (
        !target ||
        target.startsWith("#") ||
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("mailto:") ||
        target.startsWith("data:") ||
        target.startsWith("/") ||
        target.includes("{{")
      ) {
        continue;
      }
      const cleanTarget = target.split("#")[0].split("?")[0];
      if (!cleanTarget) continue;
      const resolved = path.resolve(path.dirname(filePath), cleanTarget);
      const candidates = [
        resolved,
        path.join(resolved, "index.html")
      ];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        fail(`Broken local link in ${path.relative(root, filePath)} -> ${target}`);
      }
    }
  }
  return htmlFiles.length;
}

function verifyPublicSecretSafety() {
  const publicFiles = walk(courseRoot, (filePath) => /\.(html|js|css|md|json)$/i.test(filePath));
  const serviceRolePattern = /SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/i;
  for (const filePath of publicFiles) {
    if (serviceRolePattern.test(read(filePath))) {
      fail(`Possible server secret reference in public file: ${path.relative(root, filePath)}`);
    }
  }
  return publicFiles.length;
}

function verifySupabaseFunctions() {
  const functionsDir = path.join(supabaseRoot, "functions");
  const config = read(path.join(supabaseRoot, "config.toml"));
  const readme = read(path.join(supabaseRoot, "README.md"));
  const functionNames = fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  functionNames.forEach((name) => {
    const indexPath = path.join(functionsDir, name, "index.ts");
    if (!fs.existsSync(indexPath)) {
      fail(`Supabase function ${name} is missing index.ts.`);
    }
    if (!config.includes(`[functions.${name}]`)) {
      fail(`Supabase function ${name} is missing from supabase/config.toml.`);
    }
    if (!readme.includes(`functions deploy ${name}`)) {
      fail(`Supabase function ${name} is missing from supabase/README.md deploy commands.`);
    }
  });

  const configured = Array.from(config.matchAll(/\[functions\.([^\]]+)\]/g)).map((match) => match[1]);
  configured.forEach((name) => {
    if (!functionNames.includes(name)) {
      fail(`supabase/config.toml references missing function ${name}.`);
    }
  });

  return functionNames.length;
}

const bankStats = verifyQuestionBanks();
const syntaxCount = verifyJavaScriptSyntax();
const htmlCount = verifyLocalLinks();
const publicCount = verifyPublicSecretSafety();
const functionCount = verifySupabaseFunctions();

if (failures.length) {
  console.error("Course platform verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Course platform verification passed.");
console.log(`- ${bankStats.lectures} lecture banks, ${bankStats.questions} questions`);
console.log(`- ${syntaxCount} JavaScript files checked`);
console.log(`- ${htmlCount} HTML files checked for local links`);
console.log(`- ${publicCount} public files scanned for server-secret references`);
console.log(`- ${functionCount} Supabase functions checked`);
