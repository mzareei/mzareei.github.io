type RawCheckpointMapping = {
  checkpoint_after_slide: unknown;
  segment_key: unknown;
  [key: string]: unknown;
};

/**
 * Model-authored concept labels are descriptive, not structural identity.
 * Questions placed at the same authored boundary must form one checkpoint
 * candidate pool even when the model supplies different concept labels.
 */
export function coalesceSegmentKeysByCheckpoint<T extends RawCheckpointMapping>(
  mappings: T[]
): T[] {
  const boundaries = Array.from(
    new Set(
      mappings
        .map((mapping) => Number(mapping.checkpoint_after_slide))
        .filter((boundary) => Number.isInteger(boundary) && boundary > 0)
    )
  ).sort((a, b) => a - b);
  const mergedBoundary = new Map<number, number>();
  while (boundaries.length > 5) {
    let mergeIndex = 0;
    let smallestGap = Number.POSITIVE_INFINITY;
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const gap = boundaries[index + 1] - boundaries[index];
      if (gap < smallestGap) {
        smallestGap = gap;
        mergeIndex = index;
      }
    }
    const earlier = boundaries[mergeIndex];
    const later = boundaries[mergeIndex + 1];
    mergedBoundary.set(earlier, later);
    boundaries.splice(mergeIndex, 1);
  }

  const keyByBoundary = new Map<number, string>();
  return mappings.map((mapping) => {
    const suppliedBoundary = Number(mapping.checkpoint_after_slide);
    let boundary = suppliedBoundary;
    while (mergedBoundary.has(boundary)) {
      boundary = mergedBoundary.get(boundary)!;
    }
    const supplied = String(mapping.segment_key || "").trim();
    const canonical =
      keyByBoundary.get(boundary)
      || supplied
      || `checkpoint-${boundary}`;
    keyByBoundary.set(boundary, canonical);
    return {
      ...mapping,
      checkpoint_after_slide: boundary,
      segment_key: canonical
    };
  });
}
