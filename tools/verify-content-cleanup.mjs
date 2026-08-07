// D4 delivered as an in-app action: clean the public-site links out of a
// stored deck, one content item per call.
//
// The ordering is the whole safety story. Postgres and Storage do not share a
// transaction, so the sequence has to be chosen so that every possible failure
// leaves something harmless behind:
//
//   read → transform → verify → back up the OLD bytes → record the version
//   → overwrite the live object
//
// Fail during read/transform/verify: nothing was written at all.
// Fail during backup:               the live object is untouched.
// Fail during the version insert:   an orphan backup file, live object intact.
// Fail during the overwrite:        backup and record both describe the bytes
//                                   that are still live. Retry is safe.
//
// The forbidden order is overwrite-then-back-up, which loses the only copy of
// the previous deck on any failure — the shape of the legacy-rewrite trap.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/course-content-cleanup/index.ts"),
  "utf8"
);
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");

// --- it must be deployable -------------------------------------------------
assert.match(
  config,
  /\[functions\.course-content-cleanup\](?:\s*#[^\n]*\n)*\s*verify_jwt = false/,
  "the function must be registered in config.toml with verify_jwt = false"
);

// --- a dry run that writes nothing ----------------------------------------
// Availability is a delivery promise: the professor must be able to see what
// would change before anything changes.
assert.match(fn, /"preview"/, "a preview action must exist");
const previewBlock = fn.slice(fn.indexOf('=== "preview"'), fn.indexOf('=== "clean"'));
assert.ok(previewBlock.length > 40, "the preview branch must be locatable");
assert.doesNotMatch(previewBlock, /\.upload\(/, "preview must never write to storage");
assert.doesNotMatch(previewBlock, /\.insert\(|\.update\(/, "preview must never write to the database");

// --- both cleanup passes, not just the anchors ----------------------------
assert.match(
  fn,
  /removeLegacyDeckNavigation/,
  "the anchor pass must run"
);
assert.match(
  fn,
  /removeLegacyDeckScriptNavigation/,
  "the engine-script pass must run — anchors alone leave three links per lecture"
);

// --- verify before writing, and fail closed -------------------------------
// The pattern is a regex literal in the source, so the dots are escaped there.
assert.match(
  fn,
  /publicOriginPattern\s*=\s*\/[^\n]*mzareei/,
  "a public-origin pattern must be defined"
);
assert.match(
  fn,
  /const after = publicReferences\(cleaned\);[\s\S]{0,200}?if \(after\.length\)/,
  "the cleaned result must be re-checked for surviving public references before writing"
);
assert.match(
  fn,
  /throw new Error\([\s\S]{0,200}?public/i,
  "a deck that still carries public references must abort, not be uploaded"
);
// A transformation that changes the teaching content is a failed
// transformation, not a cleanup.
assert.match(
  fn,
  /extractTeachingSlides/,
  "teaching slides must be re-extracted and compared before the write"
);

// --- the ordering, measured inside the write sequence ---------------------
// The first draft of this check searched the whole file, which measured
// declaration order: nextVersionNumber is defined above cleanOne, so
// content_versions "appeared" before the backup no matter what the code did.
// Scope it to the write section, where the order is the thing that matters.
const writeSection = fn.slice(fn.indexOf("---- writes, in the only safe order"));
assert.ok(writeSection.length > 400, "the write section must be locatable");

const backupAt = writeSection.search(/\.versions\//);
const versionInsertAt = writeSection.search(/from\("content_versions"\)\s*\n?\s*\.insert\(/);
const overwriteAt = writeSection.search(/\.upload\(\s*\n?\s*storagePath/);
assert.ok(backupAt > -1, "the old bytes must be copied to a .versions/ path");
assert.ok(versionInsertAt > -1, "a content_versions row must be inserted");
assert.ok(overwriteAt > -1, "the live object at storagePath must be overwritten");
assert.ok(
  backupAt < versionInsertAt && versionInsertAt < overwriteAt,
  "order must be back up the old bytes, record the version, then overwrite"
);

// And nothing may be written before that section — every fallible read,
// transform and check has to have happened already.
const readSection = fn.slice(fn.indexOf("every fallible read"), fn.indexOf("---- writes, in the only safe order"));
assert.ok(readSection.length > 200, "the read/verify section must be locatable");
assert.doesNotMatch(readSection, /\.upload\(|\.insert\(/, "nothing may be written before every check has passed");

// --- ownership -------------------------------------------------------------
assert.match(
  fn,
  /owner_profile_id/,
  "cleanup is a write and must respect content ownership"
);

// --- one item per call -----------------------------------------------------
// A loop over 23 decks in one invocation is one timeout away from a partial
// sweep with no record of where it stopped.
assert.match(
  fn,
  /content_item_id/,
  "cleaning must target a single named content item"
);
assert.doesNotMatch(
  fn,
  /for \(const item of items\)[\s\S]{0,400}?\.upload\(/,
  "the function must not sweep every item in one invocation"
);

console.log("verify-content-cleanup: OK");
