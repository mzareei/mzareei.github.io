import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

type ClassStudentNote = {
  id: string;
  class_session_id: string;
  profile_id: string;
  student_name: string;
  session_title: string;
  planned_date: string;
  author_name: string | null;
  note_text: string;
  needs_follow_up: boolean;
  resolved_at: string | null;
  created_at: string;
};

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
    const { profile } = await requireInstructor(db, token, courseId);

    if (body.action === "list_session") {
      const session = await loadSession(db, courseId, cleanUuid(body.class_session_id, "class session id"));
      return json({ notes: await listSessionNotes(db, session) });
    }

    if (body.action === "list_student") {
      const notes = await listStudentNotes(db, courseId, cleanUuid(body.profile_id, "student profile id"));
      return json({ notes });
    }

    if (body.action === "create") {
      const session = await loadSession(db, courseId, cleanUuid(body.class_session_id, "class session id"));
      const profileId = cleanUuid(body.profile_id, "student profile id");
      await requireStudentInSessionGroup(db, session, profileId);

      const { data: note, error: noteError } = await db
        .from("class_student_notes")
        .insert({
          course_id: courseId,
          class_session_id: session.id,
          profile_id: profileId,
          author_profile_id: profile.id,
          note_text: cleanNoteText(body.note_text),
          needs_follow_up: cleanNeedsFollowUp(body.needs_follow_up)
        })
        .select("id, class_session_id, profile_id, note_text, needs_follow_up, resolved_at, created_at")
        .single();
      if (noteError) throw noteError;

      await insertAudit(db, {
        courseId,
        actorProfileId: profile.id,
        targetId: note.id,
        action: "class_student_note_created",
        metadata: {
          class_session_id: session.id,
          profile_id: profileId,
          needs_follow_up: note.needs_follow_up
        }
      });

      return json({ notes: await listSessionNotes(db, session) });
    }

    if (body.action === "resolve") {
      const noteId = cleanUuid(body.note_id, "note id");
      const { data: existing, error: existingError } = await db
        .from("class_student_notes")
        .select("id, course_id, class_session_id, profile_id, resolved_at")
        .eq("id", noteId)
        .eq("course_id", courseId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error("Class student note not found.");
      if (existing.resolved_at) throw new Error("This class student note is already resolved.");

      const session = await loadSession(db, courseId, String(existing.class_session_id));
      await requireStudentInSessionGroup(db, session, String(existing.profile_id));
      const resolvedAt = new Date().toISOString();
      const { data: resolved, error: resolveError } = await db
        .from("class_student_notes")
        .update({
          resolved_at: resolvedAt,
          resolved_by: profile.id
        })
        .eq("id", noteId)
        .eq("course_id", courseId)
        .is("resolved_at", null)
        .select("id")
        .maybeSingle();
      if (resolveError) throw resolveError;
      if (!resolved) throw new Error("This class student note was resolved by another request.");

      await insertAudit(db, {
        courseId,
        actorProfileId: profile.id,
        targetId: noteId,
        action: "class_student_note_resolved",
        metadata: {
          class_session_id: session.id,
          profile_id: existing.profile_id,
          resolved_at: resolvedAt
        }
      });

      return json({ notes: await listSessionNotes(db, session) });
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error.message || "Unable to manage class student notes.";
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

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

function cleanNoteText(value: unknown) {
  if (typeof value !== "string") throw new Error("A note is required.");
  const text = value.trim();
  if (text.length < 1 || text.length > 4000) throw new Error("A note must be between 1 and 4000 characters.");
  return text;
}

function cleanNeedsFollowUp(value: unknown) {
  if (typeof value !== "boolean") throw new Error("needs_follow_up must be true or false.");
  return value;
}

async function requireInstructor(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("You are not allowed to manage class student notes without an active instructor profile.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .in("role", instructorRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to manage class student notes for this course.");

  return { profile };
}

async function loadSession(db: Db, courseId: string, sessionId: string) {
  const { data: session, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, title, planned_date")
    .eq("id", sessionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("Class session is not part of this course.");
  return session;
}

async function requireStudentInSessionGroup(db: Db, session: { id: string; section_id: string }, profileId: string) {
  const { data: enrollment, error } = await db
    .from("section_enrollments")
    .select("profile_id")
    .eq("section_id", session.section_id)
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!enrollment) throw new Error("That student is not active in this class group.");
}

async function listSessionNotes(db: Db, session: { id: string; section_id: string; title: string; planned_date: string }) {
  const { data: rows, error } = await db
    .from("class_student_notes")
    .select("id, class_session_id, profile_id, author_profile_id, note_text, needs_follow_up, resolved_at, created_at")
    .eq("class_session_id", session.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  await assertStoredNotesMatchSessionGroup(db, session, rows || []);
  return formatNotes(db, rows || [], new Map([[session.id, session]]));
}

async function listStudentNotes(db: Db, courseId: string, profileId: string) {
  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("section_id")
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  const sectionIds = unique((enrollments || []).map((row) => String(row.section_id)));
  if (!sectionIds.length) throw new Error("That student is not active in any class group.");

  const { data: sessions, error: sessionError } = await db
    .from("class_sessions")
    .select("id, section_id, title, planned_date")
    .eq("course_id", courseId)
    .in("section_id", sectionIds);
  if (sessionError) throw sessionError;
  const sessionIds = unique((sessions || []).map((session) => String(session.id)));
  if (!sessionIds.length) throw new Error("That student is not active in a class group for this course.");

  const { data: rows, error } = await db
    .from("class_student_notes")
    .select("id, class_session_id, profile_id, author_profile_id, note_text, needs_follow_up, resolved_at, created_at")
    .eq("profile_id", profileId)
    .in("class_session_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return formatNotes(db, rows || [], new Map((sessions || []).map((session) => [session.id, session])));
}

async function assertStoredNotesMatchSessionGroup(db: Db, session: { section_id: string }, rows: Array<{ profile_id: string }>) {
  const profileIds = unique(rows.map((row) => String(row.profile_id)));
  if (!profileIds.length) return;
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("profile_id")
    .eq("section_id", session.section_id)
    .in("profile_id", profileIds)
    .eq("role", "student")
    .eq("status", "active");
  if (error) throw error;
  const activeStudentIds = new Set((enrollments || []).map((row) => String(row.profile_id)));
  if (profileIds.some((profileId) => !activeStudentIds.has(profileId))) {
    throw new Error("A class student note refers to a student outside this active class group.");
  }
}

async function formatNotes(
  db: Db,
  rows: Array<Record<string, unknown>>,
  sessionById: Map<string, { id: string; title: string; planned_date: string }>
): Promise<ClassStudentNote[]> {
  if (!rows.length) return [];
  const profileIds = unique(rows.flatMap((row) => [String(row.profile_id), row.author_profile_id ? String(row.author_profile_id) : ""]));
  const { data: profiles, error } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", profileIds);
  if (error) throw error;
  const nameByProfileId = new Map((profiles || []).map((profile) => [String(profile.id), String(profile.full_name || "")]));

  return rows.map((row) => {
    const session = sessionById.get(String(row.class_session_id));
    if (!session) throw new Error("A class student note is not linked to a visible class session.");
    return {
      id: String(row.id),
      class_session_id: String(row.class_session_id),
      profile_id: String(row.profile_id),
      student_name: nameByProfileId.get(String(row.profile_id)) || "Student",
      session_title: String(session.title),
      planned_date: String(session.planned_date),
      author_name: row.author_profile_id ? nameByProfileId.get(String(row.author_profile_id)) || null : null,
      note_text: String(row.note_text),
      needs_follow_up: Boolean(row.needs_follow_up),
      resolved_at: row.resolved_at ? String(row.resolved_at) : null,
      created_at: String(row.created_at)
    };
  });
}

async function insertAudit(db: Db, input: {
  courseId: string;
  actorProfileId: string;
  targetId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await db
    .from("audit_log")
    .insert({
      course_id: input.courseId,
      actor_profile_id: input.actorProfileId,
      target_type: "class_student_note",
      target_id: input.targetId,
      action: input.action,
      metadata: input.metadata
    });
  if (error) throw new Error(`Required class student note audit write failed: ${error.message || "unknown error"}`);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
