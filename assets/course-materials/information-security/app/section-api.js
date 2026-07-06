import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_SECTION_FUNCTION = "course-section-management";

export async function loadCourseSections() {
  return callSectionFunction({
    action: "list_sections"
  });
}

export async function saveCourseSection(section) {
  return callSectionFunction({
    action: "save_section",
    section_id: section.sectionId || "",
    section_code: section.sectionCode,
    section_name: section.sectionName,
    meeting_pattern: section.meetingPattern || "",
    campus: section.campus || "",
    status: section.status
  });
}

async function callSectionFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to manage course sections.");

  const config = platformConfig();
  const functionName = config.sectionManagementFunction || DEFAULT_SECTION_FUNCTION;
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
    throw new Error(payload.error || "Unable to manage course sections.");
  }
  return payload;
}
