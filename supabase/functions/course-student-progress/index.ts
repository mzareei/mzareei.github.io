import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { gradingWeights, studentClassGrades, type StudentClassGrade } from "../_shared/class-grade.ts";

type Db = ReturnType<typeof adminClient>;

const visibleReleaseStates = ["released", "live", "review_only", "scheduled"];

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
    if (!sections.length) throw new Error("Student is not enrolled in this course.");

    const sectionIds = sections.map((section) => String(section.id));
    const scores = await loadScores(db, courseId, String(profile.id), sectionIds);
    const attempts = await loadAttempts(db, String(profile.id), sectionIds);
    const releasedPractice = await loadReleasedPractice(db, courseId, sectionIds);
    const portfolioEntries = await loadPortfolioEntries(db, courseId, String(profile.id), sectionIds);
    const reviewCoach = await buildReviewCoach(db, attempts, releasedPractice);
    const classGrades = await studentClassGrades(db, courseId, String(profile.id), sectionIds);
    const courseSummary = buildCourseSummary(classGrades);

    return json({
      profile,
      sections,
      scores,
      attempts,
      portfolio_entries: portfolioEntries,
      released_practice: releasedPractice,
      review_coach: reviewCoach,
      class_grades: classGrades,
      course_summary: courseSummary,
      grading_rule: gradingWeights(),
      recommendations: reviewCoach.recommendations,
      summary: summarize(scores, attempts, portfolioEntries, courseSummary)
    });
  } catch (error) {
    const message = error.message || "Unable to load student progress.";
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
  const { data: enrollments, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("id, section_id, role, status, enrolled_at")
    .eq("profile_id", profileId)
    .eq("role", "student")
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;
  const sectionIds = unique((enrollments || []).map((enrollment) => enrollment.section_id));
  if (!sectionIds.length) return [];

  const { data: sections, error: sectionError } = await db
    .from("course_sections")
    .select("id, course_id, section_code, section_name, meeting_pattern, status")
    .eq("course_id", courseId)
    .in("id", sectionIds);
  if (sectionError) throw sectionError;
  return sections || [];
}

async function loadScores(db: Db, courseId: string, profileId: string, sectionIds: string[]) {
  const { data: scores, error: scoreError } = await db
    .from("gradebook_scores")
    .select("id, gradebook_item_id, section_id, source_attempt_id, score_raw, score_percent, score_final, status, locked_at, updated_at")
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("updated_at", { ascending: false });
  if (scoreError) throw scoreError;
  if (!(scores || []).length) return [];

  const itemIds = unique((scores || []).map((score) => score.gradebook_item_id));
  const { data: items, error: itemError } = await db
    .from("gradebook_items")
    .select("id, course_id, category_id, title, max_score, due_at, status")
    .eq("course_id", courseId)
    .in("id", itemIds);
  if (itemError) throw itemError;
  const categoryIds = unique((items || []).map((item) => item.category_id));
  const { data: categories, error: categoryError } = categoryIds.length
    ? await db
        .from("gradebook_categories")
        .select("id, name")
        .eq("course_id", courseId)
        .in("id", categoryIds)
    : { data: [], error: null };
  if (categoryError) throw categoryError;

  const itemById = new Map((items || []).map((item) => [item.id, item]));
  const categoryById = new Map((categories || []).map((category) => [category.id, category]));
  return (scores || [])
    .filter((score) => itemById.has(score.gradebook_item_id))
    .map((score) => {
      const item = itemById.get(score.gradebook_item_id) || {};
      const category = categoryById.get(item.category_id) || {};
      return {
        score_id: score.id,
        category_id: item.category_id || "",
        item_title: item.title || "Untitled activity",
        category_name: category.name || "",
        max_score: item.max_score,
        due_at: item.due_at,
        score_raw: score.score_raw,
        score_percent: score.score_percent,
        score_final: score.score_final,
        status: score.status,
        locked_at: score.locked_at || "",
        updated_at: score.updated_at
      };
    });
}

async function loadAttempts(db: Db, profileId: string, sectionIds: string[]) {
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, section_id, started_at, submitted_at, status, score_raw, score_percent, score_final")
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("started_at", { ascending: false })
    .limit(20);
  if (attemptError) throw attemptError;
  if (!(attempts || []).length) return [];

  const instanceIds = unique((attempts || []).map((attempt) => attempt.activity_instance_id));
  const { data: instances, error: instanceError } = await db
    .from("activity_instances")
    .select("id, activity_template_id, section_id, class_session_id, state")
    .in("id", instanceIds);
  if (instanceError) throw instanceError;
  const templateIds = unique((instances || []).map((instance) => instance.activity_template_id));
  const { data: templates, error: templateError } = templateIds.length
    ? await db
        .from("activity_templates")
        .select("id, content_item_id, activity_type, grading_mode")
        .in("id", templateIds)
    : { data: [], error: null };
  if (templateError) throw templateError;
  const contentIds = unique((templates || []).map((template) => template.content_item_id));
  const { data: items, error: itemError } = contentIds.length
    ? await db
        .from("content_items")
        .select("id, title, slug, content_type, source_ref")
        .in("id", contentIds)
    : { data: [], error: null };
  if (itemError) throw itemError;

  const instanceById = new Map((instances || []).map((instance) => [instance.id, instance]));
  const templateById = new Map((templates || []).map((template) => [template.id, template]));
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  return (attempts || []).map((attempt) => {
    const instance = instanceById.get(attempt.activity_instance_id) || {};
    const template = templateById.get(instance.activity_template_id) || {};
    const item = itemById.get(template.content_item_id) || {};
    return {
      attempt_id: attempt.id,
      activity_instance_id: attempt.activity_instance_id,
      activity_title: item.title || "Activity",
      activity_type: template.activity_type || "",
      source_ref: item.source_ref || "",
      status: attempt.status,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      score_percent: attempt.score_percent,
      score_final: attempt.score_final
    };
  });
}

async function loadReleasedPractice(db: Db, courseId: string, sectionIds: string[]) {
  const { data: releases, error: releaseError } = await db
    .from("content_releases")
    .select("id, content_item_id, section_id, state, opens_at, closes_at")
    .eq("course_id", courseId)
    .in("state", visibleReleaseStates)
    .order("opens_at", { ascending: true });
  if (releaseError) throw releaseError;

  const now = new Date();
  const visible = (releases || []).filter((release) => isReleaseVisible(release, now, sectionIds));
  const contentIds = unique(visible.map((release) => release.content_item_id));
  if (!contentIds.length) return [];

  const { data: items, error: itemError } = await db
    .from("content_items")
    .select("id, content_type, slug, title, summary, source_ref, default_points")
    .in("id", contentIds);
  if (itemError) throw itemError;
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  return visible
    .map((release) => {
      const item = itemById.get(release.content_item_id);
      if (!item) return null;
      return {
        release_id: release.id,
        title: item.title,
        content_type: item.content_type,
        slug: item.slug,
        summary: item.summary || "",
        source_ref: item.source_ref,
        state: effectiveReleaseState(release, now),
        release_state: release.state,
        default_points: item.default_points
      };
    })
    .filter(Boolean);
}

function isReleaseVisible(release: Record<string, unknown>, now: Date, sectionIds: string[]) {
  const sectionAllowed = !release.section_id || sectionIds.includes(String(release.section_id));
  const scheduledAllowed = String(release.state) !== "scheduled" || isScheduledOpen(release, now);
  const openAllowed = !release.opens_at || new Date(String(release.opens_at)) <= now;
  const closeAllowed =
    !release.closes_at || new Date(String(release.closes_at)) >= now || String(release.state) === "review_only";
  return sectionAllowed && scheduledAllowed && openAllowed && closeAllowed;
}

function isScheduledOpen(release: Record<string, unknown>, now: Date) {
  return String(release.state) === "scheduled" && Boolean(release.opens_at) && new Date(String(release.opens_at)) <= now;
}

function effectiveReleaseState(release: Record<string, unknown>, now: Date) {
  return isScheduledOpen(release, now) ? "released" : String(release.state);
}

async function loadPortfolioEntries(db: Db, courseId: string, profileId: string, sectionIds: string[]) {
  const { data, error } = await db
    .from("portfolio_entries")
    .select("id, section_id, content_item_id, gradebook_category_id, entry_type, entry_json, visibility, created_at, updated_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function buildReviewCoach(db: Db, attempts: Record<string, unknown>[], releasedPractice: Record<string, unknown>[]) {
  const submittedAttemptIds = attempts
    .filter((attempt) => ["submitted", "late"].includes(String(attempt.status)))
    .map((attempt) => String(attempt.attempt_id));
  if (!submittedAttemptIds.length) {
    return {
      weak_topics: [],
      recommendations: releasedPractice.slice(0, 3).map((item) => recommendation("Start practice", "Begin with a released activity to create your first progress signal.", item))
    };
  }

  const { data: responses, error: responseError } = await db
    .from("student_responses")
    .select("student_attempt_id, question_id, points_awarded")
    .in("student_attempt_id", submittedAttemptIds)
    .eq("points_awarded", 0);
  if (responseError) throw responseError;
  const questionIds = unique((responses || []).map((response) => response.question_id));
  if (!questionIds.length) {
    return {
      weak_topics: [],
      recommendations: releasedPractice.slice(0, 3).map((item) => recommendation("Keep momentum", "Your submitted responses do not show weak topics yet. Practice the next released item.", item))
    };
  }

  const { data: questions, error: questionError } = await db
    .from("questions")
    .select("id, topic_tags, difficulty")
    .in("id", questionIds);
  if (questionError) throw questionError;

  const topicCounts = new Map<string, number>();
  (questions || []).forEach((question) => {
    (question.topic_tags || []).forEach((tag: string) => {
      topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
    });
  });

  const weakTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, missed_count]) => ({ topic, missed_count }));

  return {
    weak_topics: weakTopics,
    recommendations: weakTopics.slice(0, 4).map((topic, index) => {
      const item = releasedPractice[index % Math.max(releasedPractice.length, 1)] || {};
      return recommendation(
        `Review ${labelize(topic.topic)}`,
        `You missed ${topic.missed_count} response${topic.missed_count === 1 ? "" : "s"} connected to this topic.`,
        item
      );
    })
  };
}

