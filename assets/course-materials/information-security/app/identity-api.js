import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_IDENTITY_CONFIRMATION_FUNCTION = "course-identity-confirmation";

export async function loadIdentityConfirmation() {
  return callIdentityFunction({
    action: "list_identity_confirmation"
  });
}

export async function confirmIdentity() {
  return callIdentityFunction({
    action: "confirm_identity"
  });
}

export async function reportIdentityIssue(issueNote) {
  return callIdentityFunction({
    action: "report_identity_issue",
    issue_note: issueNote
  });
}

async function callIdentityFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to confirm your identity.");

  const config = platformConfig();
  const functionName = config.identityConfirmationFunction || DEFAULT_IDENTITY_CONFIRMATION_FUNCTION;
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
    throw new Error(payload.error || "Unable to confirm your identity.");
  }
  return payload;
}
