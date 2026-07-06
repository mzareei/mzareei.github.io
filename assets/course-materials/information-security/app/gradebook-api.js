import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_GRADEBOOK_FUNCTION = "course-gradebook-summary";

export async function loadGradebookSummary(filters = {}) {
  return callGradebookFunction({
    action: "summary",
    ...normalizeFilters(filters)
  }, "json");
}

export async function downloadGradebookCsv(filters = {}) {
  const csvText = await callGradebookFunction({
    action: "export_csv",
    ...normalizeFilters(filters)
  }, "text");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tc2007b-gradebook-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function adjustGradebookScore({ scoreId, newScoreFinal, reason }) {
  return callGradebookFunction({
    action: "adjust_score",
    score_id: scoreId,
    new_score_final: newScoreFinal,
    reason
  }, "json");
}

export async function lockGradebookScore({ scoreId, reason }) {
  return callGradebookFunction({
    action: "lock_score",
    score_id: scoreId,
    reason
  }, "json");
}

export async function saveGradebookCategory({ categoryId, name, weightPercent, dropLowestCount, status }) {
  return callGradebookFunction({
    action: "save_category",
    category_id: categoryId || "",
    name,
    weight_percent: weightPercent,
    drop_lowest_count: dropLowestCount,
    status
  }, "json");
}

export async function setGradebookScoreStatus({ gradebookItemId, profileId, sectionId, scoreStatus, scoreFinal, reason }) {
  return callGradebookFunction({
    action: "set_score_status",
    gradebook_item_id: gradebookItemId,
    profile_id: profileId,
    section_id: sectionId,
    score_status: scoreStatus,
    score_final: scoreFinal,
    reason
  }, "json");
}

async function callGradebookFunction(body, responseType) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as an instructor to review grades.");

  const config = platformConfig();
  const functionName = config.gradebookSummaryFunction || DEFAULT_GRADEBOOK_FUNCTION;
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

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Unable to load gradebook.");
  }
  return responseType === "text" ? response.text() : response.json();
}

function normalizeFilters(filters) {
  return {
    section_id: filters.section_id || "",
    category_id: filters.category_id || "",
    gradebook_item_id: filters.gradebook_item_id || ""
  };
}
