// Regenerates supabase/functions/course-generation-worker/deck-assets.ts from
// the canonical deck template. Edge functions only ship files reachable through
// a TypeScript import, so the engine's CSS/JS and the skeleton have to be
// embedded rather than read from disk at runtime.
//
//   node tools/build-deck-assets.mjs
import { readFileSync, writeFileSync } from "node:fs";

const templates = "supabase/functions/_shared/templates";
const read = (name) => readFileSync(`${templates}/${name}`, "utf8");

// Backtick-safe: these are emitted as template literals.
const lit = (value) => "`" + value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";

const out = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node tools/build-deck-assets.mjs
// Source of truth: supabase/functions/_shared/templates/
/* eslint-disable */

export const DECK_SKELETON = ${lit(read("deck-skeleton.html"))};

export const DECK_STYLE = ${lit(read("deck-style.css"))};

export const DECK_SCRIPT = ${lit(read("deck-script.js"))};
`;

writeFileSync("supabase/functions/course-generation-worker/deck-assets.ts", out);
console.log("deck-assets.ts written");
