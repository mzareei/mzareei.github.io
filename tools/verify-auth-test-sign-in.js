const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/functions/course-test-signin/index.ts",
  "assets/course-materials/information-security/app/auth-api.js",
  "assets/course-materials/information-security/app/app.js",
  "assets/course-materials/information-security/app/index.html",
  "assets/course-materials/information-security/platform-config.js",
  "docs/course-platform/operations/test-sign-in.md",
  "tools/deploy-course-functions.ps1"
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

requireMarkers("supabase/functions/course-test-signin/index.ts", "test sign-in function", [
  "COURSE_TEST_SIGNIN_UNTIL",
  "blockedRoles",
  "platform_owner",
  "test_signin_issued",
  "generateLink",
  "course_memberships",
  "assertCourseEmailAllowed",
  "needs_external_access"
]);

requireMarkers("assets/course-materials/information-security/app/auth-api.js", "auth api", [
  "testSignIn",
  "course-test-signin"
]);

requireMarkers("assets/course-materials/information-security/app/app.js", "Course App sign-in", [
  "testSignInPanel",
  "testSignIn"
]);

requireMarkers("assets/course-materials/information-security/app/index.html", "sign-in markup", [
  "testSignInPanel",
  "testSignInBtn",
  "Testing mode"
]);

requireMarkers("docs/course-platform/operations/test-sign-in.md", "test sign-in guide", [
  "COURSE_TEST_SIGNIN_UNTIL",
  "Read this before enabling",
  "Disabling",
  "test_signin_issued"
]);

// The mode must be deployable and removable through the documented route.
requireMarkers("tools/deploy-course-functions.ps1", "deploy script", ["course-test-signin"]);

if (exists("supabase/course-platform-deployment-manifest.json")) {
  const manifest = JSON.parse(read("supabase/course-platform-deployment-manifest.json"));
  if (!(manifest.edge_functions || []).includes("course-test-signin")) {
    fail("Deployment manifest does not list course-test-signin.");
  }
}

// The banner must stay attached to the button: a bare shortcut with no warning is how a
// testing mode quietly becomes the login route.
if (exists("assets/course-materials/information-security/app/index.html")) {
  const markup = read("assets/course-materials/information-security/app/index.html");
  const panel = markup.match(/<div class="auth-test-signin"[\s\S]*?<\/div>/);
  if (!panel) {
    fail("The test sign-in button should live inside the .auth-test-signin panel.");
  } else if (!/verification is switched off|without proving/i.test(panel[0])) {
    fail("The test sign-in panel must explain that verification is disabled.");
  }
}

// Behaviour: the enable window is the rail that makes the mode lapse on its own, so
// exercise it directly rather than trusting the marker.
function loadWindowChecker(envValue, { envThrows = false } = {}) {
  const source = read("supabase/functions/course-test-signin/index.ts")
    .replace(/^import[\s\S]*?;$/gm, "")
    .replace(/^Deno\.serve\([\s\S]*?^\}\);$/gm, "")
    .replace(/:\s*ReturnType<typeof adminClient>/g, "")
    .replace(/:\s*unknown/g, "")
    .replace(/:\s*string/g, "");

  const context = vm.createContext({
    Deno: {
      env: {
        get: (key) => {
          if (envThrows) throw new Error("no env permission");
          return key === "COURSE_TEST_SIGNIN_UNTIL" ? envValue : "";
        }
      }
    },
    Date,
    Number,
    String,
    console
  });
  vm.runInContext(`${source}\n;globalThis.__window = testSignInWindow;`, context);
  return context.__window;
}

function behaviour(label, run) {
  try {
    run();
    console.log(`PASS ${label}`);
  } catch (error) {
    fail(`${label}: ${error.message}`);
    console.error(`FAIL ${label}`);
  }
}

if (exists("supabase/functions/course-test-signin/index.ts")) {
  behaviour("the mode is off when the secret is unset", () => {
    assert.strictEqual(loadWindowChecker("")().enabled, false);
    assert.strictEqual(loadWindowChecker("   ")().enabled, false);
  });

  behaviour("a past date leaves the mode off", () => {
    const result = loadWindowChecker("2020-01-01")();
    assert.strictEqual(result.enabled, false);
    assert.ok(/expired/i.test(result.reason), `unexpected reason: ${result.reason}`);
  });

  behaviour("a future date enables the mode", () => {
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    assert.strictEqual(loadWindowChecker(future)().enabled, true);
  });

  behaviour("a malformed date leaves the mode off", () => {
    assert.strictEqual(loadWindowChecker("someday")().enabled, false);
    assert.strictEqual(loadWindowChecker("2026-13-45")().enabled, false);
  });

  behaviour("an unreadable environment leaves the mode off", () => {
    assert.strictEqual(loadWindowChecker("2099-01-01", { envThrows: true })().enabled, false);
  });
}

if (failures.length) {
  console.error("Authenticated test sign-in verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated test sign-in verification passed.");
console.log(`- ${requiredFiles.length} test sign-in files checked`);
