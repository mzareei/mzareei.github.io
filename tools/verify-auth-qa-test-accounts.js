const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "supabase/migrations/0011_external_access_grants.sql",
  "supabase/functions/_shared/identity.ts",
  "supabase/functions/course-roster-management/index.ts",
  "assets/course-materials/information-security/app/auth-api.js",
  "assets/course-materials/information-security/app/app.js",
  "assets/course-materials/information-security/app/roster-api.js",
  "assets/course-materials/information-security/app/roster.js",
  "assets/course-materials/information-security/app/roster.html",
  "assets/course-materials/information-security/platform-config.js",
  "docs/course-platform/operations/qa-test-accounts.md"
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
  "COURSE_TEST_EMAILS",
  "testAccessEmails",
  "isTestAccessEmail",
  "defaultAllowedInstitutionalDomains",
  "Institutional email domain is not approved"
]);

requireMarkers("supabase/migrations/0011_external_access_grants.sql", "external access migration", [
  "create table if not exists public.external_access_grants",
  "unique (course_id, email)",
  "enable row level security",
  "revoke all on public.external_access_grants from anon, authenticated"
]);

requireMarkers("supabase/functions/_shared/identity.ts", "DB-backed guard", [
  "assertCourseEmailAllowed",
  "hasExternalAccessGrant",
  "external_access_grants"
]);

requireMarkers("supabase/functions/course-roster-management/index.ts", "roster management", [
  "../_shared/identity.ts",
  "isTestAccessEmail",
  "add_person",
  "grant_external_access",
  "revoke_external_access",
  "list_external_access",
  "external_access_granted",
  "external_access_revoked",
  "loadGrantedEmails"
]);

requireMarkers("assets/course-materials/information-security/app/roster-api.js", "roster api", [
  "addPerson",
  "grantExternalAccess",
  "revokeExternalAccess",
  "listExternalAccess"
]);

requireMarkers("assets/course-materials/information-security/app/roster.js", "roster panel", [
  "addSinglePerson",
  "updateExternalReasonVisibility",
  "renderExternalAccess",
  "revokeGrant",
  "loadSectionOptions"
]);

requireMarkers("assets/course-materials/information-security/app/roster.html", "roster panel markup", [
  "personEmailInput",
  "personNameInput",
  "personSectionSelect",
  "personRoleSelect",
  "personExternalReasonInput",
  "addPersonBtn",
  "externalAccessRows"
]);

// Every trusted function must go through the DB-backed guard, or a granted address would
// reach sign-in but fail everywhere else.
const guardedFunctions = [
  "supabase/functions/course-auth-context/index.ts",
  "supabase/functions/course-content-access/index.ts",
  "supabase/functions/course-activity-attempt/index.ts",
  "supabase/functions/course-exit-ticket/index.ts",
  "supabase/functions/course-portfolio-entry/index.ts",
  "supabase/functions/course-student-progress/index.ts",
  "supabase/functions/course-identity-confirmation/index.ts"
];

for (const file of guardedFunctions) {
  requireMarkers(file, file, ["assertCourseEmailAllowed"]);
  if (exists(file) && read(file).includes("assertInstitutionalEmailAllowed(")) {
    fail(`${file} still calls the domain-only guard; use assertCourseEmailAllowed so access grants apply.`);
  }
}

requireMarkers("assets/course-materials/information-security/app/auth-api.js", "auth api", [
  "testAccessEmails",
  "isTestAccessEmail",
  "rememberTestAccessEmail",
  "forgetTestAccessEmails",
  "captureTestAccessFromUrl",
  "test-access"
]);

requireMarkers("assets/course-materials/information-security/app/app.js", "Course App sign-in", [
  "captureTestAccessFromUrl",
  "isTestAccessEmail",
  "isAllowedInstitutionalEmail",
  "allowedInstitutionalDomains"
]);

