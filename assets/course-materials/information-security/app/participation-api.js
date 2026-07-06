import { getSession, platformConfig } from "./auth-api.js";

const DEFAULT_PARTICIPATION_FUNCTION = "course-participation-events";

export async function loadParticipationContext(filters = {}) {
  return callParticipationFunction({
    action: "list_participation_context",
    section_id: filters.sectionId
  });
}

export async function recordParticipationEvent(event) {
  return callParticipationFunction({
    action: "record_participation_event",
    section_id: event.sectionId,
    class_session_id: event.classSessionId,
    profile_id: event.profileId,
    event_type: event.event_type,
    points: event.points,
    note: event.note
  });
}

async function callParticipationFunction(body) {
  const session = await getSession();
  if (!session) throw new Error("Sign in as a teacher to record participation.");

  const config = platformConfig();
  const functionName = config.participationEventsFunction || DEFAULT_PARTICIPATION_FUNCTION;
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
    throw new Error(payload.error || "Unable to record participation.");
  }
  return payload;
}
