import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_RELEASE_FUNCTION = "course-release-management";

export async function loadReleases(filters = {}) {
  return callReleaseFunction({
    action: "list",
    section_id: filters.sectionId,
    session_id: filters.sessionId
  });
}

export async function updateReleaseState({ releaseId, nextState, reason }) {
  return callReleaseFunction({
    action: "update_state",
    release_id: releaseId,
    next_state: nextState,
    reason
  });
}

async function callReleaseFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to manage releases.");

  const config = platformConfig();
  const functionName = config.releaseManagementFunction || DEFAULT_RELEASE_FUNCTION;
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
    throw new Error(payload.error || "Unable to manage releases.");
  }
  return payload;
}