requireMarkers("assets/course-materials/information-security/platform-config.js", "platform config", [
  "allowedTestEmails",
  "testAccessStorageKey"
]);

requireMarkers("docs/course-platform/operations/qa-test-accounts.md", "QA test account guide", [
  "COURSE_TEST_EMAILS",
  "supabase secrets set",
  "?test-access=",
  "tc2007b.test-access-emails",
  "Adding someone from the panel",
  "external access grant",
  "Removing access"
]);

// The published config and the deployed functions must not carry a real test address:
// platform-config.js is served publicly and this repository is public.
if (exists("assets/course-materials/information-security/platform-config.js")) {
  const config = read("assets/course-materials/information-security/platform-config.js");
  const declaration = config.match(/allowedTestEmails\s*:\s*\[([^\]]*)\]/);
  if (!declaration) {
    fail("platform-config.js should declare allowedTestEmails as an inline array.");
  } else if (declaration[1].trim().length) {
    fail("platform-config.js allowedTestEmails must stay empty; configure test addresses per device and in the COURSE_TEST_EMAILS secret.");
  }
}

const publicSources = [
  "assets/course-materials/information-security/platform-config.js",
  "assets/course-materials/information-security/app/auth-api.js",
  "assets/course-materials/information-security/app/app.js",
  "supabase/functions/_shared/identity.ts",
  "supabase/functions/course-roster-management/index.ts"
];

const personalMailboxDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me"];
const addressPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

