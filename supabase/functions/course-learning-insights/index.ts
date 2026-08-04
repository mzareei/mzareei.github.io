import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type Db = ReturnType<typeof adminClient>;

const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
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
    const selectedSectionId = cleanUuid(body.section_id);
    const db = adminClient();
    const permissions = await requireInstructor(db, token, courseId);

    const baseCatalog = await loadCatalog(db, courseId, permissions);
    const catalog = {
      ...baseCatalog,
      sections: filterSelectedSections(baseCatalog.sections, selectedSectionId)
    };
    if (selectedSectionId && !catalog.sections.length) {
      throw new Error("You are not allowed to review learning insights for this section.");
    }
    const sectionIds = catalog.sections.map((section) => String(section.id));
    sectionIds.forEach((sectionId) => assertSectionAllowed(permissions, sectionId));
    const scores = await loadScores(db, catalog.items.map((item) => String(item.id)), sectionIds);
    const topicSummaries = await loadTopicSummaries(db, catalog.sections.map((section) => String(section.id)));
    const exitTicketTrends = await loadExitTicketTrends(db, courseId, sectionIds, permissions.isGlobalCourseInstructor && !selectedSectionId);

    const result = {
      section_summaries: sectionSummaries(catalog.sections, scores),
      activity_summaries: activitySummaries(catalog.items, catalog.categories, scores),
      student_summaries: await studentSummaries(db, catalog.sections, scores),
      topic_summaries: topicSummaries,
      exit_ticket_trends: exitTicketTrends,
      recommendations: recommendations({
        section_summaries: sectionSummaries(catalog.sections, scores),
        topic_summaries: topicSummaries,
        exit_ticket_trends: exitTicketTrends
      })
    };

    return json(result);
  } catch (error) {
    const message = error.message || "Unable to load learning insights.";
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

function cleanUuid(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("A valid section id is required.");
  }
  return text;
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
    .in("role", teacherRoles);
  if (membershipError) throw membershipError;
  if (!(memberships || []).length) throw new Error("You are not allowed to review learning insights for this course.");

  const isGlobalCourseInstructor = (memberships || []).some((membership) => String(membership.role) === "platform_owner");
  const permittedSectionIds = isGlobalCourseInstructor ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
  if (!isGlobalCourseInstructor && !permittedSectionIds.length) {
    throw new Error("You are not allowed to review learning insights for this course.");
  }

  return { profile, user: userData.user, isGlobalCourseInstructor, permittedSectionIds };
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

async function loadCatalog(db: Db, courseId: string, permissions: {
  isGlobalCourseInstructor: boolean;
  permittedSectionIds: string[];
}) {
  let sectionQuery = db
    .from("course_sections")
    .select("id, section_code, section_name, status")
    .eq("course_id", courseId)
    .order("section_code", { ascending: true });
  if (!permissions.isGlobalCourseInstructor) sectionQuery = sectionQuery.in("id", permissions.permittedSectionIds);

  const [{ data: sections, error: sectionError }, { data: categories, error: categoryError }, { data: items, error: itemError }] = await Promise.all([
    sectionQuery,
    db
      .from("gradebook_categories")
      .select("id, name, weight_percent, status")
      .eq("course_id", courseId)
      .order("name", { ascending: true }),
    db
      .from("gradebook_items")
      .select("id, category_id, title, max_score, status")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true })
  ]);
  if (sectionError) throw sectionError;
  if (categoryError) throw categoryError;
  if (itemError) throw itemError;
  return {
    sections: sections || [],
    categories: categories || [],
    items: items || []
  };
}

function filterSelectedSections(sections: Record<string, unknown>[], selectedSectionId: string) {
  if (!selectedSectionId) return sections;
  return sections.filter((section) => String(section.id) === selectedSectionId);
}

async function loadScores(db: Db, itemIds: string[], sectionIds: string[]) {
  if (!itemIds.length) return [];
  if (!sectionIds.length) return [];
  const { data: scores, error } = await db
    .from("gradebook_scores")
    .select("id, gradebook_item_id, profile_id, section_id, score_percent, score_final, status, updated_at")
    .in("gradebook_item_id", itemIds)
    .in("section_id", sectionIds);
  if (error) throw error;
  return scores || [];
}

