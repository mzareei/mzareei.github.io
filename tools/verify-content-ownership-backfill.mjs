// D3: assign every existing TC2007B content item to the platform owner.
//
// This is the one approved production write in the ownership work, and it is a
// data migration, not a schema change. Production said `created_by` is null on
// all 27 items, so there is nothing to recover from — the owner has to be
// asserted. The professor confirmed on 2026-08-05 that all existing content is
// his.
//
// The dangerous version of this migration is the one that guesses. If more than
// one platform owner exists, or none, picking one silently hands the whole
// course library to an arbitrary account. It must refuse instead.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/0033_assign_content_ownership.sql"),
  "utf8"
);

// --- it must refuse rather than guess -------------------------------------
assert.match(
  sql,
  /count\(\*\)[\s\S]{0,400}?course_memberships[\s\S]{0,300}?'platform_owner'/i,
  "the migration must count active platform owners before assigning anything"
);
assert.match(
  sql,
  /<>\s*1|!=\s*1/,
  "it must require exactly one owner, not simply at least one"
);
assert.match(
  sql,
  /raise exception/i,
  "a failed precondition must abort the transaction, not fall through"
);

// --- it must not touch anything else --------------------------------------
assert.doesNotMatch(sql, /\bdrop\s+/i, "the backfill must not drop anything");
assert.doesNotMatch(sql, /\bdelete\s+from\b/i, "the backfill must not delete rows");
assert.doesNotMatch(sql, /\btruncate\b/i, "the backfill must not truncate");
assert.doesNotMatch(
  sql,
  /update\s+public\.(question_banks|questions|content_releases|profiles|class_sessions)/i,
  "the backfill touches content_items only"
);

// --- idempotent: only fills what is empty ---------------------------------
// Re-running must not reassign an item whose owner was deliberately changed
// later — for example a lecture handed to another professor.
assert.match(
  sql,
  /update public\.content_items[\s\S]{0,400}?where[\s\S]{0,200}?owner_profile_id is null/i,
  "only rows with no owner may be filled, so a re-run cannot steal reassigned content"
);

// --- created_by stays null ------------------------------------------------
// "Who owns this now" and "who created this" are different questions. The
// second has no answer in the data, and writing one would be fabricating
// history to make a column look populated.
assert.doesNotMatch(
  sql,
  /set[\s\S]{0,200}?created_by\s*=/i,
  "created_by must stay null — ownership is asserted, authorship is not known"
);

// --- it must prove it finished --------------------------------------------
assert.match(
  sql,
  /owner_profile_id is null[\s\S]{0,600}?raise exception/i,
  "the migration must assert no item is left unowned before committing"
);

// --- scoped to the course -------------------------------------------------
assert.match(
  sql,
  /course_id = 'tc2007b'/,
  "the backfill must be scoped to TC2007B rather than every course"
);

console.log("verify-content-ownership-backfill: OK");
