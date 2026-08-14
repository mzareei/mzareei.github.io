// Generated lectures go through the same ownership rules as everything else.
//
// Two problems, both only visible once content is owned:
//
//   The slug collision check refuses by name. Once the library is owner-scoped,
//   professor B is told that "firewalls" exists — content they are not allowed
//   to see — and is blocked from a title they have every right to use. A
//   uniqueness error across a privacy boundary is both a leak and impossible
//   advice.
//
//   The check and the write are far apart. create_job reads, and the write
//   happens much later. Two jobs created concurrently both pass, and the second
//   to land overwrites the first. The guarantee has to live at the write.
//
// WHERE THE GUARANTEE LIVES NOW (changed since this file was first written):
// the worker no longer upserts content_items from TypeScript. Persistence moved
// into the `finalize_pdf_generation_bundle` SQL function, which takes a row
// lock (`for update`), checks ownership, and writes — all in one transaction.
// That closed the race this file was written to police, so the assertions below
// follow the property into the migration rather than pinning the old shape.
// The worker keeps an earlier check of its own: it refuses before spending an
// Anthropic budget on a deck it will not be allowed to persist.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generation = fs.readFileSync(
  path.join(root, "supabase/functions/course-generation/index.ts"),
  "utf8"
);
const worker = fs.readFileSync(
  path.join(root, "supabase/functions/course-generation-worker/index.ts"),
  "utf8"
);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/0035_pdf_teaching_plans.sql"),
  "utf8"
);

// --- create_job must not name another owner's content ---------------------
assert.match(
  generation,
  /owner_profile_id/,
  "the collision check must look at who owns the clashing item"
);
assert.match(
  generation,
  /availableSlug|namespacedSlug/,
  "a colliding slug owned by someone else must be resolved, not refused"
);
// Refusing your own duplicate title is still right — that is your content and
// picking another name is advice you can act on.
assert.match(
  generation,
  /already exists/,
  "a clash with the caller's own item may still refuse by name"
);

// --- the worker refuses early, before spending on generation --------------
assert.match(
  worker,
  /owner_profile_id/,
  "the worker must check ownership before it persists a slug"
);
assert.match(
  worker,
  /generation_slug_not_owned/,
  "the worker must refuse rather than overwrite another owner's item"
);

assert.match(
  worker,
  /finalize_pdf_generation_bundle/,
  "the worker must persist through finalize_pdf_generation_bundle"
);

// Ordering has to be read at the CALL SITES, not from where the functions
// happen to sit in the file — `preparePriorVersion` is defined below the
// finalize helper and runs before it. Scoped to the deck assemble step;
// bank-only assembly legitimately has no deck to snapshot or replace.
const deckAssembleStart = worker.search(/async function stepAssemble\(/);
assert.ok(deckAssembleStart > -1, "stepAssemble must be locatable");
const deckAssemble = worker.slice(
  deckAssembleStart,
  worker.search(/async function stepAssembleBankOnly\(/)
);
const snapshotCallAt = deckAssemble.search(/await preparePriorVersion\(/);
const finalizeCallAt = deckAssemble.search(/await finalizeOrReconcile\(/);
assert.ok(
  snapshotCallAt > -1 && finalizeCallAt > -1,
  "the deck assemble step must snapshot and then finalize"
);
assert.ok(
  snapshotCallAt < finalizeCallAt,
  "the ownership refusal and deck snapshot must run before finalize is called "
    + "— finalize refuses without a verified snapshot of the deck it replaces"
);

// The worker must never write content_items directly again. Doing so would step
// around the SQL function's lock and reopen the concurrent-overwrite race that
// this whole file exists to prevent. Reads are fine — it selects to snapshot.
for (const match of worker.matchAll(/\.from\("content_items"\)/g)) {
  const following = worker.slice(match.index, match.index + 160);
  assert.doesNotMatch(
    following,
    /\.(upsert|insert|update|delete)\(/,
    "the worker must not write content_items directly — persistence belongs to "
      + "finalize_pdf_generation_bundle, whose row lock is the actual guarantee"
  );
}

// --- the SQL function owns the guarantee ----------------------------------
const finalizeStart = migration.search(
  /create or replace function public\.finalize_pdf_generation_bundle/
);
assert.ok(finalizeStart > -1, "finalize_pdf_generation_bundle must be locatable");
const finalizeEnd = migration.search(
  /revoke all on function public\.finalize_pdf_generation_bundle/
);
assert.ok(finalizeEnd > finalizeStart, "the end of the function must be locatable");
const finalize = migration.slice(finalizeStart, finalizeEnd);

// Reading the row without a lock leaves the same race in the database that the
// two-round-trip version had in TypeScript.
const lockAt = finalize.search(/from public\.content_items[\s\S]{0,200}?for update/);
assert.ok(
  lockAt > -1,
  "the existing content item must be selected FOR UPDATE, so two concurrent "
    + "jobs cannot both pass the ownership check"
);

const ownershipRaiseAt = finalize.search(/raise exception 'generation_slug_not_owned'/);
assert.ok(
  ownershipRaiseAt > -1,
  "the SQL function must refuse a slug owned by somebody else"
);

const contentWriteAt = finalize.search(
  /(update public\.content_items(?!\w)|insert into public\.content_items(?!\w))/
);
assert.ok(contentWriteAt > -1, "the content_items write must be locatable");
assert.ok(
  lockAt < ownershipRaiseAt && ownershipRaiseAt < contentWriteAt,
  "order must be: lock the row, then check ownership, then write — a check "
    + "after the write guarantees nothing"
);

// --- generated items are owned --------------------------------------------
// Both branches: the update path (regenerating an existing slug) and the insert
// path (a brand-new lecture). Missing it on either leaves unowned content that
// every ownership check in the platform then treats as fair game.
const updateBranch = finalize.slice(
  finalize.search(/update public\.content_items(?!\w)/),
  finalize.search(/insert into public\.content_items(?!\w)/)
);
assert.match(
  updateBranch,
  /owner_profile_id\s*=\s*generation_job\.created_by/,
  "regenerating a lecture must record its owner"
);
assert.match(
  finalize.slice(finalize.search(/insert into public\.content_items(?!\w)/)),
  /owner_profile_id/,
  "a newly generated content item must record its owner"
);

// --- generated decks get a version record too -----------------------------
// Routing generation through the same versioning rules was an explicit
// decision; otherwise regenerating a lecture overwrites the deck with no
// history, which is the behaviour the version table exists to end.
// `(?!\w)` so the table name cannot be matched as the prefix of a different
// one — without it, renaming the target to content_versions_anything still
// satisfied this check.
assert.match(
  finalize,
  /insert into public\.content_versions(?!\w)/,
  "finalize must record a version so a regenerated deck can be rolled back"
);
// The snapshot the worker uploaded is what that version row points at, so the
// worker still has to produce one.
assert.match(
  worker,
  /preparePriorVersion/,
  "the worker must snapshot the currently served deck before it is replaced"
);

console.log("verify-generation-ownership: OK");
