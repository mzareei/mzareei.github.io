// The outbound-link gate for an uploaded deck.
//
// A gate is only as good as the links inside what it serves. Phase 2 rewrote
// every relative link to an absolute public URL, and nine of twelve missions
// ended up linking to the public copy of their own lecture — a student inside
// /content?t=… was one click outside it. Nobody noticed for months, because
// nothing errors: the links simply work, and take the student somewhere they
// should not be able to reach. See pitfall #57.
//
// What this validates: self-containment (no surviving relative reference,
// which would 404 behind the gate) and declared outbound links (any host a
// reference points to must be in the deck's own declared allow-list, or the
// platform's own forbidden list).
//
// It reads the deck as a document, not as a wall of text. Only attributes of
// real tags count, matched by their whole name, plus CSS the page actually
// applies (<style> bodies and style= attributes). That distinction is the
// whole difficulty: a lecture deck is FULL of text that looks like a
// reference and is not one. A security deck shows `<img src=x onerror=...>`
// on a slide, escaped; a highlighted code sample puts `href=<span class=...>`
// in the text; a firewall table tags its rows `data-action="allow"`. An
// earlier version regexed the raw file end to end and refused all three,
// naming a "file" the professor never wrote — see verify-deck-outbound-links.
//
// Two things are deliberately NOT scanned, because they never load: HTML
// comments, and inline <script> BODIES (the JS text between the tags, as
// opposed to a <script src="..."> attribute, which is scanned). Self-contained
// decks carry inline JS by definition, and `let src = ...` is a variable, not
// a reference. One thing IS scanned that looks like it shouldn't be: markup
// stored inside an attribute value, which the bilingual decks use to hold a
// whole translated element in data-es and swap into the page. Its links are
// real links.
//
// What this is NOT: a general inline-script or exfiltration sandbox. It does
// not parse or sanitize inline <script>/<style> bodies, and it cannot stop
// content from doing anything client-side that doesn't require a declared
// reference (e.g. a `fetch()` call built from string concatenation at
// runtime). The actual runtime control for that class of risk is the
// `/content` route's CSP — this function's job is narrower: the specific,
// already-happened failure mode described above, where a deck ships with a
// literal reference to somewhere it shouldn't.
//
// Ported from course-content/lib/validate.mjs, which validates the same
// property for hand-authored material.

export interface DeckProblem {
  kind: "relative" | "forbidden_host" | "undeclared_host" | "no_title";
  reference?: string;
  host?: string;
}

/** Which findings may refuse an upload, and which are only worth mentioning.
 *
 *  Exactly one refuses it: a link to the platform's own public site. That is
 *  pitfall #57, the incident this file was written for — nine of twelve
 *  missions linked to the public copy of their own lecture, so a student
 *  inside /content?t=… was one click outside it, and nothing errored. No deck
 *  needs such a link, and a professor cannot see the problem by looking at
 *  the slide, so this one stays a refusal.
 *
 *  Everything else is now a notice, reported after the deck uploads. The
 *  reasoning is the same in each case: the finding describes how the deck will
 *  LOOK, which the professor can see and judge, not what a student can reach.
 *
 *  - `relative` — an asset that was never inlined. It 404s behind the gate, so
 *    that image or stylesheet comes out blank. That is a flaw in one slide,
 *    visible the moment the deck is opened, and it is not worth refusing a
 *    finished lecture over. It also cannot be told apart with certainty from
 *    text that merely resembles a reference, which is how it spent months
 *    refusing decks over `<img src=x onerror=...>` printed on a slide.
 *  - `no_title` — the item still needs a name, but the import derives one and
 *    the endpoint requires a non-empty title of its own. A missing <title> is
 *    not a reason to reject the file.
 *  - `undeclared_host` — an ordinary outbound teaching link. It was already a
 *    notice: blocking it refused a lecture for pointing students at a
 *    password-strength checker.
 *
 *  What keeps this honest is the runtime, not this function. /content serves
 *  decks under `default-src 'none'; img-src data: blob:`, so nothing external
 *  loads into the page whatever is declared here: a stylesheet, font, script
 *  or remote image simply never arrives. A plain link is navigation, not a
 *  subresource — the student clicks it and leaves, which is the entire point
 *  of putting it on the slide, and the one destination that must not be
 *  reachable is the one kind still refused above. */
const BLOCKING_KINDS: ReadonlySet<DeckProblem["kind"]> = new Set(["forbidden_host"]);

export function isBlockingProblem(problem: DeckProblem): boolean {
  return BLOCKING_KINDS.has(problem.kind);
}

/** Splits a validation result into what must stop the upload and what the
 *  professor should simply be told about. */
export function partitionDeckProblems(problems: DeckProblem[]): {
  blocking: DeckProblem[];
  notices: DeckProblem[];
} {
  return {
    blocking: problems.filter(isBlockingProblem),
    notices: problems.filter((problem) => !isBlockingProblem(problem))
  };
}

export interface DeckValidationOptions {
  allowedHosts: string[];
  forbiddenHosts: string[];
}

