import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const script = await readFile(
  new URL("supabase/functions/_shared/templates/deck-script.js", root), "utf8"
);
const assets = await readFile(
  new URL("supabase/functions/course-generation-worker/deck-assets.ts", root), "utf8"
);

assert.match(
  script,
  /prompt\.textContent = \(lang === "es" && message\.prompt_es\) \|\| message\.prompt/,
  "the deck prompt must render exactly one language"
);
assert.match(
  script,
  /copy\.textContent = \(lang === "es" && option\.text_es\) \|\| option\.text/,
  "each deck option must render exactly one language"
);
assert.doesNotMatch(
  script, /classroom-question-es/, "the stacked Spanish prompt element must be gone"
);
assert.doesNotMatch(
  script, /classroom-question-option-es/, "the stacked Spanish option element must be gone"
);

assert.match(
  script,
  /if \(keys !== "checkpoint_key,options,prompt,prompt_es,type,version"\) return false;/,
  "the bridge message shape must NOT change — an older deck would reject an unknown key and show no question at all"
);

assert.ok(
  assets.includes('prompt.textContent = (lang === "es" && message.prompt_es) || message.prompt'),
  "deck-assets.ts is stale — run: node tools/build-deck-assets.mjs"
);

console.log("deck classroom language verified");
