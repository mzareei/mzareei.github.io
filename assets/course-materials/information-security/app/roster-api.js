import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_ROSTER_FUNCTION = "course-roster-management";

export async function listRoster() {
  return callRosterFunction({
    action: "list_roster"
  });
}

export async function previewRoster({ rows, allowedDomains }) {
  return callRosterFunction({
    action: "preview_roster",
    rows,
    allowed_domains: allowedDomains
  });
}

export async function applyRoster({ rows, allowedDomains, sourceFilename }) {
  return callRosterFunction({
    action: "apply_roster",
    rows,
    allowed_domains: allowedDomains,
    source_filename: sourceFilename
  });
}

export async function correctRosterProfile({ profileId, institutionalEmail, fullName, studentIdentifier, status, reason }) {
  return callRosterFunction({
    action: "correct_roster_profile",
    profile_id: profileId,
    institutional_email: institutionalEmail,
    full_name: fullName,
    student_identifier: studentIdentifier,
    status,
    reason
  });
}

export async function mergeRosterProfile({ sourceProfileId, targetProfileId, reason }) {
  return callRosterFunction({
    action: "merge_roster_profile",
    source_profile_id: sourceProfileId,
    target_profile_id: targetProfileId,
    reason
  });
}

async function callRosterFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to manage the roster.");

  const config = platformConfig();
  const functionName = config.rosterManagementFunction || DEFAULT_ROSTER_FUNCTION;
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
    throw new Error(payload.error || "Unable to manage roster.");
  }
  return payload;
}