/** The attributes a browser resolves as a URL, matched by their whole name.
 *  `data-action` is a data attribute, not an action, and `data-src` is a
 *  string the deck's own script reads — neither is fetched. */
const REFERENCE_ATTRIBUTES: ReadonlySet<string> = new Set([
  "href", "xlink:href", "src", "srcset", "poster", "action", "formaction", "data"
]);

const ATTRIBUTE = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

/** The document's tags, found by structure rather than by resemblance.
 *
 *  Hand-written rather than one regex on purpose. A quoted attribute value is
 *  consumed whole, so a `>` inside one does not end the tag — the bilingual
 *  decks store entire elements in data-es and a tag pattern that stopped at
 *  the first `>` would cut them in half. And an escaped `&lt;img src=x&gt;` on
 *  a slide never starts a tag here, which is the point: it is text a student
 *  reads, not a file the browser asks for. Every character is visited once. */
function* tags(html: string): Generator<{ attributes: string }> {
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open < 0) return;
    const name = /^[a-z][a-z\d:-]*/i.exec(html.slice(open + 1, open + 40));
    if (!name) { index = open + 1; continue; } // Text, a comment, or a closing tag.

    let cursor = open + 1 + name[0].length;
    let quote = "";
    while (cursor < html.length) {
      const char = html[cursor];
      if (quote) { if (char === quote) quote = ""; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
      cursor++;
    }
    if (cursor >= html.length) return; // Unterminated tag: nothing left to read.
    yield { attributes: html.slice(open + 1 + name[0].length, cursor) };
    index = cursor + 1;
  }
}

/** url(...) and @import in CSS the page applies — never in CSS quoted on a
 *  slide, which is why the caller decides what text reaches this. */
function cssReferences(css: string): string[] {
  return [
    ...[...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((match) => match[2]),
    ...[...css.matchAll(/@import\s+(?:url\()?['"]([^'")]+)['"]\)?/gi)].map((match) => match[1])
  ];
}

/** Every reference the document can make to somewhere else.
 *
 *  `depth` guards the one recursive case: an attribute value holding real
 *  markup (the bilingual data-es pattern). One level down is all any deck
 *  uses, and it stops a pathological value from recursing without end. */
function references(html: string, depth = 0): string[] {
  const scannable = depth === 0
    ? html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2")
    : html;

  const found: string[] = [];
  for (const [, css] of scannable.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    found.push(...cssReferences(css));
  }

  for (const tag of tags(scannable)) {
    for (const [, rawName, quoted, singleQuoted, bare] of tag.attributes.matchAll(ATTRIBUTE)) {
      const name = rawName.toLowerCase();
      const value = String(quoted ?? singleQuoted ?? bare ?? "").trim();
      if (!value) continue;

      if (name === "style") {
        found.push(...cssReferences(value));
      } else if (name === "srcset") {
        // Multiple comma-separated candidates, each optionally followed by a
        // width/density descriptor (" 1x", " 480w"). Every candidate's own URL
        // needs checking, not just the first.
        found.push(...value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]));
      } else if (REFERENCE_ATTRIBUTES.has(name)) {
        found.push(value);
      } else if (depth < 1 && value.includes("<")) {
        found.push(...references(value, depth + 1));
      }
    }
  }
  return found.map((reference) => reference.trim()).filter(Boolean);
}

function hostOf(reference: string): string | null {
  if (/^(?:data|mailto|tel):/i.test(reference)) return null;
  if (reference.startsWith("#")) return null;
  if (!/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(reference)) return "";
  try {
    return new URL(reference, "https://placeholder.invalid/").hostname.toLowerCase();
  } catch {
    return "invalid";
  }
}

export function validateDeckHtml(
  html: string, options: DeckValidationOptions
): DeckProblem[] {
  const problems: DeckProblem[] = [];
  // Strip HTML comments first: an actual <title> must render, not just sit
  // in a comment (e.g. <!-- <title>Deck</title> --> with no real title).
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  // [^>]* on the open tag: <title lang="en"> is still a title, and the client
  // names the item from exactly this element with the same allowance.
  if (!/<title[^>]*>[^<]+<\/title>/i.test(withoutComments)) problems.push({ kind: "no_title" });

  const allowed = new Set(options.allowedHosts.map((host) => host.toLowerCase()));
  const forbidden = new Set(options.forbiddenHosts.map((host) => host.toLowerCase()));

  for (const reference of references(html)) {
    const host = hostOf(reference);
    if (host === null) continue;
    if (host === "invalid") {
      problems.push({ kind: "undeclared_host", reference });
      continue;
    }
    if (host === "") {
      // The published artifact is a single self-contained file. A surviving
      // relative reference is an asset that was never inlined, and it will 404
      // from behind the gate where there is no sibling file to find.
      problems.push({ kind: "relative", reference });
      continue;
    }
    if (forbidden.has(host)) {
      problems.push({ kind: "forbidden_host", reference, host });
      continue;
    }
    if (!allowed.has(host)) {
      problems.push({ kind: "undeclared_host", reference, host });
    }
  }
  return problems;
}
