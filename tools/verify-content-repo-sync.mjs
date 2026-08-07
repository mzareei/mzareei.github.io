// Static contract verifier for the instructor-only content repository sync.
// The live Edge Function still needs a Supabase smoke test after deployment;
// this catches accidental removal of its security and write-boundary gates.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fnPath = path.join(root, "supabase/functions/course-content-sync/index.ts");
const configPath = path.join(root, "supabase/config.toml");
assert.ok(fs.existsSync(fnPath), "course-content-sync Edge Function must exist");
const fn = fs.readFileSync(fnPath, "utf8");
const config = fs.readFileSync(configPath, "utf8");

assert.match(config, /\[functions\.course-content-sync\]/, "sync must be registered with Supabase");
assert.match(fn, /COURSE_CONTENT_GITHUB_TOKEN/, "sync must use the server-side GitHub secret");
assert.match(fn, /github\.com\/repos\/mzareei\/course-content/, "sync must read the private course-content repository");
assert.match(fn, /githubBranch\s*=\s*["']main["']/, "sync must read the repository main branch");
assert.match(fn, /body\.action\s*!==\s*["']sync["']/, "sync action must be explicit");
assert.match(fn, /auth\.getUser/, "sync must authenticate the caller");
assert.match(fn, /owner_profile_id/, "sync must enforce item ownership");
assert.match(fn, /content_item_id/, "sync must target one existing content item");
assert.match(fn, /content_item_id.*meta|meta.*content_item_id/s, "sync must match repository metadata to the database item");
assert.match(fn, /source_ref/, "sync must preserve the existing storage path");
assert.match(fn, /createHash\("sha256"\)/, "sync must hash the pulled artifact");
assert.match(fn, /unchanged|no.?op/i, "sync must support an identical-content no-op");
assert.match(fn, /mzareei\.github\.io/, "sync must reject the public origin");
assert.match(fn, /relative reference|relative.*src|relative.*href/i, "sync must reject surviving relative asset references");
assert.match(fn, /storage.*upload|\.storage\.from\(/s, "sync must write the artifact to private storage");
assert.match(fn, /content_versions/, "sync must record version history");
assert.match(fn, /published_from/, "sync must record the publication source");
assert.match(fn, /source_commit/, "sync must record the Git commit");
assert.match(fn, /audit_log/, "sync must record an audit event");
assert.doesNotMatch(fn, /from\("content_releases"\)/, "sync must not write student releases");

console.log("verify-content-repo-sync: OK");
