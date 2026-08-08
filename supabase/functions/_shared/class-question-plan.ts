export function validateCheckpointDraft(input: Record<string, unknown>) {
  const topic = String(input.topic || "").trim().slice(0, 160);
  const slideHint = input.slide_hint == null || input.slide_hint === ""
    ? null : Number(input.slide_hint);
  if (!topic) throw new Error("class_question_plan_topic_required");
  if (slideHint !== null && (!Number.isInteger(slideHint) || slideHint < 1)) {
    throw new Error("class_question_plan_slide_hint_invalid");
  }
  return { topic, slideHint, notes: String(input.notes || "").trim().slice(0, 1000) || null };
}

export function assertMutableCheckpoint(state: string, sentRoundCount: number) {
  if (state !== "planned" || sentRoundCount > 0) {
    throw new Error("class_question_plan_checkpoint_locked");
  }
}
