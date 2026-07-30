export type DeckCheckpoint = {
  key: string;
  after_slide: number;
  segment_key: string;
  source_slide_start: number;
  source_slide_end: number;
};

type CheckpointQuestionRow = {
  segment_key?: unknown;
  checkpoint_after_slide?: unknown;
  source_slide_start?: unknown;
  source_slide_end?: unknown;
};

function positiveInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

/**
 * Collapse candidate questions into the checkpoint sections used by the deck.
 * Output order depends only on finalized slide position and segment key, never
 * on model response order.
 */
export function deckCheckpointsFromQuestions(
  questions: CheckpointQuestionRow[]
): DeckCheckpoint[] {
  const grouped = new Map<string, DeckCheckpoint>();

  for (const question of questions) {
    const segmentKey = String(question.segment_key || "").trim();
    if (!segmentKey) throw new Error("A checkpoint segment key is required.");

    const afterSlide = positiveInteger(
      question.checkpoint_after_slide,
      "The checkpoint teaching slide"
    );
    const sourceStart = positiveInteger(
      question.source_slide_start,
      "The checkpoint source start"
    );
    const sourceEnd = positiveInteger(
      question.source_slide_end,
      "The checkpoint source end"
    );
    if (sourceEnd < sourceStart || sourceEnd > afterSlide) {
      throw new Error("A checkpoint source range must end at or before its teaching slide.");
    }

    const groupKey = `${afterSlide}\u0000${segmentKey}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.source_slide_start = Math.min(existing.source_slide_start, sourceStart);
      existing.source_slide_end = Math.max(existing.source_slide_end, sourceEnd);
    } else {
      grouped.set(groupKey, {
        key: segmentKey,
        after_slide: afterSlide,
        segment_key: segmentKey,
        source_slide_start: sourceStart,
        source_slide_end: sourceEnd
      });
    }
  }

  const checkpoints = [...grouped.values()].sort((a, b) =>
    a.after_slide - b.after_slide || a.segment_key.localeCompare(b.segment_key)
  );
  const segmentCounts = new Map<string, number>();
  for (const checkpoint of checkpoints) {
    segmentCounts.set(
      checkpoint.segment_key,
      (segmentCounts.get(checkpoint.segment_key) || 0) + 1
    );
  }

  const usedKeys = new Set<string>();
  return checkpoints.map((checkpoint) => {
    const repeatedSegment = (segmentCounts.get(checkpoint.segment_key) || 0) > 1;
    const baseKey = repeatedSegment
      ? `${checkpoint.segment_key}-${checkpoint.after_slide}`
      : checkpoint.segment_key;
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);
    return { ...checkpoint, key };
  });
}

function escapeAttribute(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, () => "&amp;")
    .replace(/"/g, () => "&quot;")
    .replace(/</g, () => "&lt;")
    .replace(/>/g, () => "&gt;");
}

export function renderCheckpointSection(checkpoint: DeckCheckpoint): string {
  return (
    `  <section class="slide checkpoint-slide"` +
    ` data-checkpoint-key="${escapeAttribute(checkpoint.key)}"` +
    ` data-after-slide="${checkpoint.after_slide}"` +
    ` data-source-start="${checkpoint.source_slide_start}"` +
    ` data-source-end="${checkpoint.source_slide_end}"` +
    ` data-section="Quick check" data-section-es="Repaso rápido">\n` +
    `    <div class="slide-inner checkpoint-inner">\n` +
    `      <span class="kicker" data-es="Repaso rápido">Quick check</span>\n` +
    `      <h1 data-es="Pregunta lista">Question ready</h1>\n` +
    `      <div class="checkpoint-slot" aria-live="polite"></div>\n` +
    `    </div>\n` +
    `  </section>\n`
  );
}

const sectionPattern = /<section\b[^>]*>[\s\S]*?<\/section\s*>/gi;
const stylePattern = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
const scriptPattern = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a\s*>/gi;

type LegacyCheckpoint = {
  key: string;
  afterSlide: number;
  sourceStart: number;
  sourceEnd: number;
};

type DeckAssets = {
  style: string;
  script: string;
};

function openingTag(section: string): string {
  return section.match(/^<section\b[^>]*>/i)?.[0] || "";
}

function attributeValue(tag: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, (character) => `\\${character}`);
  const match = tag.match(
    new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  );
  return match ? String(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function classNames(tag: string): string[] {
  return attributeValue(tag, "class").split(/\s+/).filter(Boolean);
}

function isTeachingSection(section: string): boolean {
  const classes = classNames(openingTag(section));
  return classes.includes("slide") && !classes.includes("checkpoint-slide");
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const hexadecimal = body[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(body.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return entity;
    }
    return named[body.toLowerCase()] ?? entity;
  });
}

function visibleSlideText(section: string): string {
  const text = section
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, () => " ")
    .replace(/<br\s*\/?>/gi, () => " ")
    .replace(/<\/(?:div|h[1-6]|li|ol|p|table|td|th|tr|ul)\s*>/gi, () => " ")
    .replace(/<[^>]+>/g, () => " ");
  return decodeHtmlEntities(text)
    .replace(/\s+/g, () => " ")
    .replace(/\s+([,.;:!?])/g, (_match, punctuation: string) => punctuation)
    .trim();
}

/**
 * Read the stable, one-based teaching coordinate system from a legacy deck.
 * Checkpoint sections are deliberately excluded from the count.
 */
export function extractTeachingSlides(html: string): Array<{
  number: number;
  text: string;
}> {
  const slides: Array<{ number: number; text: string }> = [];
  for (const match of html.matchAll(sectionPattern)) {
    const section = match[0];
    if (!isTeachingSection(section)) continue;
    slides.push({
      number: slides.length + 1,
      text: visibleSlideText(section)
    });
  }
  return slides;
}

function validateLegacyCheckpoints(
  checkpoints: LegacyCheckpoint[],
  teachingSlideCount: number
): LegacyCheckpoint[] {
  const seenKeys = new Set<string>();
  return [...checkpoints]
    .sort((a, b) => a.afterSlide - b.afterSlide || a.key.localeCompare(b.key))
    .map((checkpoint) => {
      const key = String(checkpoint.key || "").trim();
      if (!key) throw new Error("A checkpoint key is required.");
      if (seenKeys.has(key)) throw new Error(`Checkpoint key "${key}" is duplicated.`);
      seenKeys.add(key);

      for (const [label, value] of [
        ["after slide", checkpoint.afterSlide],
        ["source start", checkpoint.sourceStart],
        ["source end", checkpoint.sourceEnd]
      ] as const) {
        if (!Number.isInteger(value) || value < 1) {
          throw new Error(`The checkpoint ${label} must be a positive integer.`);
        }
      }
      if (checkpoint.sourceEnd < checkpoint.sourceStart) {
        throw new Error("A checkpoint source range must not run backwards.");
      }
      if (checkpoint.sourceEnd > checkpoint.afterSlide) {
        throw new Error("A checkpoint source range must end at or before its teaching slide.");
      }
      if (checkpoint.afterSlide > teachingSlideCount) {
        throw new Error(
          `Checkpoint "${key}" does not match a finalized teaching slide.`
        );
      }
      return {
        key,
        afterSlide: checkpoint.afterSlide,
        sourceStart: checkpoint.sourceStart,
        sourceEnd: checkpoint.sourceEnd
      };
    });
}

/**
 * Add stable teaching-slide coordinates and checkpoint sections without
 * rebuilding or interpreting the lecture's teaching markup.
 */
export function injectCheckpointSections(
  html: string,
  checkpoints: LegacyCheckpoint[]
): string {
  const teachingSlides = extractTeachingSlides(html);
  if (!teachingSlides.length) {
    throw new Error("The legacy deck has no teaching slides.");
  }
  if ([...html.matchAll(sectionPattern)].some((match) =>
    classNames(openingTag(match[0])).includes("checkpoint-slide")
  )) {
    throw new Error("The legacy deck already contains checkpoint sections.");
  }

  const ordered = validateLegacyCheckpoints(checkpoints, teachingSlides.length);
  const bySlide = new Map<number, LegacyCheckpoint[]>();
  for (const checkpoint of ordered) {
    bySlide.set(checkpoint.afterSlide, [
      ...(bySlide.get(checkpoint.afterSlide) || []),
      checkpoint
    ]);
  }

  let teachingSlideNumber = 0;
  const transformed = html.replace(sectionPattern, (section) => {
    if (!isTeachingSection(section)) return section;
    teachingSlideNumber += 1;

    const originalOpeningTag = openingTag(section);
    const unnumberedOpeningTag = originalOpeningTag.replace(
      /\s+data-teaching-slide\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,
      () => ""
    );
    const numberedOpeningTag = unnumberedOpeningTag.replace(
      />$/,
      () => ` data-teaching-slide="${teachingSlideNumber}">`
    );
    const numberedSection = section.replace(
      originalOpeningTag,
      () => numberedOpeningTag
    );
    const following = (bySlide.get(teachingSlideNumber) || [])
      .map((checkpoint) => renderCheckpointSection({
        key: checkpoint.key,
        after_slide: checkpoint.afterSlide,
        segment_key: checkpoint.key,
        source_slide_start: checkpoint.sourceStart,
        source_slide_end: checkpoint.sourceEnd
      }))
      .join("\n");
    return following ? `${numberedSection}\n${following}` : numberedSection;
  });

  if (teachingSlideNumber !== teachingSlides.length) {
    throw new Error("The teaching-slide count changed while checkpoints were inserted.");
  }
  return transformed;
}

function isLegacyDestination(anchor: string): boolean {
  const classes = classNames(anchor.match(/^<a\b[^>]*>/i)?.[0] || "");
  if (!classes.includes("ui-btn")) return false;
  const href = attributeValue(anchor, "href").toLowerCase();
  return (
    /\/teaching\/information-security\/?(?:[?#].*)?$/.test(href)
    || /\/mission-(?:\d+|bridge)\/?(?:[?#].*)?$/.test(href)
    || /(?:^|\/)quiz\/teacher\.html(?:[?#].*)?$/.test(href)
    || /\/exit-ticket\/?(?:[?#].*)?$/.test(href)
  );
}

/** Remove only the four obsolete top-control destinations from old decks. */
export function removeLegacyDeckNavigation(html: string): string {
  return html.replace(anchorPattern, (anchor) =>
    isLegacyDestination(anchor) ? "" : anchor
  );
}

function escapedStyle(style: string): string {
  return style.replace(/<\/style/gi, () => "<\\/style");
}

function escapedScript(script: string): string {
  return script.replace(/<\/script/gi, () => "<\\/script");
}

/**
 * Replace the inlined legacy engine assets while preserving lecture-specific
 * inline styles and scripts. Callback replacements keep `$&`, `$1`, `$`` and
 * `$'` in CSS/JavaScript literal instead of treating them as replacement tokens.
 */
export function replaceLegacyDeckAssets(html: string, assets: DeckAssets): string {
  if (!String(assets.style || "").trim() || !String(assets.script || "").trim()) {
    throw new Error("Current deck style and script assets are required.");
  }

  let styleReplaced = false;
  let transformed = html.replace(stylePattern, (styleBlock) => {
    if (
      styleReplaced
      || !/TC2007B\s+—\s+Lecture deck theme\s+\(shared design; copy per lecture\)/.test(styleBlock)
    ) {
      return styleBlock;
    }
    styleReplaced = true;
    return `<style data-course-deck-engine="current">\n${escapedStyle(assets.style)}\n</style>`;
  });
  if (!styleReplaced) {
    transformed = transformed.replace(/<link\b[^>]*>/gi, (link) => {
      if (styleReplaced || !/(?:^|\/)style\.css(?:[?#].*)?$/i.test(attributeValue(link, "href"))) {
        return link;
      }
      styleReplaced = true;
      return `<style data-course-deck-engine="current">\n${escapedStyle(assets.style)}\n</style>`;
    });
  }

  let scriptReplaced = false;
  transformed = transformed.replace(scriptPattern, (scriptBlock) => {
    if (
      scriptReplaced
      || !/TC2007B\s*-\s*W1\s*-\s*L1\s*-\s*Presenter engine/.test(scriptBlock)
    ) {
      return scriptBlock;
    }
    scriptReplaced = true;
    return `<script data-course-deck-engine="current">\n${escapedScript(assets.script)}\n</script>`;
  });
  if (!scriptReplaced) {
    transformed = transformed.replace(
      /<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>\s*<\/script\s*>/gi,
      (scriptBlock) => {
        if (
          scriptReplaced
          || !/(?:^|\/)script\.js(?:[?#].*)?$/i.test(attributeValue(scriptBlock, "src"))
        ) {
          return scriptBlock;
        }
        scriptReplaced = true;
        return `<script data-course-deck-engine="current">\n${escapedScript(assets.script)}\n</script>`;
      }
    );
  }

  if (!styleReplaced || !scriptReplaced) {
    throw new Error("The legacy deck engine assets could not be identified safely.");
  }
  return transformed;
}

export function prepareLegacyDeckHtml(
  html: string,
  checkpoints: LegacyCheckpoint[],
  assets: DeckAssets
): string {
  const teachingSlides = extractTeachingSlides(html);
  const transformed = replaceLegacyDeckAssets(
    injectCheckpointSections(removeLegacyDeckNavigation(html), checkpoints),
    assets
  );
  const transformedSlides = extractTeachingSlides(transformed);
  if (
    transformedSlides.length !== teachingSlides.length
    || transformedSlides.some((slide, index) =>
      slide.number !== teachingSlides[index].number
      || slide.text !== teachingSlides[index].text
    )
  ) {
    throw new Error("The teaching-slide count or order changed during checkpoint preparation.");
  }
  return transformed;
}