for (const file of publicSources) {
  if (!exists(file)) continue;
  const matches = read(file).match(addressPattern) || [];
  for (const address of matches) {
    const domain = address.split("@")[1].toLowerCase().replace(/[.,;)"']+$/, "");
    if (personalMailboxDomains.includes(domain)) {
      fail(`${file} contains a personal mailbox address (${address}); test addresses belong in the COURSE_TEST_EMAILS secret.`);
    }
  }
}

// Behaviour checks: load the browser helpers under a fake window so the per-device
// allowlist is exercised, not just grepped for.
function loadAuthHelpers({ search = "", stored = null, config = {} } = {}) {
  const source = read("assets/course-materials/information-security/app/auth-api.js")
    .replace(/^export\s+/gm, "");

  const storage = new Map();
  if (stored !== null) storage.set(config.testAccessStorageKey || "tc2007b.test-access-emails", stored);

  const replaced = [];
  const fakeWindow = {
    TC2007B_PLATFORM_CONFIG: { courseId: "tc2007b", allowedInstitutionalDomains: ["tec.mx"], ...config },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    location: { search, pathname: "/app/", hash: "" },
    history: { replaceState: (_state, _title, url) => replaced.push(url) }
  };

  const context = vm.createContext({ window: fakeWindow, URLSearchParams, JSON, console });
  vm.runInContext(
    `${source}\n;globalThis.__helpers = { testAccessEmails, isTestAccessEmail, rememberTestAccessEmail, forgetTestAccessEmails, captureTestAccessFromUrl };`,
    context
  );
  return { helpers: context.__helpers, storage, replaced, config: fakeWindow.TC2007B_PLATFORM_CONFIG };
}

// Arrays returned from the vm realm are not reference-equal to host arrays.
function list(values) {
  return Array.from(values || []);
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

if (exists("assets/course-materials/information-security/app/auth-api.js")) {
  behaviour("an unregistered address is not treated as a test account", () => {
    const { helpers } = loadAuthHelpers();
    assert.deepStrictEqual(list(helpers.testAccessEmails()), []);
    assert.strictEqual(helpers.isTestAccessEmail("someone@gmail.com"), false);
    assert.strictEqual(helpers.isTestAccessEmail(""), false);
  });

  behaviour("?test-access enrols the device, prefills nothing else, and clears the parameter", () => {
    const { helpers, storage, replaced } = loadAuthHelpers({ search: "?test-access=QA.Tester%40example.com&keep=1" });
    assert.strictEqual(helpers.captureTestAccessFromUrl(), "qa.tester@example.com");
    assert.strictEqual(helpers.isTestAccessEmail("qa.tester@example.com"), true);
    assert.strictEqual(helpers.isTestAccessEmail("other@example.com"), false);
    assert.deepStrictEqual(list(JSON.parse(storage.get("tc2007b.test-access-emails"))), ["qa.tester@example.com"]);
    assert.strictEqual(replaced.length, 1);
    assert.ok(!replaced[0].includes("test-access"), "test-access should be stripped from the URL");
    assert.ok(replaced[0].includes("keep=1"), "unrelated query parameters should survive");
  });

  behaviour("a malformed or absent test-access parameter enrols nothing", () => {
    const { helpers: none } = loadAuthHelpers({ search: "?other=1" });
    assert.strictEqual(none.captureTestAccessFromUrl(), "");
    assert.deepStrictEqual(list(none.testAccessEmails()), []);

    const { helpers: malformed, storage } = loadAuthHelpers({ search: "?test-access=not-an-email" });
    assert.strictEqual(malformed.captureTestAccessFromUrl(), "");
    assert.strictEqual(storage.has("tc2007b.test-access-emails"), false);
  });

  behaviour("corrupt or hostile stored values degrade to an empty allowlist", () => {
    const { helpers: broken } = loadAuthHelpers({ stored: "{not json" });
    assert.deepStrictEqual(list(broken.testAccessEmails()), []);

    const { helpers: wrongShape } = loadAuthHelpers({ stored: JSON.stringify({ email: "x@example.com" }) });
    assert.deepStrictEqual(list(wrongShape.testAccessEmails()), []);

    const { helpers: mixed } = loadAuthHelpers({ stored: JSON.stringify(["nope", "", null, "ok@example.com", "ok@example.com"]) });
    assert.deepStrictEqual(list(mixed.testAccessEmails()), ["ok@example.com"]);
  });

  behaviour("clearing device storage revokes the local unlock", () => {
    const { helpers } = loadAuthHelpers({ stored: JSON.stringify(["qa.tester@example.com"]) });
    assert.strictEqual(helpers.isTestAccessEmail("qa.tester@example.com"), true);
    helpers.forgetTestAccessEmails();
    assert.deepStrictEqual(list(helpers.testAccessEmails()), []);
  });

  behaviour("a custom storage key from platform-config is honoured", () => {
    const { helpers, storage } = loadAuthHelpers({
      search: "?test-access=qa@example.com",
      config: { testAccessStorageKey: "custom.test-emails" }
    });
    helpers.captureTestAccessFromUrl();
    assert.ok(storage.has("custom.test-emails"), "the configured storage key should be used");
    assert.ok(!storage.has("tc2007b.test-access-emails"), "the default key should be left untouched");
  });
}

// Server guard: strip the TypeScript annotations and exercise the real control flow
// against a fake Deno env and a fake grants table.
function loadServerGuard({ testEmails = "", grants = [], envThrows = false } = {}) {
  const source = read("supabase/functions/_shared/identity.ts")
    .replace(/^export\s+/gm, "")
    .replace(/:\s*\{\s*from:\s*\(table:\s*string\)\s*=>\s*any\s*\}/g, "")
    .replace(/:\s*Record<string,\s*unknown>/g, "")
    .replace(/:\s*unknown/g, "")
    .replace(/:\s*string\[\]/g, "");

  const queried = [];
  const db = {
    from(table) {
      const filters = {};
      const builder = {
        select: () => builder,
        eq: (column, value) => {
          filters[column] = value;
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => {
          queried.push({ table, filters });
          if (table !== "external_access_grants") return { data: null, error: null };
          const hit = grants.find((grant) => grant.email === filters.email && grant.status === filters.status);
          return { data: hit ? { id: "grant-id" } : null, error: null };
        }
      };
      return builder;
    }
  };

  const context = vm.createContext({
    Deno: {
      env: {
        get: (key) => {
          if (envThrows) throw new Error("no env permission");
          return key === "COURSE_TEST_EMAILS" ? testEmails : "";
        }
      }
    },
    console
  });
  vm.runInContext(
    `${source}\n;globalThis.__guard = { assertInstitutionalEmailAllowed, assertCourseEmailAllowed, hasExternalAccessGrant, testAccessEmails };`,
    context
  );
  return { guard: context.__guard, db, queried };
}

async function rejects(promise, label) {
  try {
    await promise;
    throw new Error(`${label} should have been rejected`);
  } catch (error) {
    if (String(error.message).includes("should have been rejected")) throw error;
    return error;
  }
}

async function asyncBehaviour(label, run) {
  try {
    await run();
    console.log(`PASS ${label}`);
  } catch (error) {
    fail(`${label}: ${error.message}`);
    console.error(`FAIL ${label}`);
  }
}

async function runServerGuardChecks() {
  if (!exists("supabase/functions/_shared/identity.ts")) return;

  await asyncBehaviour("institutional addresses pass without touching the grants table", async () => {
    const { guard, db, queried } = loadServerGuard();
    assert.strictEqual(await guard.assertCourseEmailAllowed(db, "Someone@TEC.MX"), "someone@tec.mx");
    assert.strictEqual(queried.length, 0, "no grant lookup should be needed for an institutional address");
  });

  await asyncBehaviour("an unlisted outside address is rejected", async () => {
    const { guard, db } = loadServerGuard();
    const error = await rejects(guard.assertCourseEmailAllowed(db, "stranger@gmail.com"), "an unlisted address");
    assert.ok(error.message.includes("not approved"), `unexpected message: ${error.message}`);
  });

  await asyncBehaviour("an active grant admits an outside address", async () => {
    const { guard, db } = loadServerGuard({ grants: [{ email: "guest@example.com", status: "active" }] });
    assert.strictEqual(await guard.assertCourseEmailAllowed(db, "Guest@Example.com"), "guest@example.com");
  });

  await asyncBehaviour("a revoked grant no longer admits the address", async () => {
    const { guard, db } = loadServerGuard({ grants: [{ email: "guest@example.com", status: "revoked" }] });
    await rejects(guard.assertCourseEmailAllowed(db, "guest@example.com"), "a revoked grant");
  });

  await asyncBehaviour("COURSE_TEST_EMAILS still admits an address with no grant", async () => {
    const { guard, db } = loadServerGuard({ testEmails: "qa@example.com" });
    assert.strictEqual(await guard.assertCourseEmailAllowed(db, "qa@example.com"), "qa@example.com");
  });

  await asyncBehaviour("the guard fails closed when the environment is unreadable", async () => {
    const { guard, db } = loadServerGuard({ envThrows: true });
    await rejects(guard.assertCourseEmailAllowed(db, "qa@example.com"), "an unreadable environment");
    assert.strictEqual(await guard.assertCourseEmailAllowed(db, "someone@tec.mx"), "someone@tec.mx");
  });

  await asyncBehaviour("a blank address is never admitted", async () => {
    const { guard, db } = loadServerGuard({ grants: [{ email: "", status: "active" }] });
    await rejects(guard.assertCourseEmailAllowed(db, ""), "a blank address");
    assert.strictEqual(await guard.hasExternalAccessGrant(db, ""), false);
  });
}

runServerGuardChecks()
  .catch((error) => fail(`Server guard checks could not run: ${error.message}`))
  .then(finish);

function finish() {
if (failures.length) {
  console.error("Authenticated QA test account verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Authenticated QA test account verification passed.");
console.log(`- ${requiredFiles.length} QA test account files checked`);
console.log(`- ${publicSources.length} public sources scanned for committed test addresses`);
}
