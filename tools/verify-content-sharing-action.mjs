// Requirement 7, the half that was never built. course-content-library grew
// canEditContentItem, isVisibleContentItem, and copy_content_item — every part
// of *consuming* a share. Nothing ever wrote a content_shares row: there was
// no action an owner could call to grant one in the first place, so "share
// with a group" existed in the schema and nowhere else.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/course-content-library/index.ts"),
  "utf8"
);

assert.match(fn, /"share_content_item"/, "a share-creation action must exist");
assert.match(fn, /"unshare_content_item"/, "an owner must be able to revoke a share");

// --- only the owner may share, and only what they own ----------------------
const shareFn = fn.slice(
  fn.indexOf("async function shareContentItem"),
  fn.indexOf("async function unshareContentItem")
);
assert.ok(shareFn.length > 200, "the share implementation must be locatable");
assert.match(
  shareFn,
  /canEditContentItem\(/,
  "sharing must require edit rights on the source item — only the owner grants access"
);

// --- receiving instructors cannot re-share ----------------------------------
// A share is not edit access, so it must not pass canEditContentItem itself —
// confirmed already by content-fork's assertion that copying requires only
// visibility. This test pins the sharing endpoint specifically: a caller who
// can only see the item (via an existing share) must not be able to call
// share_content_item on it.
assert.doesNotMatch(
  shareFn,
  /isVisibleContentItem\(/,
  "sharing must not accept mere visibility — a recipient must never re-share"
);

// --- the target is a real course section ------------------------------------
assert.match(
  shareFn,
  /course_sections/,
  "the target section must be validated against real sections in this course"
);

// --- idempotent, not a duplicate row every click ----------------------------
assert.match(
  shareFn,
  /onConflict|on_conflict|upsert/i,
  "re-sharing with the same group must not create a duplicate row"
);

// --- unshare is owner-gated too ---------------------------------------------
const unshareFn = fn.slice(
  fn.indexOf("async function unshareContentItem"),
  fn.indexOf("async function copyContentItem")
);
assert.ok(unshareFn.length > 100, "the unshare implementation must be locatable");
assert.match(
  unshareFn,
  /canEditContentItem\(/,
  "revoking a share must require edit rights on the source item"
);

// --- the owner needs to see who they've shared with, and pick a target -----
// Without a widened section list, an instructor cannot even name a group they
// do not teach — course-section-management deliberately hides those
// (pitfall #38). Sharing needs its own narrow, non-sensitive list: id, code
// and name only, no roster or session data, available to any active
// instructor regardless of which sections they teach.
assert.match(
  fn,
  /shareable_sections|all_sections_for_sharing/,
  "the library response must include a course-wide, non-sensitive section list for the share picker"
);
assert.match(
  fn,
  /shares:/,
  "an owned item's current shares must be returned so the owner can see and revoke them"
);

console.log("verify-content-sharing-action: OK");
