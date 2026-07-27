import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

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
    const profile = await loadProfileForToken(db, token);
    const sections = await loadStudentSections(db, courseId, String(profile.id));
    if (!sections.length) return json({ error: "Student is not enrolled in this course." }, { status: 403 });

    if (body.action === "submit_ticket") {
      const ticket = await submitTicket(db, courseId, String(profile.id), sections, body);
      return json({ ticket });
    }

    const sectionIds = sections.map((section) => String(section.id));
    const [sessions, tickets] = await Promise.all([
      loadRecentSessions(db, courseId, sectionIds),
      loadMyTickets(db, courseId, String(profile.id))
    ]);
    return json({
      profile,
      sections,
      class_sessions: sessions,
      tickets,
      actions: ["list_my_tickets", "submit_ticket"]
    });
  } catch (error) {
    const message = error.message || "Unable to save exit ticket.";
    if (message.includes("not enrolled")) return json({ error: message }, { status: 403 });
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

function cleanOptionalUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid id is required.");
  }
  return text;
}

function cleanText(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function cleanConfidence(value: unknown) {
  const score = Number(value || 3);
  return Math.min(5, Math.max(1, Math.round(Number.isFinite(score) ? score : 3)));
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Active student profile is not linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadStudentSections(db: Db, courseId: string, profileId: string) {
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("id, section_id, role, status")
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active");
  if (error) throw error;
  if (!(enrollments || []).length) return [];

  const sectionIds = unique((enrollments || []).map((enrollment) => enrollment.section_id));
  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, status")
    .eq("course_id", courseId)
    .in("id", sectionIds);
  if (sectionError) throw sectionError;
  return sections || [];
}

async function loadRecentSessions(db: Db, courseId: string, sectionIds: string[]) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id, section_id, title, planned_date, state")
    .eq("course_id", courseId)
    .in("section_id", sectionIds)
    .order("planned_date", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function submitTicket(db: Db, courseId: string, profileId: string, sections: Record<string, unknown>[], body: Record<string, unknown>) {
  const sectionId = cleanOptionalUuid(body.section_id) || String(sections[0].id);
  if (!sections.some((section) => String(section.id) === sectionId)) {
    throw new Error("Student is not enrolled in this section.");
  }
  const classSessionId = cleanOptionalUuid(body.class_session_id) || null;
  const contentItemId = cleanOptionalUuid(body.content_item_id) || null;
  const oneThing = cleanText(body.one_thing, 500);
  const muddyPoint = cleanText(body.muddy_point, 500);
  if (!oneThing) throw new Error("One idea that clicked is required.");
  if (!muddyPoint) throw new Error("One question or muddy point is required.");

  if (classSessionId) await assertSessionBelongsToSection(db, courseId, sectionId, classSessionId);
  if (contentItemId) await assertContentBelongsToCourse(db, courseId, contentItemId);

  const { data, error } = await db
    .from("exit_tickets")
    .insert({
      course_id: courseId,
      section_id: sectionId,
      class_session_id: classSessionId,
      profile_id: profileId,
      content_item_id: contentItemId,
      confidence: cleanConfidence(body.confidence),
      one_thing: oneThing,
      muddy_point: muddyPoint,
      next_action: cleanText(body.next_action || "review_mission", 40)
    })
    .select("id, course_id, section_id, class_session_id, profile_id, content_item_id, confidence, one_thing, muddy_point, next_action, created_at")
    .single();
  if (error) throw error;
  return data;
}

async function assertSessionBelongsToSection(db: Db, courseId: string, sectionId: string, classSessionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id")
    .eq("id", classSessionId)
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Class session is not available for this section.");
}

async function assertContentBelongsToCourse(db: Db, courseId: string, contentItemId: string) {
  const { data, error } = await db
    .from("content_items")
    .select("id")
    .eq("id", contentItemId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Content item is not part of this course.");
}

async function loadMyTickets(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("exit_tickets")
    .select("id, course_id, section_id, class_session_id, confidence, one_thing, muddy_point, next_action, created_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
