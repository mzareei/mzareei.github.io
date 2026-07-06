import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

const defaultCourseId = "tc2007b";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    assertMaintenanceSecret(request.headers.get("Authorization"));

    const body = await request.json().catch(() => ({}));
    const courseId = cleanCourseId(body.course_id) || defaultCourseId;
    const nowIso = new Date().toISOString();
    const db = adminClient();

    const [scheduledReleases, liveReleases] = await Promise.all([
      dueScheduledReleases(db, courseId, nowIso),
      dueLiveReleases(db, courseId, nowIso)
    ]);

    const openedReleases = await transitionReleases(db, scheduledReleases, {
      nowIso,
      newState: "released",
      reason: "Service opened scheduled release after opens_at."
    });
    const closedReleases = await transitionReleases(db, liveReleases, {
      nowIso,
      newState: "closed",
      reason: "Service closed live release after closes_at."
    });

    return json({
      checked_at: nowIso,
      course_id: courseId,
      opened_releases: openedReleases,
      closed_releases: closedReleases,
      total_changed: openedReleases.length + closedReleases.length
    });
  } catch (error) {
    const message = error.message || "Unable to run release maintenance.";
    const status = message.includes("not configured") ? 500 : message.includes("not authorized") ? 403 : 400;
    return json({ error: message }, { status });
  }
});

function assertMaintenanceSecret(authorization: string | null) {
  const expected = Deno.env.get("COURSE_MAINTENANCE_SECRET");
  if (!expected) {
    throw new Error("COURSE_MAINTENANCE_SECRET is not configured.");
  }
  if (bearerToken(authorization) !== expected) {
    throw new Error("Release maintenance is not authorized.");
  }
}

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
}

async function dueScheduledReleases(db: ReturnType<typeof adminClient>, courseId: string, nowIso: string) {
  const { data, error } = await db
    .from("content_releases")
    .select("id, course_id, state, opens_at, closes_at")
    .eq("course_id", courseId)
    .eq("state", "scheduled")
    .lte("opens_at", nowIso);
  if (error) throw error;
  return data || [];
}

async function dueLiveReleases(db: ReturnType<typeof adminClient>, courseId: string, nowIso: string) {
  const { data, error } = await db
    .from("content_releases")
    .select("id, course_id, state, opens_at, closes_at")
    .eq("course_id", courseId)
    .eq("state", "live")
    .lte("closes_at", nowIso);
  if (error) throw error;
  return data || [];
}

async function transitionReleases(
  db: ReturnType<typeof adminClient>,
  releases: Record<string, unknown>[],
  input: { nowIso: string; newState: "released" | "closed"; reason: string }
) {
  const changed = [];

  for (const release of releases) {
    const oldState = String(release.state || "");
    const { data: updated, error: updateError } = await db
      .from("content_releases")
      .update({
        state: input.newState,
        updated_by: null,
        updated_at: input.nowIso
      })
      .eq("id", release.id)
      .eq("state", oldState)
      .select("id, course_id, state, opens_at, closes_at, updated_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) continue;

    const { error: eventError } = await db.from("release_events").insert({
      content_release_id: updated.id,
      actor_profile_id: null,
      event_type: "state_changed",
      old_state: oldState,
      new_state: input.newState,
      reason: input.reason
    });
    if (eventError) throw eventError;

    changed.push({
      release_id: updated.id,
      old_state: oldState,
      new_state: input.newState,
      opens_at: updated.opens_at,
      closes_at: updated.closes_at,
      updated_at: updated.updated_at
    });
  }

  return changed;
}
