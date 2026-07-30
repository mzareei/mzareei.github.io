export type PulseTransitionAction = "reveal" | "close";

export function allowedPulseSourceStates(
  action: PulseTransitionAction
): string[] {
  return action === "reveal" ? ["open"] : ["open", "revealed"];
}

export function pulseTargetState(action: PulseTransitionAction) {
  return action === "reveal" ? "revealed" : "closed";
}

export function isPulseTransitionIdempotent(
  currentState: unknown,
  action: PulseTransitionAction
) {
  return String(currentState || "") === pulseTargetState(action);
}
