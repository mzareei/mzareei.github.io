import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_PROGRESS_FUNCTION = "course-student-progress";

export async function loadStudentProgress() {
  const session = await getSession();
  if (!session) throw new Error("Sign in to see your progress.");

  const config = platformConfig();
  const functionName = config.studentProgressFunction || DEFAULT_PROGRESS_FUNCTION;
  const response = await fetch(`${config.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      course_id: config.courseId || "tc2007b"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load your progress.");
  }
  return payload;
}
