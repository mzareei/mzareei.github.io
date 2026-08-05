// Requirement 8: only an active platform_owner may create, rename, archive or
// otherwise modify a course group (course_sections).
//
// Creation was already owner-only. The update branch was not: it required only
// that the section be in the caller's permittedSectionIds, so any assigned
// instructor could rename a group or archive it. The section-scope hardening
// recorded in the frontend's pitfall #56 covered rosters, sessions, releases,
// grades and notes — group *lifecycle* was never in that pass.
//
// The browser cannot reach the table (RLS on, zero policies), so this function
// is the whole boundary. A crafted request must be refused here or nowhere.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/course-section-management/index.ts"),
  "utf8"
);

// --- the update branch must refuse a non-owner -----------------------------
// saveSection() splits on input.sectionId: truthy is update, falsy is insert.
const updateBranch = fn.slice(
  fn.indexOf("if (input.sectionId) {"),
  fn.indexOf("  } else {", fn.indexOf("if (input.sectionId) {"))
);
assert.ok(updateBranch.length > 200, "the saveSection update branch must be locatable");

assert.match(
  updateBranch,
  /if \(!input\.permissions\.isGlobalOwner\)[\s\S]{0,200}?throw new Error\(/,
  "the update branch must throw for a non-owner before touching course_sections"
);
assert.doesNotMatch(
  updateBranch,
  /\.update\(\{[\s\S]*?\}\)[\s\S]*?if \(!input\.permissions\.isGlobalOwner\)/,
  "the owner check must run before the update, not after it"
);

// The insert branch keeps the guard it already had.
const insertBranch = fn.slice(fn.indexOf("  } else {", fn.indexOf("if (input.sectionId) {")));
assert.match(
  insertBranch,
  /if \(!input\.permissions\.isGlobalOwner\)[\s\S]{0,200}?throw new Error\(/,
  "creating a group must stay platform-owner only"
);

// --- a stable error code, so the UI can localize the guidance --------------
// Pitfall #41: return a stable code rather than a prose message the client has
// to string-match. Pitfall #17: the message must reach the caller as a 403.
assert.match(
  fn,
  /section_management_owner_only/,
  "refusals must carry the stable section_management_owner_only code"
);
assert.match(
  fn,
  /section_management_owner_only[\s\S]{0,600}?status: 403|status: 403[\s\S]{0,600}?section_management_owner_only/,
  "the owner-only refusal must be returned as 403, not 400"
);
// The SPA's callFn reads `error_code`. Emitting `code` compiles on both sides
// and silently renders the raw string to the professor — pitfall #3's shape,
// and it was written that way once already in this very change.
assert.match(
  fn,
  /error_code: "section_management_owner_only"/,
  "the stable code must be returned as error_code, the field the SPA actually reads"
);

// --- reads are unchanged ---------------------------------------------------
// An assigned instructor must still list the groups they teach. Guarding the
// read would regress the section-scoped access pitfall #56 established, and
// would empty the Classes and People screens for every non-owner.
assert.match(
  fn,
  /if \(!permissions\.isGlobalOwner\) query = query\.in\("id", permissions\.permittedSectionIds\);/,
  "listSections must keep returning an instructor's own assigned groups"
);
assert.doesNotMatch(
  fn,
  /async function listSections[\s\S]{0,400}?isGlobalOwner\)[\s\S]{0,80}?throw/,
  "listing groups must not be restricted to the platform owner"
);

console.log("verify-section-owner-only: OK");
