// The outbound-link gate for an uploaded deck.
//
// A gate is only as good as the links inside what it serves. Phase 2 rewrote
// every relative link to an absolute public URL, and nine of twelve missions
// ended up linking to the public copy of their own lecture — a student inside
// /content?t=… was one click outside it. Nobody noticed for months, because
// nothing errors: the links simply work, and take the student somewhere they
// should not be able to reach. See pitfall #57.
//
// Ported from course-content/lib/validate.mjs, which validates the same
// property for hand-authored material.

export interface DeckProblem {
  kind: "relative" | "forbidden_host" | "undeclared_host" | "no_title";
  reference?: string;
  host?: string;
}

export interface DeckValidationOptions {
  allowedHosts: string[];
  forbiddenHosts: string[];
}

/** Every href/src in the document. */
function references(html: string): string[] {
  return [...html.matchAll(/(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => String(match[1] ?? match[2] ?? "").trim())
    .filter(Boolean);
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
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push({ kind: "no_title" });

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
