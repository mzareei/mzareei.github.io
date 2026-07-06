import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_CONTENT_LIBRARY_FUNCTION = "course-content-library";

export async function loadContentLibrary() {
  return callContentLibraryFunction({
    action: "list_content_items"
  });
}

export async function saveContentItem({ contentItem, release }) {
  return callContentLibraryFunction({
    action: "save_content_item",
    content_item: contentItem,
    release
  });
}

async function callContentLibraryFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to manage the content library.");

  const config = platformConfig();
  const functionName = config.contentLibraryFunction || DEFAULT_CONTENT_LIBRARY_FUNCTION;
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
    throw new Error(payload.error || "Unable to manage the content library.");
  }
  return payload;
}
