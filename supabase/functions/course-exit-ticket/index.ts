import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { assertCheckedIn } from "../_shared/attendance.ts";
import { postClassGradesQuietly, studentClassGrades } from "../_shared/class-grade.ts";

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
    const message = (error as Error)?.message || "Unable to save exit ticket.";
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

const defaultReflectionMinWords = 50;
const defaultReflectionMaxWords = 100;
// A missed reflection still counts as attendance evidence for a few minutes
// after the professor ends class — a slow writer shouldn't lose the credit
// because they were still typing when the screen changed.
const reflectionGraceMinutes = 5;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function submitTicket(db: Db, courseId: string, profileId: string, sections: Record<string, unknown>[], body: Record<string, unknown>) {
  const sectionId = cleanOptionalUuid(body.section_id) || String(sections[0].id);
  if (!sections.some((section) => String(section.id) === sectionId)) {
    throw new Error("Student is not enrolled in this section.");
  }
  const classSessionId = cleanOptionalUuid(body.class_session_id) || null;
  const contentItemId = cleanOptionalUuid(body.content_item_id) || null;

  let minWords = defaultReflectionMinWords;
  let maxWords = defaultReflectionMaxWords;
  if (classSessionId) {
    const bounds = await assertSessionBelongsToSection(db, courseId, sectionId, classSessionId);
    // The reflection is the class's required final submission, so it is gated
    // like everything else in the class: you had to be in the room.
    await assertCheckedIn(db, classSessionId, profileId);
    minWords = bounds.reflection_min_words ?? minWords;
    maxWords = bounds.reflection_max_words ?? maxWords;
    assertWithinGraceWindow(bounds);
  }
  if (contentItemId) await assertContentBelongsToCourse(db, courseId, contentItemId);

  // The reflection is one paragraph: what did you learn this class. The old
  // multi-field ticket (muddy point, next action) is no longer asked for.
  const oneThing = cleanText(body.one_thing, 800);
  const wordCount = countWords(oneThing);
  if (!oneThing) throw new Error("Write what you learned today.");
  if (wordCount < minWords) {
    throw new Error(`Write at least ${minWords} words (currently ${wordCount}).`);
  }
  if (wordCount > maxWords) {
    throw new Error(`Keep it to ${maxWords} words or fewer (currently ${wordCount}).`);
  }

  const { data, error } = await db
    .from("exit_tickets")
    .insert({
      course_id: courseId,
      section_id: sectionId,
      class_session_id: classSessionId,
      profile_id: profileId,
      content_item_id: contentItemId,
      confidence: 3,
      one_thing: oneThing,
      muddy_point: null,
      next_action: null
    })
    .select("id, course_id, section_id, class_session_id, profile_id, content_item_id, one_thing, created_at")
    .single();
  if (error) throw error;

  // The reflection is the last thing a student does, so this is the moment
  // their grade is finished — and, from 2026-08-14, the moment they get to see
  // it. Posting used to be a button the professor pressed on every class
  // record; a student who finished the class was shown "No grades yet" until he
  // remembered to press it.
  const grade = classSessionId
    ? await postOwnGrade(db, courseId, sectionId, classSessionId, profileId)
    : null;

  return { ...data, word_count: wordCount, class_grade: grade };
}

/**
 * Post THIS student's class grade and hand it straight back.
 *
 * Deliberately one student, never the roster. Posting the room whenever one
 * person finishes would give every classmate still writing their reflection a
 * grade carrying the 20% missing-submission penalty — a punishment for
 * something they have not failed to do yet. The rest of the room is posted when
 * the professor ends the class.
 */
async function postOwnGrade(
  db: Db,
  courseId: string,
  sectionId: string,
  classSessionId: string,
  profileId: string
) {
  const { data: session, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, sequence_number, title")
    .eq("id", classSessionId)
    .maybeSingle();
  if (error || !session) return null;

  const posted = await postClassGradesQuietly(
    db,
    {
      id: String(session.id),
      course_id: String(session.course_id),
      section_id: String(session.section_id),
      sequence_number: Number(session.sequence_number || 0),
      title: String(session.title || "")
    },
    { profileIds: [profileId], actorProfileId: profileId, trigger: "reflection_submitted" }
  );
  if (!posted?.posted) return null;

  // Read it back through the student's own path rather than returning what was
  // just written: the phone then shows exactly the row My Grades will show,
  // breakdown and all, instead of a second rendering of the same number.
  const grades = await studentClassGrades(db, courseId, profileId, [sectionId]).catch(() => []);
  return grades.find((row) => row.class_session_id === classSessionId) ?? null;
}

function assertWithinGraceWindow(session: { state?: string; actual_end_at?: string | null }) {
  if (!session.actual_end_at) return; // still in progress or never explicitly closed
  const closedAt = new Date(session.actual_end_at).getTime();
  const deadline = closedAt + reflectionGraceMinutes * 60 * 1000;
  if (Date.now() > deadline) {
    throw new Error("This class has closed and the reflection window has passed.");
  }
}

async function assertSessionBelongsToSection(db: Db, courseId: string, sectionId: string, classSessionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id, state, actual_end_at, reflection_min_words, reflection_max_words")
    .eq("id", classSessionId)
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Class session is not available for this section.");
  return data;
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
