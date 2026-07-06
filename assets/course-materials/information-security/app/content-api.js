import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_CONTENT_FUNCTION = "course-content-access";

export async function loadContentAccess(releaseId) {
  const session = await getSession();
  if (!session) throw new Error("Sign in before opening course content.");

  const config = platformConfig();
  const functionName = config.contentAccessFunction || DEFAULT_CONTENT_FUNCTION;
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "open_content",
      course_id: config.courseId || "tc2007b",
      release_id: releaseId
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Access denied.");
  }
  return payload;
}
