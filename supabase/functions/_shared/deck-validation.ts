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
// platform's own forbidden list). It matches quoted/unquoted href/src/srcset/
// poster/action/formaction/data attributes and CSS url()/@import.
//
// What this is NOT: a general inline-script or exfiltration sandbox. It does
// not parse or sanitize inline <script>/<style> bodies, and it cannot stop
// content from doing anything client-side that doesn't require a declared
// reference (e.g. a `fetch()` call built from string concatenation at
// runtime). The actual runtime control for that class of risk is the
// `/content` route's CSP — this function's job is narrower: the specific,
// already-happened failure mode described above, where a deck ships with a
// literal reference to somewhere it shouldn't. Inline <script> BODIES (the
// JS text between the tags, as opposed to a <script src="..."> attribute,
// which is still scanned) are excluded from reference scanning entirely —
// see references()'s comment for why.
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
 *  `undeclared_host` is deliberately NOT blocking. It began as belt-and-braces
 *  around the failure this file exists for — pitfall #57, decks linking to the
 *  public copy of their own lecture — but that specific failure is caught by
 *  `forbidden_host` on its own, from the platform's own list, with nothing
 *  required of the professor. Extending it to "every host you did not type
 *  into a box first" made ordinary teaching links fail: a lecture pointing
 *  students at a password-strength checker was refused outright, with the
 *  professor asked to declare a host they had no reason to expect to declare.
 *
 *  The runtime is what actually contains an outbound reference, and it already
 *  does. /content serves decks under `default-src 'none'; img-src data: blob:`,
 *  so nothing external can load into the page at all: a stylesheet, font,
 *  script or remote image simply never arrives, whatever this function says. A
 *  plain link is navigation, not a subresource — the student clicks it and
 *  leaves, which is the entire point of putting it on the slide.
 *
 *  So the honest split is: refuse what makes the deck broken or lets a student
 *  slip back to the ungated public copy, and merely report where else it
 *  points. `relative` stays blocking because such a reference 404s behind the
 *  gate; `no_title` because the item cannot be named; `forbidden_host` because
 *  that is the original incident. */
const BLOCKING_KINDS: ReadonlySet<DeckProblem["kind"]> = new Set([
  "relative", "forbidden_host", "no_title"
]);

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

/** Every reference the document can make to somewhere else: quoted or
 *  unquoted href/src/srcset/poster/action/formaction/data attributes, plus
 *  CSS url(...) and @import (inline <style> blocks and style= attributes).
 *
 *  Inline <script> BODIES are stripped before any of this runs — the
 *  attribute regex below has no notion of HTML structure, so without this
 *  it also matches ordinary JS inside a <script> block (`let src = ...`,
 *  `const data = ...`, `el.dataset.action = ...`) and misreads a variable
 *  name as an outbound reference. Imported decks are expected to be
 *  self-contained HTML with inline JS — that's the whole point of
 *  "self-contained" — so a meaningful script is likely to use one of these
 *  ordinary names and would otherwise get rejected with a confusing error.
 *  Only the BODY is stripped, not the tag: `<script src="...">` is still
 *  scanned, since that attribute is a real external reference. <style>
 *  blocks are never stripped — they still need scanning for url()/@import. */
function references(html: string): string[] {
  const withoutScriptBodies = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2");

  const singleValued = [...withoutScriptBodies.matchAll(
    /(?:href|src|poster|action|formaction|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  )].map((match) => String(match[1] ?? match[2] ?? match[3] ?? "").trim());

  // srcset can carry multiple comma-separated candidates, each optionally
  // followed by a width/density descriptor (" 1x", " 480w") — every
  // candidate's own URL needs checking, not just the first.
  const srcsetValues = [...withoutScriptBodies.matchAll(
    /srcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  )].map((match) => String(match[1] ?? match[2] ?? match[3] ?? "").trim());
  const srcsetUrls = srcsetValues.flatMap((value) =>
    value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean)
  );

  const cssUrls = [...withoutScriptBodies.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((match) => match[2].trim());
  const cssImports = [...withoutScriptBodies.matchAll(/@import\s+(?:url\()?['"]([^'")]+)['"]\)?/gi)].map((match) => match[1].trim());
  return [...singleValued, ...srcsetUrls, ...cssUrls, ...cssImports].filter(Boolean);
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
  if (!/<title>[^<]+<\/title>/i.test(withoutComments)) problems.push({ kind: "no_title" });

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