function sectionSummaries(sections: Record<string, unknown>[], scores: Record<string, unknown>[]) {
  return sections.map((section) => {
    const rows = scores.filter((score) => score.section_id === section.id);
    return {
      section_id: section.id,
      section_code: section.section_code,
      section_name: section.section_name,
      score_count: rows.length,
      average_final: average(rows.map((row) => Number(row.score_final))),
      needs_review: rows.filter((row) => Number(row.score_final || 0) < 70).length
    };
  });
}

function assertSectionAllowed(permissions: {
  isGlobalCourseInstructor: boolean;
  permittedSectionIds: string[];
}, sectionId: string) {
  if (permissions.isGlobalCourseInstructor) return;
  if (permissions.permittedSectionIds.includes(String(sectionId))) return;
  throw new Error("You are not allowed to review learning insights for this section.");
}

function activitySummaries(items: Record<string, unknown>[], categories: Record<string, unknown>[], scores: Record<string, unknown>[]) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return items.map((item) => {
    const rows = scores.filter((score) => score.gradebook_item_id === item.id);
    const category = categoryById.get(item.category_id) || {};
    return {
      gradebook_item_id: item.id,
      title: item.title,
      category_name: category.name || "",
      score_count: rows.length,
      average_final: average(rows.map((row) => Number(row.score_final))),
      needs_review: rows.filter((row) => Number(row.score_final || 0) < 70).length
    };
  });
}

