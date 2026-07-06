import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_EXIT_TICKET_FUNCTION = "course-exit-ticket";

export async function loadMyExitTickets() {
  return callExitTicketFunction({
    action: "list_my_tickets"
  });
}

export async function submitExitTicket(payload) {
  return callExitTicketFunction({
    action: "submit_ticket",
    ...payload
  });
}

async function callExitTicketFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in before submitting an exit ticket.");

  const config = platformConfig();
  const functionName = config.exitTicketFunction || DEFAULT_EXIT_TICKET_FUNCTION;
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
    throw new Error(payload.error || "Unable to save exit ticket.");
  }
  return payload;
}
