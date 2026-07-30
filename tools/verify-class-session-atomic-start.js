const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const migrationName = "0020_class_session_content.sql";
const functionPath = path.join(
  root,
  "supabase",
  "functions",
  "course-session-management",
  "index.ts"
);
const failures = [];

function fail(message) {
  failures.push(message);
}

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const byVersion = new Map();
for (const name of migrationFiles) {
  const version = name.split("_", 1)[0];
  byVersion.set(version, [...(byVersion.get(version) || []), name]);
}
for (const [version, names] of byVersion) {
  if (names.length > 1) {
    fail(`Migration version ${version} is duplicated: ${names.join(", ")}`);
  }
}

const migrationPath = path.join(migrationsDir, migrationName);
if (!fs.existsSync(migrationPath)) {
  fail(`Missing migration: supabase/migrations/${migrationName}`);
} else {
  const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
  const requiredSql = [
    "create or replace function public.start_class_session_atomic",
    "for update",
    "update public.class_sessions",
    "previous_state not in ('planned', 'open', 'continued')",
    "insert into public.audit_log",
    "'session_state_changed'",
    "return started_session",
    "revoke all on function public.start_class_session_atomic",
    "grant execute on function public.start_class_session_atomic"
  ];
  for (const marker of requiredSql) {
    if (!sql.includes(marker)) fail(`Atomic-start migration missing: ${marker}`);
  }
  const auditInsertCount = (sql.match(/insert into public\.audit_log/g) || []).length;
  if (auditInsertCount !== 1) {
    fail(`Atomic-start migration must contain exactly one audit insert; found ${auditInsertCount}`);
  }
}

const source = fs.readFileSync(functionPath, "utf8");
const startBegin = source.indexOf("async function startSession(");
const startEnd = source.indexOf("\nasync function requireInstructor(", startBegin);
if (startBegin < 0 || startEnd < 0) {
  fail("Could not isolate startSession implementation.");
} else {
  const startSource = source.slice(startBegin, startEnd);
  const itemLookup = startSource.indexOf('.from("content_items")');
  const rpcCall = startSource.indexOf('.rpc("start_class_session_atomic"');
  if (rpcCall < 0) fail("startSession must call start_class_session_atomic.");
  if (itemLookup < 0) fail("startSession must load optional content metadata.");
  if (itemLookup >= 0 && rpcCall >= 0 && itemLookup > rpcCall) {
    fail("All fallible content lookups must happen before the atomic start RPC.");
  }
  if (rpcCall >= 0 && startSource.slice(0, rpcCall).includes("updated.")) {
    fail("Pre-RPC validation must read the original session, not the not-yet-returned updated row.");
  }
  if (/\.from\("class_sessions"\)[\s\S]*?\.update\(/.test(startSource)) {
    fail("startSession must not update class_sessions outside the atomic RPC.");
  }
  if (!/if \(startError\) throw startError;/.test(startSource)) {
    fail("startSession must surface an atomic RPC failure.");
  }
  for (const field of [
    "session_id: updated.id",
    "content_slug: associatedItem?.slug || null",
    "content_title: associatedItem?.title || null",
    "source_kind: associatedItem?.source_kind || null",
    "source_ref: associatedItem?.source_ref || null"
  ]) {
    if (!startSource.includes(field)) fail(`startSession response shape missing: ${field}`);
  }
}

if (failures.length) {
  console.error("Class-session atomic-start verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Class-session atomic-start verification passed.");
console.log(`- ${migrationFiles.length} unique migration versions checked`);
console.log("- atomic transition, audit, ordering, and response invariants checked");
