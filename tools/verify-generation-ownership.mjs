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
//   The check and the write are far apart. create_job reads, and the worker's
//   assemble step upserts on (course_id, slug) much later. Two jobs created
//   concurrently both pass, and the second to assemble overwrites the first.
//   The guarantee has to live at the write.
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

// --- the worker owns the guarantee ----------------------------------------
assert.match(
  worker,
  /owner_profile_id/,
  "assemble must check ownership before upserting a slug"
);
assert.match(
  worker,
  /generation_slug_not_owned|not_owned/,
  "the worker must refuse rather than overwrite another owner's item"
);
const assembleOwnershipAt = worker.search(/owner_profile_id/);
const upsertAt = worker.search(/from\("content_items"\)\s*\n?\s*\.upsert\(/);
assert.ok(upsertAt > -1, "the content_items upsert must be locatable");
assert.ok(
  assembleOwnershipAt > -1 && assembleOwnershipAt < upsertAt,
  "the ownership check must run before the upsert, not after it"
);

// --- generated items are owned --------------------------------------------
assert.match(
  worker,
  /owner_profile_id: /,
  "a generated content item must record its owner"
);

// --- generated decks get a version record too -----------------------------
// Routing generation through the same versioning rules was an explicit
// decision; otherwise regenerating a lecture overwrites the deck with no
// history, which is the behaviour the version table exists to end.
assert.match(
  worker,
  /content_versions/,
  "assemble must record a version so a regenerated deck can be rolled back"
);

console.log("verify-generation-ownership: OK");
