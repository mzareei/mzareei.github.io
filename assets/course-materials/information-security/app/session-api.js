import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_SESSION_FUNCTION = "course-session-management";

export async function loadSessions(filters = {}) {
  return callSessionFunction({
    action: "list_sessions",
    section_id: filters.sectionId,
    session_id: filters.sessionId
  });
}

export async function updateSessionState({ sessionId, nextState, reason }) {
  return callSessionFunction({
    action: "update_session_state",
    session_id: sessionId,
    next_state: nextState,
    reason
  });
}

export async function continueSession({ sourceSessionId, plannedDate, title, teacherNotes, movedReleaseIds }) {
  return callSessionFunction({
    action: "continue_session",
    source_session_id: sourceSessionId,
    planned_date: plannedDate,
    title,
    teacher_notes: teacherNotes,
    moved_release_ids: movedReleaseIds
  });
}

export async function updateActivityState({ activityInstanceId, nextState }) {
  return callSessionFunction({
    action: "update_activity_state",
    activity_instance_id: activityInstanceId,
    next_state: nextState
  });
}

export async function extendActivityWindow({ activityInstanceId, minutes }) {
  return callSessionFunction({
    action: "extend_activity_window",
    activity_instance_id: activityInstanceId,
    minutes
  });
}

async function callSessionFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to manage class sessions.");

  const config = platformConfig();
  const functionName = config.sessionManagementFunction || DEFAULT_SESSION_FUNCTION;
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      course_id: config.courseId || "tc2007b",
      ...body
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to manage class sessions.");
  }
  return payload;
}
