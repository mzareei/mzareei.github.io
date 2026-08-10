import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [fn, config] = await Promise.all([
  read("supabase/functions/course-content-import/index.ts"),
  read("supabase/config.toml")
]);

// Node's native TypeScript type-stripping imports deck-validation.ts
// directly — no transpile step, no npm dependency. Same pattern already used
// by tools/verify-checkpoint-decks.mjs and
// tools/verify-live-checkpoint-security.mjs. This repo's CI
// (.github/workflows/verify-course-deck.yml, node-version: 22) runs
// tools/verify-slide-checkpoints.mjs, which imports several .ts files the
// same way — proving the pattern works under the exact Node version CI
// uses — and, as of this file's own fix round, runs this script directly
// too. deck-validation.ts uses only erasable syntax (interfaces and type
// annotations, no enums/namespaces), so it imports cleanly this way.
const mod = await import("../supabase/functions/_shared/deck-validation.ts");

const opts = {
  allowedHosts: ["amiunique.org"],
  forbiddenHosts: ["mzareei.github.io"]
};
const page = (body) => `<html><head><title>Deck</title></head><body>${body}</body></html>`;

assert.deepEqual(mod.validateDeckHtml(page("<p>hello</p>"), opts), []);

const relative = mod.validateDeckHtml(page('<img src="diagram.png">'), opts);
assert.equal(relative.length, 1);
assert.equal(relative[0].kind, "relative");
assert.equal(
  relative[0].reference, "diagram.png",
  "a surviving relative reference 404s from behind the gate — it must name the reference"
);

const forbidden = mod.validateDeckHtml(
  page('<a href="https://mzareei.github.io/week-05/">Lecture</a>'), opts
);
assert.equal(forbidden[0].kind, "forbidden_host", "pitfall #57: a link from inside the gate to the ungated copy");

const undeclared = mod.validateDeckHtml(
  page('<script src="https://evil.example.com/beacon.js"></script>'), opts
);
assert.equal(
  undeclared[0].kind, "undeclared_host",
  "an undeclared host is the anti-exfiltration control — a beacon needs a host"
);
assert.equal(undeclared[0].host, "evil.example.com");

assert.deepEqual(
  mod.validateDeckHtml(page('<a href="https://amiunique.org/">Try it</a>'), opts), [],
  "a declared teaching host is allowed"
);
assert.deepEqual(
  mod.validateDeckHtml(page('<a href="#slide-3">Next</a><a href="mailto:x@y.z">Mail</a>'), opts), [],
  "fragments and mailto are not references to anywhere"
);
assert.equal(
  mod.validateDeckHtml("<html><body><p>no title</p></body></html>", opts)[0].kind, "no_title"
);

// Widened references() matching (final review fix round): quoted attributes
// alone missed unquoted values, srcset, and CSS url()/@import — each of
// these must be caught, not silently pass as a page with zero references.
const unquotedSrc = mod.validateDeckHtml(page("<img src=diagram.png>"), opts);
assert.equal(unquotedSrc.length, 1, "an unquoted src= must still be found");
assert.equal(unquotedSrc[0].kind, "relative");
assert.equal(unquotedSrc[0].reference, "diagram.png");

const srcsetUndeclared = mod.validateDeckHtml(
  page('<img src="https://amiunique.org/a.png" srcset="https://evil.example.com/beacon.png 1x">'), opts
);
assert.ok(
  srcsetUndeclared.some((problem) => problem.kind === "undeclared_host" && problem.host === "evil.example.com"),
  "srcset must be scanned for outbound references, not just src"
);

const cssUrlUndeclared = mod.validateDeckHtml(
  page('<div style="background:url(https://evil.example.com/bg.png)">x</div>'), opts
);
assert.ok(
  cssUrlUndeclared.some((problem) => problem.kind === "undeclared_host" && problem.host === "evil.example.com"),
  "a CSS url(...) in a style= attribute is an outbound reference too"
);

// <title> inside an HTML comment must not count as a real title.
assert.equal(
  mod.validateDeckHtml("<html><head><!-- <title>Deck</title> --></head><body>x</body></html>", opts)[0].kind,
  "no_title",
  "a <title> that only exists inside a comment never renders"
);

assert.match(fn, /case "import_content"/);
assert.match(fn, /validateDeckHtml/);
assert.match(
  fn, /platform_owner|instructor/,
  "the commit endpoint must be instructor-gated — the browser never writes directly"
);
assert.doesNotMatch(
  fn, /anthropic|ANTHROPIC/i,
  "the import path must make no model call"
);
assert.match(config, /\[functions\.course-content-import\]/);

assert.match(
  fn, /from\("audit_log"\)/,
  "the audit table is audit_log — audit_events does not exist"
);
assert.match(fn, /target_type:/, "audit_log.target_type is NOT NULL");
assert.match(fn, /action:/, "audit_log.action is NOT NULL");
assert.match(fn, /metadata:/, "audit_log.metadata must be a JSON object");

console.log("content import security verified");
