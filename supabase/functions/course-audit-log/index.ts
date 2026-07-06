import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const db = adminClient();
    await requireInstructor(db, token, courseId);

    const audit_events = await loadAuditEvents(db, courseId, {
      targetType: cleanTargetType(body.target_type),
      auditAction: cleanAction(body.audit_action),
      limit: cleanLimit(body.limit)
    });

    return json({
      audit_events,
      target_types: unique(audit_events.map((event) => event.target_type)),
      action_names: unique(audit_events.map((event) => event.action)),
      actions: ["list_audit_events"]
    });
  } catch (error) {
    const message = error.message || "Unable to load audit events.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

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

function cleanTargetType(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 120);
}

function cleanAction(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 120);
}

function cleanLimit(value: unknown) {
  const limit = Number(value || 100);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.trunc(limit), 10), 500);
}

async function requireInstructor(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Instructor profile is not linked to this account.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .in("role", instructorRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to review course audit events.");

  return { profile, user: userData.user };
}

async function loadAuditEvents(db: Db, courseId: string, filters: {
  targetType: string;
  auditAction: string;
  limit: number;
}) {
  let query = db
    .from("audit_log")
    .select("id, course_id, actor_profile_id, target_type, target_id, action, metadata, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(filters.limit);
  if (filters.targetType) query = query.eq("target_type", filters.targetType);
  if (filters.auditAction) query = query.eq("action", filters.auditAction);

  const { data: events, error } = await query;
  if (error) throw error;
  if (!(events || []).length) return [];

  const actorIds = unique((events || []).map((event) => event.actor_profile_id));
  const { data: actors, error: actorError } = actorIds.length
    ? await db
        .from("profiles")
        .select("id, institutional_email, full_name")
        .in("id", actorIds)
    : { data: [], error: null };
  if (actorError) throw actorError;

  const actorById = new Map((actors || []).map((actor) => [actor.id, actor]));
  return (events || []).map((event) => {
    const actor = event.actor_profile_id ? actorById.get(event.actor_profile_id) || {} : {};
    return {
      id: event.id,
      course_id: event.course_id,
      actor_profile_id: event.actor_profile_id || "",
      actor_name: actor.full_name || "",
      actor_email: actor.institutional_email || "",
      target_type: event.target_type,
      target_id: event.target_id || "",
      action: event.action,
      metadata: event.metadata || {},
      created_at: event.created_at
    };
  });
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
