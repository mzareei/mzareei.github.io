// Requirement 7: content is private to its owner.
//
// Today every instructor sees and can overwrite every content item in the
// course. listContentLibrary scopes sections, sessions and releases by
// permittedSectionIds but returns content_items unfiltered; saveContentItem's
// update branch checks only that the item belongs to the course; and
// course-content-upload has no scoping at all, so create_upload_url will mint
// an upsert-enabled signed URL for any slug.
//
// The fail-open rule is the load-bearing part. Every existing item has a null
// owner until the backfill runs, so a null owner must stay visible to course
// instructors. A filter that hides null-owner items, deployed before the
// backfill, empties the professor's own Content screen.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const library = fs.readFileSync(
  path.join(root, "supabase/functions/course-content-library/index.ts"),
  "utf8"
);
const upload = fs.readFileSync(
  path.join(root, "supabase/functions/course-content-upload/index.ts"),
  "utf8"
);

// --- one shared predicate, not three hand-rolled copies --------------------
// An enum or a rule written in several places is several copies of one fact
// (pitfall #18). Ownership is checked in at least three call sites here.
assert.match(
  library,
  /function canEditContentItem\(/,
  "a single named predicate must decide whether a caller may write an item"
);

// --- fail open for unowned legacy content ---------------------------------
assert.match(
  library,
  /canEditContentItem[\s\S]{0,600}?owner_profile_id\s*==\s*null[\s\S]{0,200}?return true/,
  "an item with no recorded owner must remain editable by course instructors "
  + "until the ownership backfill runs"
);
assert.match(
  library,
  /visibleContentItems|function isVisibleContentItem/,
  "listing must go through a named visibility filter"
);
assert.match(
  library,
  /owner_profile_id\s*==\s*null/,
  "the listing filter must also treat a null owner as visible"
);

// --- the owner, shares, and the platform owner ----------------------------
assert.match(
  library,
  /isGlobalOwner/,
  "an active platform_owner stays global"
);
assert.match(
  library,
  /content_shares/,
  "listing must consider items shared with the caller's assigned groups"
);

// --- reads may be wider than writes ---------------------------------------
// Seeing a shared item is the point of sharing. Writing it is never allowed:
// a receiving instructor takes a copy instead.
assert.match(
  library,
  /canEditContentItem[\s\S]{0,800}?shared/i,
  "the write predicate must say explicitly that a share does not grant edit"
);

// --- saveContentItem refuses a non-owner before writing -------------------
const updateBranch = library.slice(
  library.indexOf("if (input.itemId) {"),
  library.indexOf("  } else {", library.indexOf("if (input.itemId) {"))
);
assert.ok(updateBranch.length > 200, "the saveContentItem update branch must be locatable");
assert.match(
  updateBranch,
  /canEditContentItem\([\s\S]{0,200}?throw new Error\(/,
  "the update branch must refuse a non-owner before touching content_items"
);
assert.doesNotMatch(
  updateBranch,
  /\.update\(\{[\s\S]*?canEditContentItem/,
  "the ownership check must run before the update, not after it"
);

// --- new items get an owner -----------------------------------------------
assert.match(
  library,
  /owner_profile_id: input\.actorProfileId/,
  "a newly created content item must record its owner"
);

// --- the upload function is the same boundary -----------------------------
// A signed upload URL is a write. course-content-upload mints one with
// upsert enabled for any slug in the course, so scoping the library alone
// would leave the storage object wide open.
assert.match(
  upload,
  /content_items[\s\S]{0,400}?owner_profile_id/,
  "create_upload_url must load the existing item's owner before minting a URL"
);
assert.match(
  upload,
  /content_upload_not_owned|not_owned/,
  "the upload refusal must carry a stable code"
);
assert.match(
  upload,
  /owner_profile_id: /,
  "register_item must record ownership on the item it upserts"
);

console.log("verify-content-ownership-scope: OK");
