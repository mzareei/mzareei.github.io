// Does what is deployed match what is in this repo?
//
// This exists because of a real class. Migration 0048 let a paused class hold
// two attendance rows per student, and `_shared/attendance.ts` was fixed the
// next day to read a list instead of a row. Three of the five functions that
// import it were redeployed. `course-activity-attempt` and `course-exit-ticket`
// were not — so they kept running the old copy, and every student who had
// scanned in on both class days got `JSON object requested, multiple (or no)
// rows returned` on their phone when the end-of-class quiz opened. Students who
// had only ever scanned once were fine, which is what made it look random.
//
// Nothing anywhere reported this. `git log` was clean, the migration was
// applied, the source was correct, and the fix had been reviewed. The only
// broken thing was a deploy that never happened — and an edge function bundles
// its `../_shared/*.ts` imports at deploy time, so editing a shared module
// silently ages every importer that is not redeployed with it.
//
// So this compares the deployed *source*, not timestamps. A commit made a minute
// after a deploy is not a stale deploy, and no amount of clock arithmetic can
// tell those apart. Downloading and diffing can.
//
//   node supabase/tools/check-function-deploys.mjs            # report
//   node supabase/tools/check-function-deploys.mjs --deploy   # print the fix
//
// Run it before class day. Exit code 1 means something in production is not
// what this repo says it is.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FN_DIR = path.join(REPO, "supabase/functions");
const PROJECT_REF = "ojmbupftdikwmlqvibwt";
const printDeploy = process.argv.includes("--deploy");

// The Gen-1 quiz-* functions are frozen; the platform never calls them.
const FROZEN = /^quiz-/;

const run = (args, cwd) =>
  execFileSync("npx", ["supabase", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function walk(dir, base = dir, out = new Map()) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.set(path.relative(base, full), readFileSync(full, "utf8"));
  }
  return out;
}

/** Normalised so trailing-newline and CRLF noise never reads as a real drift. */
const norm = (text) => text.replace(/\r\n/g, "\n").replace(/\s+$/, "");

console.log(`Comparing ${PROJECT_REF} against this repo…\n`);

const deployed = JSON.parse(run(["functions", "list", "--project-ref", PROJECT_REF], REPO)).functions
  .filter((fn) => !FROZEN.test(fn.slug))
  .filter((fn) => existsSync(path.join(FN_DIR, fn.slug, "index.ts")));

// Download into a scratch project so the working tree is never touched. The CLI
// writes to <cwd>/supabase/functions/<slug>, and overwriting the real source
// with whatever is live would be a far worse bug than the one this catches.
const scratch = mkdtempSync(path.join(tmpdir(), "fn-deploy-check-"));
mkdirSync(path.join(scratch, "supabase"), { recursive: true });
copyFileSync(path.join(REPO, "supabase/config.toml"), path.join(scratch, "supabase/config.toml"));

const stale = [];
const unreadable = [];

try {
  for (const fn of deployed) {
    try {
      run(["functions", "download", fn.slug, "--project-ref", PROJECT_REF], scratch);
    } catch (error) {
      unreadable.push({ slug: fn.slug, why: String(error.message || error).split("\n")[0] });
      continue;
    }

    const live = walk(path.join(scratch, "supabase/functions", fn.slug));
    const differences = [];
    for (const [rel, liveText] of live) {
      // The download flattens ../_shared next to the function; find the real one.
      const mine = path.join(FN_DIR, fn.slug, rel);
      const shared = path.join(FN_DIR, rel.replace(/^\.\.\//, ""));
      const source = existsSync(mine) ? mine : existsSync(shared) ? shared : null;
      if (!source) continue;
      if (norm(liveText) !== norm(readFileSync(source, "utf8"))) {
        differences.push(path.relative(FN_DIR, source));
      }
    }
    if (differences.length) stale.push({ slug: fn.slug, differences });
    process.stdout.write(differences.length ? "x" : ".");
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("\n");

for (const { slug, why } of unreadable) {
  console.log(`?  ${slug} — could not be read from production: ${why}`);
}

if (!stale.length) {
  console.log(`OK — all ${deployed.length} deployed functions match this repo.`);
  process.exit(unreadable.length ? 1 : 0);
}

console.log(`${stale.length} function(s) in production do NOT match this repo:\n`);
for (const { slug, differences } of stale) {
  console.log(`  ${slug}`);
  for (const file of differences) console.log(`      differs in ${file}`);
}

console.log("\nDeploy them with:\n");
console.log(`  cd ${REPO}`);
for (const { slug } of stale) {
  console.log(`  npx supabase functions deploy ${slug} --project-ref ${PROJECT_REF}`);
}
if (!printDeploy) console.log("\n(--deploy prints the same list; this script never deploys by itself.)");
process.exit(1);
