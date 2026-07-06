import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_ACTIVITY_FUNCTION = "course-activity-attempt";

export async function startActivityAttempt(activityInstanceId) {
  return callActivityFunction({
    action: "start_attempt",
    activity_instance_id: activityInstanceId
  });
}

export async function submitActivityAttempt({ attemptId, responses }) {
  return callActivityFunction({
    action: "submit_attempt",
    attempt_id: attemptId,
    responses
  });
}

async function callActivityFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in before starting an activity.");

  const config = platformConfig();
  const functionName = config.activityAttemptFunction || DEFAULT_ACTIVITY_FUNCTION;
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to process activity attempt.");
  }
  return payload;
}
