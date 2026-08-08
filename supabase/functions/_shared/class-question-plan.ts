export function validateCheckpointDraft(input: Record<string, unknown>) {
  const topic = String(input.topic || "").trim().slice(0, 160);
  const slideHint = input.slide_hint == null || input.slide_hint === ""
    ? null : Number(input.slide_hint);
  if (!topic) throw new Error("A checkpoint topic is required.");
  if (slideHint !== null && (!Number.isInteger(slideHint) || slideHint < 1)) {
    throw new Error("The slide hint must be a positive whole number.");
  }
  return { topic, slideHint, notes: String(input.notes || "").trim().slice(0, 1000) || null };
}

export function assertMutableCheckpoint(state: string, sentRoundCount: number) {
  if (state !== "planned" || sentRoundCount > 0) {
    throw new Error("A checkpoint that has been used in class cannot be changed.");
  }
}