function recommendation(title: string, body: string, item: Record<string, unknown>) {
  return {
    title,
    body,
    practice_title: item.title || "Review Coach",
    href: item.source_ref || "../review-coach/"
  };
}

/**
 * The course total: the plain average of the class grades so far.
 *
 * Unweighted on purpose. Every class is one grade and every class counts the
 * same, so there is no category to weight and nothing to drop. A student who
 * has sat three classes is told the average of those three, not a fraction of
 * a semester they have not lived through yet.
 */
function buildCourseSummary(classGrades: StudentClassGrade[]) {
  const graded = classGrades.filter((entry) => typeof entry.grade === "number");
  const total = graded.reduce((sum, entry) => sum + Number(entry.grade), 0);
  return {
    // Two decimals, matching how a class grade is stored. Rounding the average
    // harder than its inputs makes 73.96 render as 74 next to a gradebook that
    // says 73.96, and a student comparing the two screens has found a
    // discrepancy that isn't one.
    course_percent: graded.length ? Math.round((total / graded.length) * 100) / 100 : null,
    graded_class_count: graded.length,
    class_count: classGrades.length
  };
}

function summarize(
  scores: Record<string, unknown>[],
  attempts: Record<string, unknown>[],
  portfolioEntries: Record<string, unknown>[],
  courseSummary: { course_percent: number | null; graded_class_count: number }
) {
  return {
    score_count: scores.length,
    attempt_count: attempts.length,
    portfolio_entries: portfolioEntries.length,
    course_percent: courseSummary.course_percent,
    graded_class_count: courseSummary.graded_class_count,
    submitted_attempts: attempts.filter((attempt) => ["submitted", "late"].includes(String(attempt.status))).length
  };
}

function labelize(value: string) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}
