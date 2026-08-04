const readActions = new Set(["controller_current", "projector_current"]);
const controlActions = new Set(["request_slide", "set_phase"]);
const telemetryActions = new Set(["acknowledge_slide", "checkpoint_reached", "heartbeat"]);

export function actionKind(action) {
  if (readActions.has(action)) return "read";
  if (controlActions.has(action)) return "control";
  if (telemetryActions.has(action)) return "telemetry";
  return "unknown";
}

export function actorMayPerform({ action, roles, assignments, sectionId }) {
  const kind = actionKind(action);
  if (kind === "unknown") return false;
  if (roles.includes("platform_owner")) return true;
  if (kind === "control") {
    return roles.includes("instructor") && assignments.some((assignment) =>
      assignment.section_id === sectionId && assignment.role === "instructor"
    );
  }
  return assignments.some((assignment) =>
    assignment.section_id === sectionId
    && ((roles.includes("instructor") && assignment.role === "instructor")
      || (roles.includes("teaching_assistant") && assignment.role === "teaching_assistant"))
  );
}

export function checkpointReportDecision(input) {
  if (input.reportedRevision !== input.currentRevision) return "noop";
  if (!input.authored || !input.checkpointKey) return "reject";
  if (input.requestedSlide !== input.checkpointAfterSlide) return "reject";
  if (input.acknowledgedSlide !== input.checkpointAfterSlide) return "reject";
  return "accept";
}

export function authorizePresentationRequest(input) {
  const allowed = actorMayPerform(input);
  return {
    allowed,
    checkpoint: allowed && input.checkpoint
      ? checkpointReportDecision(input.checkpoint)
      : "not_applicable"
  };
}

export function nextControlState(current, command) {
  return {
    ...current,
    revision: current.revision + 1,
    requested_slide: command.requested_slide ?? current.requested_slide,
    phase: command.phase ?? current.phase,
    checkpoint_key: null,
    checkpoint_after_slide: null
  };
}

export function presentationErrorResponse(message) {
  if (/invalid or expired session|no active course profile|signed-in email must match/i.test(message)) {
    return { status: 401, message: "Invalid or expired session." };
  }
  if (/institutional email domain is not approved|not allowed|not assigned|required role/i.test(message)) {
    return { status: 403, message };
  }
  if (/valid |required|not found|revision|checkpoint|presentation phase/i.test(message)) {
    return { status: 400, message };
  }
  return { status: 500, message: "Unable to synchronize the presentation." };
}
