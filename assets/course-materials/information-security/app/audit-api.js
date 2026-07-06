import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_AUDIT_FUNCTION = "course-audit-log";

export async function loadAuditEvents(filters = {}) {
  return callAuditFunction({
    action: "list_audit_events",
    target_type: filters.targetType || "",
    audit_action: filters.auditAction || "",
    limit: filters.limit || 100
  });
}

async function callAuditFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to review audit events.");

  const config = platformConfig();
  const functionName = config.auditLogFunction || DEFAULT_AUDIT_FUNCTION;
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
    throw new Error(payload.error || "Unable to load audit events.");
  }
  return payload;
}
