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
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
