import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_INSIGHTS_FUNCTION = "course-learning-insights";

export async function loadLearningInsights(filters = {}) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to see learning insights.");

  const config = platformConfig();
  const functionName = config.learningInsightsFunction || DEFAULT_INSIGHTS_FUNCTION;
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      course_id: config.courseId || "tc2007b",
      section_id: filters.sectionId
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load learning insights.");
  }
  return payload;
}
