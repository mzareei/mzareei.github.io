// Requirement 7 schema, plus the delete guard.
//
// Content is private to its owner. Sharing makes it visible to another
// instructor's groups; taking a copy forks it into a new item that the copier
// owns. Publishing records a version so a bad deck can be rolled back.
//
// The delete guard exists because question_banks.content_item_id is
// `on delete set null`: deleting a content item silently orphans its bank and
// every question in it. Nothing in the app deletes content items today, but a
// hand-written SQL delete would, and 223 questions is not something to lose to
// a stray statement.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/0032_content_ownership_and_versions.sql"),
  "utf8"
);

// --- additive only ---------------------------------------------------------
// The standing decision is additive migrations. A drop or a destructive update
// here would run against production content the reset deliberately preserved.
assert.doesNotMatch(sql, /\bdrop\s+table\b/i, "the migration must not drop a table");
assert.doesNotMatch(sql, /\bdelete\s+from\b/i, "the migration must not delete rows");
assert.doesNotMatch(sql, /\btruncate\b/i, "the migration must not truncate");
// It must not backfill either: assigning ownership is D3, a separate approved
// step, and doing it inside the schema migration would make the two
// indistinguishable in the ledger.
assert.doesNotMatch(
  sql,
  /update\s+public\.content_items\s+set\s+owner_profile_id/i,
  "ownership backfill is a separate approved step, not part of the schema migration"
);

// --- content_items gains ownership, visibility and fork provenance ---------
assert.match(sql, /alter table public\.content_items/i);
assert.match(
  sql,
  /add column if not exists owner_profile_id uuid references public\.profiles\(id\) on delete set null/i,
  "content_items needs a nullable owner (null = unowned legacy item, filters fail open)"
);
assert.match(
  sql,
  /add column if not exists visibility text not null default 'owner_private'/i,
  "visibility must default to owner_private"
);
assert.match(
  sql,
  /check \(visibility in \('owner_private', 'course_shared'\)\)/i,
  "visibility must be constrained to the two known values"
);
assert.match(
  sql,
  /add column if not exists forked_from_content_item_id uuid references public\.content_items\(id\) on delete set null/i,
  "a copy must record what it was copied from"
);

// --- content_shares --------------------------------------------------------
assert.match(sql, /create table if not exists public\.content_shares/i);
assert.match(
  sql,
  /unique \(content_item_id, section_id\)/i,
  "a share is one row per item per group"
);
assert.match(
  sql,
  /content_shares[\s\S]*?shared_by uuid references public\.profiles\(id\)/i,
  "a share must record who granted it"
);

// --- content_versions ------------------------------------------------------
assert.match(sql, /create table if not exists public\.content_versions/i);
assert.match(
  sql,
  /unique \(content_item_id, version\)/i,
  "version numbers must be unique per item"
);
assert.match(
  sql,
  /content_versions[\s\S]*?content_sha256 text not null/i,
  "a version must record the artifact hash it can be rolled back to"
);
assert.match(
  sql,
  /content_versions[\s\S]*?storage_path text not null/i,
  "a version must record where the immutable copy lives"
);
// on delete cascade: versions belong to their item and are meaningless without
// it. That is safe because the delete guard below refuses the delete anyway.
assert.match(
  sql,
  /content_versions[\s\S]*?content_item_id uuid not null references public\.content_items\(id\) on delete cascade/i,
  "versions belong to their content item"
);

// --- the delete guard ------------------------------------------------------
assert.match(
  sql,
  /create or replace function public\.guard_content_item_delete/i,
  "a delete guard function must exist"
);
assert.match(
  sql,
  /guard_content_item_delete[\s\S]*?from public\.question_banks[\s\S]*?status = 'active'/i,
  "the guard must look for an active question bank on the item being deleted"
);
assert.match(
  sql,
  /guard_content_item_delete[\s\S]*?raise exception/i,
  "the guard must refuse the delete, not merely warn"
);
assert.match(
  sql,
  /create trigger [a-z_]+\s+before delete on public\.content_items/i,
  "the guard must be wired as a BEFORE DELETE trigger"
);
assert.match(
  sql,
  /for each row execute function public\.guard_content_item_delete\(\)/i,
  "the trigger must run per row"
);

// --- search_path discipline -----------------------------------------------
// pitfall #35: a security definer function needs every trusted schema it uses.
const definerBlocks = sql.match(/security definer[\s\S]{0,200}?set search_path = [^\n;]+/gi) || [];
for (const block of definerBlocks) {
  assert.match(
    block,
    /set search_path = public(, extensions)?/,
    "security definer functions must pin a restricted trusted search path"
  );
}

console.log("verify-content-ownership-schema: OK");
