// Taking a copy of someone else's lecture.
//
// The professor chose copy-based sharing over read-only on 2026-08-05: a
// receiving instructor sees a shared item and takes a copy they own and can
// edit, question bank included. The owner's later improvements deliberately do
// not propagate, and the original is unreachable from the copier's write path.
//
// The two ways this goes wrong:
//   * a copy that touches the original — the whole point is that it cannot
//   * a copy without its question bank, which on this platform is a deck you
//     can show and nothing else: no checkpoints, no end-of-class quiz
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/course-content-library/index.ts"),
  "utf8"
);

assert.match(fn, /"copy_content_item"/, "a copy action must exist");

const fork = fn.slice(fn.indexOf("async function copyContentItem"));
assert.ok(fork.length > 800, "the copy implementation must be locatable");

// --- visibility is the gate, ownership is not -----------------------------
// A share exists precisely so somebody who does not own the item can copy it.
// Requiring ownership here would make sharing useless.
assert.match(
  fork,
  /isVisibleContentItem/,
  "the caller must be able to see the source item"
);
assert.doesNotMatch(
  fork,
  /canEditContentItem\(source/,
  "copying must not require edit rights on the source — that is what sharing is for"
);

// --- the original is never written ----------------------------------------
// Every write must name the new row or the new path. A single update against
// the source id would defeat the entire model.
assert.doesNotMatch(
  fork,
  /\.update\([\s\S]{0,200}?\.eq\("id", source\.id\)/,
  "the source item must never be updated"
);
assert.doesNotMatch(
  fork,
  /\.upload\(\s*sourcePath/,
  "the source storage object must never be overwritten"
);
assert.doesNotMatch(
  fork,
  /\.delete\(|\.remove\(/,
  "copying deletes nothing"
);

// --- the copy is owned by the copier --------------------------------------
assert.match(
  fork,
  /owner_profile_id: actorProfileId|owner_profile_id: input\.actorProfileId/,
  "the copy must be owned by whoever made it"
);
assert.match(
  fork,
  /forked_from_content_item_id: source\.id/,
  "provenance must be recorded on the copy"
);
assert.match(
  fork,
  /visibility: "owner_private"/,
  "a copy starts private to its new owner, not carrying the source's sharing"
);

// --- a fresh slug, and it must not collide --------------------------------
// Two professors both copying the same lecture must not land on one slug.
assert.match(
  fork,
  /content_items[\s\S]{0,400}?\.eq\("slug"|uniqueSlug|availableSlug/,
  "the copy must take a slug that is free in this course"
);

// --- the question bank travels with it ------------------------------------
assert.match(fork, /question_banks/, "the source's active bank must be copied");
assert.match(fork, /from\("questions"\)/, "the bank's questions must be copied");
assert.match(fork, /question_options/, "each question's options must be copied");
// Checkpoint metadata is what makes a lecture presentable. A copy that drops
// it produces a deck whose checkpoints reference nothing.
for (const column of [
  "segment_key",
  "source_slide_start",
  "source_slide_end",
  "checkpoint_after_slide"
]) {
  assert.match(fork, new RegExp(column), `${column} must be carried onto the copied questions`);
}
// Bilingual fields are not optional on this platform.
for (const column of ["prompt_es", "option_text_es"]) {
  assert.match(fork, new RegExp(column), `${column} must be carried onto the copy`);
}

// --- nothing pre-existing is ever overwritten -----------------------------
// Storage first, to a brand new path, then the rows. Every write targets
// something that did not exist a moment ago, so a failure anywhere leaves the
// source untouched and at worst an orphan object behind.
const storageAt = fork.search(/\.upload\(/);
const itemInsertAt = fork.search(/from\("content_items"\)\s*\n?\s*\.insert\(/);
assert.ok(storageAt > -1, "the deck must be copied to a new storage path");
assert.ok(itemInsertAt > -1, "a new content item must be inserted");
assert.ok(
  storageAt < itemInsertAt,
  "copy the object before the row that points at it, so no row ever points at a missing file"
);

console.log("verify-content-fork: OK");
