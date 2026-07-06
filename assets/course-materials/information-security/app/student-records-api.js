import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_STUDENT_RECORDS_FUNCTION = "course-student-records";

export async function loadStudentList() {
  return callStudentRecordsFunction({
    action: "list_students"
  });
}

export async function loadStudentRecord(profileId) {
  return callStudentRecordsFunction({
    action: "student_record",
    profile_id: profileId
  });
}

async function callStudentRecordsFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as a teacher to review student records.");

  const config = platformConfig();
  const functionName = config.studentRecordsFunction || DEFAULT_STUDENT_RECORDS_FUNCTION;
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
    throw new Error(payload.error || "Unable to load student records.");
  }
  return payload;
}
