// Every table in the public schema must be locked at birth.
//
// The platform runs a zero-policy stance: no table has a single RLS policy,
// because nothing in the browser talks to a table directly. Every read and
// write goes through an edge function holding the service-role key, which
// bypasses RLS entirely. That makes the correct posture for every table the
// same two statements, always paired:
//
//   alter table public.X enable row level security;
//   revoke all on public.X from anon, authenticated;
//
// RLS is what actually denies the rows. The revoke is what makes PostgREST
// refuse outright instead of answering 200 with an empty array, and — more
// importantly — it means a future permissive policy cannot open real data on
// its own, because the grant underneath it is already gone.
//
// This check exists because both halves have been missed in production.
// 0032 created content_shares and content_versions with neither statement,
// and Supabase's advisor mailed a critical rls_disabled_in_public alert:
// the anon key ships in a public Jekyll site, so anyone with the project URL
// could read, forge, or delete every share grant and every version row.
// 0019 got RLS right on content_uploads and generation_jobs but omitted the
// revoke, which the advisor does not flag at all. 0045 and 0046 closed both.
//
// A missing lock is invisible until someone external finds it, so it is
// checked here rather than left to the next advisor email.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");

const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

assert.ok(files.length > 0, "no migrations found — check the path");

// Read the migration set as one ledger. A table may be created in one file and
// locked in a later one; what matters is that the pair exists somewhere by the
// end, not that it lands in any particular migration.
const ledger = files
  .map((name) => fs.readFileSync(path.join(migrationsDir, name), "utf8"))
  .join("\n");

const created = new Set();
const createRe =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi;
let match;
while ((match = createRe.exec(ledger))) created.add(match[1]);

// A table dropped later in the ledger no longer needs a lock.
const dropped = new Set();
const dropRe =
  /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi;
while ((match = dropRe.exec(ledger))) dropped.add(match[1]);

const live = [...created].filter((table) => !dropped.has(table)).sort();
assert.ok(live.length > 0, "no live tables found — the parse is probably wrong");

const missingRls = [];
const missingRevoke = [];

for (const table of live) {
  const rls = new RegExp(
    `alter\\s+table\\s+(?:only\\s+)?(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
    "i"
  );
  if (!rls.test(ledger)) missingRls.push(table);

  // anon and authenticated may be revoked in either order, and either on its
  // own line or together in one statement.
  const revoke = new RegExp(
    `revoke\\s+all\\s+on\\s+(?:table\\s+)?(?:public\\.)?${table}\\s+from\\s+[^;]*\\banon\\b`,
    "i"
  );
  const revokeAuthenticated = new RegExp(
    `revoke\\s+all\\s+on\\s+(?:table\\s+)?(?:public\\.)?${table}\\s+from\\s+[^;]*\\bauthenticated\\b`,
    "i"
  );
  if (!revoke.test(ledger) || !revokeAuthenticated.test(ledger)) {
    missingRevoke.push(table);
  }
}

assert.deepEqual(
  missingRls,
  [],
  `these public tables never enable row level security, so anyone with the ` +
    `project URL and the public anon key can read and write them: ` +
    `${missingRls.join(", ")}. Add ` +
    `"alter table public.<table> enable row level security;" in a migration.`
);

assert.deepEqual(
  missingRevoke,
  [],
  `these public tables enable RLS but keep their anon/authenticated grants: ` +
    `${missingRevoke.join(", ")}. RLS denies the rows today, but the grant ` +
    `means one permissive policy later would expose them. Add ` +
    `"revoke all on public.<table> from anon, authenticated;" in a migration.`
);

// The zero-policy stance is the premise of everything above: the checks only
// prove tables are closed because no policy reopens them. If a policy is ever
// added deliberately, this assertion is the place to record that decision.
const policies = ledger.match(/create\s+policy/gi) ?? [];
assert.equal(
  policies.length,
  0,
  `${policies.length} RLS policy statement(s) found. The platform's stance is ` +
    `zero policies with service-role-only access. If a policy is genuinely ` +
    `needed, update this check and say why here.`
);

console.log(
  `verify-rls-coverage: ${live.length} public tables, all with RLS enabled ` +
    `and anon/authenticated revoked, 0 policies.`
);
