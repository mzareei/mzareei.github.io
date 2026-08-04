// Platform-owner-only admin surface: invite professors, create courses, and
// manage who teaches what. There is no separate account-creation step — an
// invited email just needs a 'profiles' row (status 'invited') and a
// 'course_memberships' row; the person claims it themselves the first time
// they sign in with that email (see course-auth-context's loadOrClaimProfile).
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertInstructorEmailAllowed } from "../_shared/identity.ts";
import { sendInstructorInvitation } from "../_shared/instructor-invitation.ts";

type Db = ReturnType<typeof adminClient>;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const actor = await loadProfileForToken(db, token);
    await assertPlatformOwner(db, String(actor.id));

    switch (body.action) {
      case "list_courses":
        return json(await listCourses(db));
      case "create_course":
        return json(await createCourse(db, body));
      case "list_professors":
        return json(await listProfessors(db, body));
      case "invite_professor":
        return json(await inviteProfessor(db, body));
      case "deactivate":
        return json(await deactivateMembership(db, body));
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = error?.message || "Unable to complete that admin action.";
    if (message.includes("platform owner")) return json({ error: message }, { status: 403 });
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("No active course profile is linked to this account.");
  return profile;
}

async function assertPlatformOwner(db: Db, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("id")
    .eq("profile_id", profileId)
    .eq("role", "platform_owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This action is restricted to a platform owner.");
}

async function listCourses(db: Db) {
  const { data, error } = await db
    .from("courses")
    .select("id, code, title, term_label, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { courses: data || [] };
}

async function createCourse(db: Db, body: Record<string, unknown>) {
  const id = cleanCourseId(body.id);
  const code = String(body.code || "").trim();
  const title = String(body.title || "").trim();
  const termLabel = String(body.term_label || "").trim();
  if (!id) throw new Error("A short course id (letters, digits, ._-) is required.");
  if (code.length < 2) throw new Error("A course code is required.");
  if (title.length < 2) throw new Error("A course title is required.");
  if (termLabel.length < 2) throw new Error("A term label (e.g. \"Fall 2026\") is required.");

  const { data, error } = await db
    .from("courses")
    .insert({ id, code, title, term_label: termLabel, status: "planned" })
    .select("id, code, title, term_label, status")
    .single();
  if (error) {
    if (String(error.code) === "23505") throw new Error(`A course with id "${id}" already exists.`);
    throw error;
  }
  return { course: data };
}

async function listProfessors(db: Db, body: Record<string, unknown>) {
  const courseId = cleanCourseId(body.course_id);
  let query = db
    .from("course_memberships")
    .select("id, course_id, role, status, profile_id, profiles(institutional_email, full_name, status)")
    .in("role", ["instructor", "teaching_assistant", "platform_owner"])
    .order("role", { ascending: true });
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw error;

  return {
    professors: (data || []).map((row: Record<string, unknown>) => {
      const profile = (row.profiles || {}) as Record<string, unknown>;
      return {
        membership_id: row.id,
        course_id: row.course_id,
        role: row.role,
        membership_status: row.status,
        profile_id: row.profile_id,
        email: profile.institutional_email || null,
        full_name: profile.full_name || null,
        profile_status: profile.status || null
      };
    })
  };
}

async function findOrCreateProfileByEmail(db: Db, email: string, fullName: string) {
  const { data: existing, error } = await db
    .from("profiles")
    .select("id, status")
    .eq("institutional_email", email)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  const { data: created, error: createError } = await db
    .from("profiles")
    .insert({
      institutional_email: email,
      full_name: fullName || email,
      status: "invited"
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

async function inviteProfessor(db: Db, body: Record<string, unknown>) {
  const courseId = cleanCourseId(body.course_id);
  const email = cleanEmail(body.email);
  const fullName = String(body.full_name || "").trim();
  const role = String(body.role || "instructor").trim();
  if (!["instructor", "teaching_assistant"].includes(role)) {
    throw new Error("Role must be instructor or teaching_assistant.");
  }
  if (!courseId) throw new Error("A course is required.");
  if (role === "instructor") {
    assertInstructorEmailAllowed(email);
  } else {
    await assertCourseEmailAllowed(db, email);
  }

  const { data: course, error: courseError } = await db
    .from("courses").select("id").eq("id", courseId).maybeSingle();
  if (courseError) throw courseError;
  if (!course) throw new Error("That course was not found.");

  const profileId = await findOrCreateProfileByEmail(db, email, fullName);

  const { data: membership, error: membershipError } = await db
    .from("course_memberships")
    .upsert(
      { course_id: courseId, profile_id: profileId, role, status: "active" },
      { onConflict: "course_id,profile_id,role" }
    )
    .select("id, course_id, role, status")
    .maybeSingle();
  if (membershipError) throw membershipError;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("auth_user_id, status")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw profileError;
  const invitation = role === "instructor" && (!profile?.auth_user_id || profile.status === "invited")
    ? await sendInstructorInvitation(db, email)
    : null;

  return {
    membership,
    profile_id: profileId,
    invite_email_sent: invitation?.sent ?? null,
    invite_email_method: invitation?.method ?? null
  };
}

async function deactivateMembership(db: Db, body: Record<string, unknown>) {
  const membershipId = String(body.membership_id || "").trim();
  if (!membershipId) throw new Error("A membership id is required.");
  const { data, error } = await db
    .from("course_memberships")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", membershipId)
    .select("id, status")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That membership was not found.");
  return { membership: data };
}