async function studentSummaries(db: Db, sections: Record<string, unknown>[], scores: Record<string, unknown>[]) {
  const profileIds = unique(scores.map((score) => score.profile_id));
  if (!profileIds.length) return [];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, institutional_email, student_identifier, full_name")
    .in("id", profileIds);
  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const grouped = new Map<string, Record<string, unknown>[]>();
  scores.forEach((score) => {
    const key = `${score.profile_id}:${score.section_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(score);
  });

  return Array.from(grouped.entries()).map(([key, rows]) => {
    const [profileId, sectionId] = key.split(":");
    const profile = profileById.get(profileId) || {};
    const section = sectionById.get(sectionId) || {};
    return {
      profile_id: profileId,
      student_name: profile.full_name || "",
      institutional_email: profile.institutional_email || "",
      student_identifier: profile.student_identifier || "",
      section_code: section.section_code || "",
      score_count: rows.length,
      average_final: average(rows.map((row) => Number(row.score_final))),
      needs_review: rows.filter((row) => Number(row.score_final || 0) < 70).length
    };
  }).sort((a, b) => a.average_final - b.average_final);
}

async function loadTopicSummaries(db: Db, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, section_id, profile_id, status")
    .in("section_id", sectionIds)
    .in("status", ["submitted", "late"]);
  if (attemptError) throw attemptError;
  const attemptIds = unique((attempts || []).map((attempt) => attempt.id));
  if (!attemptIds.length) return [];

  const { data: responses, error: responseError } = await db
    .from("student_responses")
    .select("student_attempt_id, question_id, points_awarded")
    .in("student_attempt_id", attemptIds)
    .eq("points_awarded", 0);
  if (responseError) throw responseError;
  const questionIds = unique((responses || []).map((response) => response.question_id));
  if (!questionIds.length) return [];

  const { data: questions, error: questionError } = await db
    .from("questions")
    .select("id, topic_tags, difficulty")
    .in("id", questionIds);
  if (questionError) throw questionError;
  const counts = new Map<string, number>();
  (questions || []).forEach((question) => {
    (question.topic_tags || []).forEach((tag: string) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([topic, missed_count]) => ({
      topic,
      missed_count
    }));
}

async function loadExitTicketTrends(db: Db, courseId: string, sectionIds: string[], includeLegacy: boolean) {
  const [authenticatedTickets, legacyTickets] = await Promise.all([
    loadAuthenticatedExitTickets(db, courseId, sectionIds),
    includeLegacy ? loadLegacyExitTickets(db, courseId) : Promise.resolve([])
  ]);
  const tickets = [...authenticatedTickets, ...legacyTickets];

  const grouped = new Map<string, Record<string, unknown>[]>();
  tickets.forEach((ticket) => {
    const key = String(ticket.lecture_id || ticket.lecture_title || "unknown");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ticket);
  });

  return Array.from(grouped.values()).map((rows) => ({
    lecture_id: rows[0].lecture_id || "",
    lecture_title: rows[0].lecture_title || "Lecture",
    ticket_count: rows.length,
    average_confidence: average(rows.map((row) => Number(row.confidence))),
    low_confidence: rows.filter((row) => Number(row.confidence || 0) <= 2).length,
    latest_muddy_point: rows.find((row) => row.muddy_point)?.muddy_point || "",
    latest_at: rows[0].created_at || ""
  })).sort((a, b) => String(b.latest_at).localeCompare(String(a.latest_at)));
}

async function loadLegacyExitTickets(db: Db, courseId: string) {
  const { data: tickets, error } = await db
    .from("course_exit_tickets")
    .select("lecture_id, lecture_title, confidence, muddy_point, next_action, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return tickets || [];
}

async function loadAuthenticatedExitTickets(db: Db, courseId: string, sectionIds: string[]) {
  if (!sectionIds.length) return [];
  const { data: tickets, error } = await db
    .from("exit_tickets")
    .select("id, class_session_id, content_item_id, confidence, muddy_point, next_action, created_at")
    .eq("course_id", courseId)
    .in("section_id", sectionIds)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  if (!(tickets || []).length) return [];

  const sessionIds = unique((tickets || []).map((ticket) => ticket.class_session_id));
  const contentIds = unique((tickets || []).map((ticket) => ticket.content_item_id));
  const [{ data: sessions, error: sessionError }, { data: items, error: itemError }] = await Promise.all([
    sessionIds.length
      ? db
          .from("class_sessions")
          .select("id, title, planned_date")
          .in("id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? db
          .from("content_items")
          .select("id, slug, title")
          .in("id", contentIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (sessionError) throw sessionError;
  if (itemError) throw itemError;

  const sessionById = new Map((sessions || []).map((session) => [session.id, session]));
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  return (tickets || []).map((ticket) => {
    const session = ticket.class_session_id ? sessionById.get(ticket.class_session_id) || {} : {};
    const item = ticket.content_item_id ? itemById.get(ticket.content_item_id) || {} : {};
    return {
      lecture_id: item.slug || ticket.class_session_id || "authenticated-exit-ticket",
      lecture_title: item.title || session.title || "Authenticated exit ticket",
      confidence: ticket.confidence,
      muddy_point: ticket.muddy_point,
      next_action: ticket.next_action,
      created_at: ticket.created_at
    };
  });
}

function recommendations(input: {
  section_summaries: Record<string, unknown>[];
  topic_summaries: Record<string, unknown>[];
  exit_ticket_trends: Record<string, unknown>[];
}) {
  const rows = [];
  const weakestSection = input.section_summaries
    .filter((section) => Number(section.score_count || 0) > 0)
    .sort((a, b) => Number(a.average_final || 0) - Number(b.average_final || 0))[0];
  if (weakestSection) {
    rows.push({
      title: `Review section ${weakestSection.section_code}`,
      body: `Average final score is ${weakestSection.average_final}% with ${weakestSection.needs_review} low records.`
    });
  }
  const topTopic = input.topic_summaries[0];
  if (topTopic) {
    rows.push({
      title: `Revisit ${labelize(String(topTopic.topic))}`,
      body: `${topTopic.missed_count} missed responses are connected to this topic.`
    });
  }
  const lowTicket = input.exit_ticket_trends.find((trend) => Number(trend.low_confidence || 0) > 0);
  if (lowTicket) {
    rows.push({
      title: `Clarify ${lowTicket.lecture_title}`,
      body: `${lowTicket.low_confidence} low-confidence exit ticket${Number(lowTicket.low_confidence) === 1 ? "" : "s"} appeared recently.`
    });
  }
  if (!rows.length) {
    rows.push({
      title: "No urgent review signal",
      body: "Use the next class to deepen practice or run a quick pulse activity."
    });
  }
  return rows;
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 10) / 10 : 0;
}

function labelize(value: string) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
