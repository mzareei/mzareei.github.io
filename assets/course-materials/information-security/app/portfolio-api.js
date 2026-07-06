import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_PORTFOLIO_FUNCTION = "course-portfolio-entry";

export async function loadPortfolioEntries() {
  return callPortfolioFunction({
    action: "list_entries"
  });
}

export async function submitPortfolioEntry(entry) {
  return callPortfolioFunction({
    action: "submit_entry",
    ...entry
  });
}

export async function exportPortfolioEntries() {
  return callPortfolioFunction({
    action: "export_entries"
  });
}

async function callPortfolioFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to manage your portfolio.");

  const config = platformConfig();
  const functionName = config.portfolioEntryFunction || DEFAULT_PORTFOLIO_FUNCTION;
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
    throw new Error(payload.error || "Unable to update portfolio entries.");
  }
  return payload;
}
