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
  const keyByBoundary = new Map<number, string>();
  return mappings.map((mapping) => {
    const boundary = Number(mapping.checkpoint_after_slide);
    const supplied = String(mapping.segment_key || "").trim();
    const canonical =
      keyByBoundary.get(boundary)
      || supplied
      || `checkpoint-${boundary}`;
    keyByBoundary.set(boundary, canonical);
    return { ...mapping, segment_key: canonical };
  });
}
