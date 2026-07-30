export type CheckpointPushIdentity = {
  sessionState: unknown;
  sessionContentItemId: unknown;
  bankContentItemId: unknown;
  questionCheckpoint: unknown;
  requestedCheckpoint: unknown;
};

/**
 * The browser may name a bank question, but only the server decides whether it
 * is eligible at this exact moment in this exact lecture.
 */
export function assertCheckpointPushMatches(input: CheckpointPushIdentity) {
  if (String(input.sessionState) !== "live") {
    throw new Error("Start the live class before sending a checkpoint question.");
  }

  const sessionContentItemId = String(input.sessionContentItemId || "");
  const bankContentItemId = String(input.bankContentItemId || "");
  if (
    !sessionContentItemId
    || !bankContentItemId
    || sessionContentItemId !== bankContentItemId
  ) {
    throw new Error("That question does not belong to this class lecture.");
  }

  const questionCheckpoint = Number(input.questionCheckpoint);
  const requestedCheckpoint = Number(input.requestedCheckpoint);
  if (
    !Number.isInteger(questionCheckpoint)
    || !Number.isInteger(requestedCheckpoint)
    || questionCheckpoint < 1
    || requestedCheckpoint < 1
    || questionCheckpoint !== requestedCheckpoint
  ) {
    throw new Error("That question does not belong to this slide checkpoint.");
  }
}
