import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const instructorRoles = ["platform_owner", "instructor"];
const eventTypes = ["attendance", "pulse_response", "class_contribution", "device_exception", "makeup_credit", "other"];

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
    const permissions = await requireTeacher(db, token, courseId);

    if (body.action === "record_participation_event") {
      const result = await recordParticipationEvent(db, courseId, {
        sectionId: cleanUuid(body.section_id, "section id"),
        classSessionId: cleanOptionalUuid(body.class_session_id),
        profileId: cleanUuid(body.profile_id, "student profile id"),
        event_type: cleanEventType(body.event_type),
        points: cleanPoints(body.points),
        note: cleanNote(body.note),
        actorProfileId: String(permissions.profile.id),
        permissions
      });
      const context = await listParticipationContext(db, courseId, permissions, result.event.section_id);
      return json({ ...context, event: result.event });
    }

    const selectedSectionId = cleanOptionalUuid(body.section_id);
    const context = await listParticipationContext(db, courseId, permissions, selectedSectionId);
    return json({
      ...context,
      actions: ["list_participation_context", "record_participation_event"]
    });
  } catch (error) {
    const message = error.message || "Unable to manage participation events.";
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

function cleanOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid optional id is required.");
  }
  return text;
}

function cleanEventType(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!eventTypes.includes(text)) throw new Error("A valid participation event type is required.");
  return text;
}

function cleanPoints(value: unknown) {
  const points = Number(value || 0);
  if (!Number.isFinite(points) || points < 0 || points > 100) {
    throw new Error("Participation points must be between 0 and 100.");
  }
  return Math.round(points * 100) / 100;
}

function cleanNote(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 500);
}

async function requireTeacher(db: Db, token: string, courseId: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Teacher profile is not linked to this account.");

  const { data: memberships, error: membershipError } = await db
    .from("course_memberships")
    .select("id, role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .in("role", teacherRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to record participation for this course.");

  const isCourseInstructor = (memberships || []).some((membership) => String(membership.role) === "platform_owner");
  const permittedSectionIds = isCourseInstructor ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isCourseInstructor && !permittedSectionIds.length) {
    throw new Error("You are not allowed to record participation for this course.");
  }

  return { profile, user: userData.user, isCourseInstructor, permittedSectionIds };
}

async function loadPermittedSectionIds(db: Db, profileId: string, courseId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("section_id, course_sections!inner(course_id)")
    .eq("profile_id", profileId)
    .in("role", ["instructor", "teaching_assistant"])
    .eq("status", "active")
    .eq("course_sections.course_id", courseId);
  if (error) throw error;
  return unique((data || []).map((row) => row.section_id));
}

async function listParticipationContext(db: Db, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}, selectedSectionId = "") {
  const sections = await loadSections(db, courseId, permissions);
  const scopedSections = selectedSectionId
    ? sections.filter((section) => String(section.id) === selectedSectionId)
    : sections;
  if (selectedSectionId && !scopedSections.length) {
    throw new Error("You are not allowed to record participation for this section.");
  }
  const sectionIds = scopedSections.map((section) => String(section.id));
  const [sessions, students, events] = await Promise.all([
    loadSessions(db, courseId, sectionIds),
    loadStudents(db, sectionIds),
    loadEvents(db, courseId, sectionIds)
  ]);
  return {
    sections,
    sessions,
    students,
    participation_events: events
  };
}

