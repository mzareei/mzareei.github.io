import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [validation, fn, config] = await Promise.all([
  read("supabase/functions/_shared/deck-validation.ts"),
  read("supabase/functions/course-content-import/index.ts"),
  read("supabase/config.toml")
]);

const compiledPath = new URL("supabase/functions/_shared/deck-validation.ts", root);
const ts = (await import("typescript")).default;
const compiled = ts.transpileModule(await readFile(compiledPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

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