async function loadSections(db: Db, courseId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  let query = db
    .from("course_sections")
    .select("id, section_code, section_name, status")
    .eq("course_id", courseId)
    .order("section_code", { ascending: true });
  if (!permissions.isCourseInstructor) query = query.in("id", permissions.permittedSectionIds);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function loadSessions(db: Db, courseId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data, error } = await db
    .from("class_sessions")
    .select("id, section_id, title, planned_date, state")
    .eq("course_id", courseId)
    .in("section_id", sectionIds)
    .order("planned_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function loadStudents(db: Db, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("section_id, profile_id, status")
    .in("section_id", sectionIds)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  const profileIds = unique((enrollments || []).map((enrollment) => enrollment.profile_id));
  if (!profileIds.length) return [];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name, institutional_email, student_identifier, status")
    .in("id", profileIds)
    .order("full_name", { ascending: true });
  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return (enrollments || []).map((enrollment) => {
    const profile = profileById.get(enrollment.profile_id) || {};
    return {
      section_id: enrollment.section_id,
      profile_id: enrollment.profile_id,
      full_name: profile.full_name || "",
      preferred_name: profile.preferred_name || "",
      institutional_email: profile.institutional_email || "",
      student_identifier: profile.student_identifier || "",
      status: profile.status || ""
    };
  }).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

async function loadEvents(db: Db, courseId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: events, error } = await db
    .from("participation_events")
    .select("id, course_id, section_id, class_session_id, profile_id, event_type, points, metadata, created_at")
    .eq("course_id", courseId)
    .in("section_id", sectionIds)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!(events || []).length) return [];

  const profileIds = unique((events || []).map((event) => event.profile_id));
  const sessionIds = unique((events || []).map((event) => event.class_session_id));
  const [{ data: profiles, error: profileError }, { data: sessions, error: sessionError }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, student_identifier, institutional_email")
      .in("id", profileIds),
    sessionIds.length
      ? db
          .from("class_sessions")
          .select("id, title, planned_date")
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (profileError) throw profileError;
  if (sessionError) throw sessionError;
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const sessionById = new Map((sessions || []).map((session) => [session.id, session]));

  return (events || []).map((event) => {
    const profile = profileById.get(event.profile_id) || {};
    const session = event.class_session_id ? sessionById.get(event.class_session_id) || {} : {};
    return {
      ...event,
      student_name: profile.full_name || "",
      student_identifier: profile.student_identifier || profile.institutional_email || "",
      session_title: session.title || "",
      session_date: session.planned_date || ""
    };
  });
}

async function recordParticipationEvent(db: Db, courseId: string, input: {
  sectionId: string;
  classSessionId: string;
  profileId: string;
  event_type: string;
  points: number;
  note: string;
  actorProfileId: string;
  permissions: {
    isCourseInstructor: boolean;
    permittedSectionIds: string[];
  };
}) {
  await assertSectionAllowed(db, courseId, input.sectionId, input.permissions);
  await assertStudentInSection(db, input.profileId, input.sectionId);
  if (input.classSessionId) await assertSessionInSection(db, courseId, input.classSessionId, input.sectionId);

  const { data: event, error } = await db
    .from("participation_events")
    .insert({
      course_id: courseId,
      section_id: input.sectionId,
      class_session_id: input.classSessionId || null,
      profile_id: input.profileId,
      event_type: input.event_type,
      points: input.points,
      metadata: {
        note: input.note,
        recorded_by_profile_id: input.actorProfileId
      }
    })
    .select("id, course_id, section_id, class_session_id, profile_id, event_type, points, metadata, created_at")
    .single();
  if (error) throw error;

  const { error: auditError } = await db
    .from("audit_log")
    .insert({
      course_id: courseId,
      actor_profile_id: input.actorProfileId,
      target_type: "participation_event",
      target_id: event.id,
      action: "participation_event_recorded",
      metadata: {
        section_id: input.sectionId,
        class_session_id: input.classSessionId || null,
        profile_id: input.profileId,
        event_type: input.event_type,
        points: input.points
      }
    });
  if (auditError) throw auditError;

  return { event };
}

async function assertSectionAllowed(db: Db, courseId: string, sectionId: string, permissions: {
  isCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  const { data: section, error } = await db
    .from("course_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!section) throw new Error("Section is not part of this course.");
  if (permissions.isCourseInstructor) return;
  if (permissions.permittedSectionIds.includes(sectionId)) return;
  throw new Error("You are not allowed to record participation for this section.");
}

async function assertStudentInSection(db: Db, profileId: string, sectionId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("id")
    .eq("profile_id", profileId)
    .eq("section_id", sectionId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Student is not active in the selected section.");
}

async function assertSessionInSection(db: Db, courseId: string, classSessionId: string, sectionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id")
    .eq("id", classSessionId)
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Class session is not part of the selected section.");
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
