import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertInstitutionalEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";

type Db = ReturnType<typeof adminClient>;

const openStates = ["open", "live"];
const visibleAttemptStates = ["released", "live", "scheduled"];
const maxSpeedBonusPercent = 5;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const profile = await loadProfileForToken(db, token);

    if (body.action === "start_attempt") {
      const result = await startAttempt(db, profile, cleanUuid(body.activity_instance_id, "activity instance id"));
      return json(result);
    }

    if (body.action === "submit_attempt") {
      const result = await submitAttempt(db, profile, {
        attemptId: cleanUuid(body.attempt_id, "attempt id"),
        responses: Array.isArray(body.responses) ? body.responses : []
      });
      return json(result);
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error.message || "Unable to process activity attempt.";
    if (message.includes("not allowed") || message.includes("not enrolled")) {
      return json({ error: message }, { status: 403 });
    }
    return json({ error: message }, { status: 400 });
  }
});

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  assertInstitutionalEmailAllowed(userData.user.email || "");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, student_identifier, full_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Active student profile is not linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function startAttempt(db: Db, profile: Record<string, unknown>, activityInstanceId: string) {
  const instance = await loadActivityInstance(db, activityInstanceId);
  assertActivityOpen(instance);
  await assertStudentEnrollment(db, String(profile.id), String(instance.section_id));
  const release = await assertReleasedForStudent(db, instance);

  const attemptPolicy = await findOrCreateAttempt(db, {
    activityInstanceId,
    profileId: String(profile.id),
    sectionId: String(instance.section_id),
    allowedAttempts: release.allowed_attempts
  });
  assertAttemptWithinTimeLimit(attemptPolicy.attempt, instance);
  const questions = await loadQuestionsForInstance(db, instance);

  return {
    attempt: withAttemptContext(attemptPolicy.attempt, instance, attemptPolicy),
    questions,
    activity_instance: safeInstance(instance)
  };
}

async function submitAttempt(db: Db, profile: Record<string, unknown>, input: {
  attemptId: string;
  responses: Record<string, unknown>[];
}) {
  const attempt = await loadAttempt(db, input.attemptId, String(profile.id));
  if (["submitted", "locked"].includes(String(attempt.status))) {
    throw new Error("This attempt has already been submitted.");
  }

  const instance = await loadActivityInstance(db, String(attempt.activity_instance_id));
  assertActivityOpen(instance);
  await assertStudentEnrollment(db, String(profile.id), String(instance.section_id));
  const release = await assertReleasedForStudent(db, instance);
  assertAttemptWithinTimeLimit(attempt, instance);

  const gradedBase = await gradeResponses(db, input.responses);
  const submittedAt = new Date().toISOString();
  const speedBonus = calculateSpeedBonus({
    scorePercent: gradedBase.score_percent,
    attempt,
    instance,
    submittedAt
  });
  const finalScore = calculateFinalScore(gradedBase.score_percent, speedBonus);
  const graded = {
    ...gradedBase,
    speed_bonus: speedBonus,
    score_final: finalScore
  };
  if (!graded.rows.length) throw new Error("At least one response is required.");

  const { error: deleteError } = await db
    .from("student_responses")
    .delete()
    .eq("student_attempt_id", input.attemptId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await db
    .from("student_responses")
    .insert(graded.rows.map((row) => ({
      student_attempt_id: input.attemptId,
      question_id: row.question_id,
      response_json: row.response_json,
      selected_option_id: row.selected_option_id,
      is_correct: row.is_correct,
      points_awarded: row.points_awarded,
      answered_at: new Date().toISOString()
    })));
  if (insertError) throw insertError;

  const status = instance.ends_at && new Date(instance.ends_at) < new Date() ? "late" : "submitted";
  const { data: updated, error: updateError } = await db
    .from("student_attempts")
    .update({
      submitted_at: submittedAt,
      status,
      score_raw: graded.score_raw,
      score_percent: graded.score_percent,
      speed_bonus: graded.speed_bonus,
      score_final: graded.score_final,
      updated_at: submittedAt
    })
    .eq("id", input.attemptId)
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, speed_bonus, score_final")
    .single();
  if (updateError) throw updateError;
  const gradebookScore = await syncGradebookScore(db, updated, instance, graded);
  const attemptPolicy = await attemptLimitPolicy(db, {
    activityInstanceId: String(updated.activity_instance_id),
    profileId: String(updated.profile_id),
    allowedAttempts: release.allowed_attempts
  });

  return {
    attempt: withAttemptContext(updated, instance, attemptPolicy),
    gradebook_score: gradebookScore,
    score: {
      raw: graded.score_raw,
      total: graded.total_points,
      percent: graded.score_percent,
      speed_bonus: graded.speed_bonus,
      final: graded.score_final
    }
  };
}

async function syncGradebookScore(
  db: Db,
  attempt: Record<string, unknown>,
  instance: Record<string, unknown>,
  graded: { score_raw: number; score_percent: number; speed_bonus: number; score_final: number }
) {
  const { data: item, error: itemError } = await db
    .from("gradebook_items")
    .select("id, course_id, max_score, status")
    .eq("activity_template_id", instance.activity_template_id)
    .in("status", ["published", "closed", "locked"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) return null;

  const { data: existing, error: existingError } = await db
    .from("gradebook_scores")
    .select("id, status, locked_at")
    .eq("gradebook_item_id", item.id)
    .eq("profile_id", attempt.profile_id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing && String(existing.status) === "locked") {
    return {
      id: existing.id,
      status: "locked",
      synced: false,
      locked_at: existing.locked_at
    };
  }

  const now = new Date().toISOString();
  const payload = {
    gradebook_item_id: item.id,
    profile_id: attempt.profile_id,
    section_id: attempt.section_id,
    source_attempt_id: attempt.id,
    score_raw: graded.score_raw,
    score_percent: graded.score_percent,
    score_final: graded.score_final,
    status: "posted",
    updated_at: now
  };

  const scoreResult = existing
    ? await db
        .from("gradebook_scores")
        .update(payload)
        .eq("id", existing.id)
        .select("id, status, score_raw, score_percent, score_final")
        .single()
    : await db
        .from("gradebook_scores")
        .insert(payload)
        .select("id, status, score_raw, score_percent, score_final")
        .single();

  if (scoreResult.error) throw scoreResult.error;
  const score = scoreResult.data;

  const { error: auditError } = await db
    .from("audit_log")
    .insert({
      course_id: item.course_id,
      actor_profile_id: attempt.profile_id,
      target_type: "gradebook_score",
      target_id: score.id,
      action: "score_synced",
      metadata: {
        activity_instance_id: attempt.activity_instance_id,
        source_attempt_id: attempt.id,
        score_percent: graded.score_percent,
        speed_bonus: graded.speed_bonus,
        score_final: graded.score_final
      }
    });
  if (auditError) throw auditError;

  return {
    id: score.id,
    status: score.status,
    synced: true,
    score_raw: score.score_raw,
    score_percent: score.score_percent,
    score_final: score.score_final
  };
}

async function loadActivityInstance(db: Db, activityInstanceId: string) {
  const { data, error } = await db
    .from("activity_instances")
    .select("id, activity_template_id, section_id, class_session_id, state, starts_at, ends_at, time_limit_seconds, randomization_policy, question_count")
    .eq("id", activityInstanceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Activity instance not found.");
  return data;
}

function assertActivityOpen(instance: Record<string, unknown>) {
  if (!openStates.includes(String(instance.state))) {
    throw new Error("Activity is not open for attempts.");
  }
  const now = new Date();
  if (instance.starts_at && new Date(String(instance.starts_at)) > now) {
    throw new Error("Activity is not open yet.");
  }
  if (instance.ends_at && new Date(String(instance.ends_at)) < now) {
    throw new Error("Activity is closed.");
  }
}

function withAttemptContext(
  attempt: Record<string, unknown>,
  instance: Record<string, unknown>,
  policy: { allowedAttempts: number; attemptsUsed: number; attemptsRemaining: number }
) {
  return {
    ...attempt,
    attempt_deadline_at: attemptDeadlineAt(attempt, instance),
    allowed_attempts: policy.allowedAttempts,
    attempts_used: policy.attemptsUsed,
    attempts_remaining: policy.attemptsRemaining
  };
}

function attemptDeadlineAt(attempt: Record<string, unknown>, instance: Record<string, unknown>) {
  const limitSeconds = Number(instance.time_limit_seconds || 0);
  if (!limitSeconds || !attempt.started_at) return null;
  const startedAt = new Date(String(attempt.started_at));
  if (Number.isNaN(startedAt.getTime())) return null;
  return new Date(startedAt.getTime() + limitSeconds * 1000).toISOString();
}

function assertAttemptWithinTimeLimit(attempt: Record<string, unknown>, instance: Record<string, unknown>) {
  const status = String(attempt.status || "");
  if (["submitted", "locked", "late"].includes(status) || attempt.submitted_at) {
    return;
  }

  const deadline = attemptDeadlineAt(attempt, instance);
  if (deadline && new Date(deadline) <= new Date()) {
    throw new Error("Activity time limit has expired.");
  }
}

function calculateSpeedBonus(input: {
  scorePercent: number;
  attempt: Record<string, unknown>;
  instance: Record<string, unknown>;
  submittedAt: string;
}) {
  const scorePercent = Number(input.scorePercent || 0);
  const limitSeconds = Number(input.instance.time_limit_seconds || 0);
  if (scorePercent <= 0 || !limitSeconds || !input.attempt.started_at) return 0;

  const startedAt = new Date(String(input.attempt.started_at)).getTime();
  const submittedAt = new Date(input.submittedAt).getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(submittedAt) || submittedAt < startedAt) return 0;

  const elapsedSeconds = (submittedAt - startedAt) / 1000;
  const remainingRatio = Math.max(0, Math.min(1, (limitSeconds - elapsedSeconds) / limitSeconds));
  const correctnessWeight = Math.max(0, Math.min(1, scorePercent / 100));
  return round1(maxSpeedBonusPercent * correctnessWeight * remainingRatio);
}

function calculateFinalScore(scorePercent: number, speedBonus: number) {
  return Math.min(100, round1(scorePercent + speedBonus));
}

function round1(value: number) {
  return Math.round(Number(value || 0) * 10) / 10;
}

async function assertStudentEnrollment(db: Db, profileId: string, sectionId: string) {
  const { data, error } = await db
    .from("section_enrollments")
    .select("id")
    .eq("profile_id", profileId)
    .eq("section_id", sectionId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Student is not enrolled in this activity section.");
}

async function assertReleasedForStudent(db: Db, instance: Record<string, unknown>) {
  const { data: template, error: templateError } = await db
    .from("activity_templates")
    .select("id, content_item_id")
    .eq("id", instance.activity_template_id)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) throw new Error("Activity template was not found.");

  const { data: releases, error: releaseError } = await db
    .from("content_releases")
    .select("id, section_id, state, opens_at, closes_at, allowed_attempts")
    .eq("content_item_id", template.content_item_id)
    .in("state", visibleAttemptStates);
  if (releaseError) throw releaseError;

  const now = new Date();
  const sectionId = String(instance.section_id);
  const allowed = (releases || []).filter((release) => isReleaseVisibleForAttempt(release, now, sectionId));
  if (!allowed.length) {
    const waitingOnSchedule = (releases || []).some((release) => {
      const sectionAllowed = !release.section_id || String(release.section_id) === sectionId;
      return sectionAllowed && String(release.state) === "scheduled" && !isScheduledOpen(release, now);
    });
    if (waitingOnSchedule) throw new Error("Activity is not allowed: scheduled release is not open yet.");
    throw new Error("Activity is not allowed for this section.");
  }

  return allowed.sort((a, b) => {
    const sectionPriority = Number(Boolean(b.section_id)) - Number(Boolean(a.section_id));
    if (sectionPriority) return sectionPriority;
    return Number(b.allowed_attempts || 1) - Number(a.allowed_attempts || 1);
  })[0];
}

function isReleaseVisibleForAttempt(release: Record<string, unknown>, now: Date, sectionId: string) {
  const sectionAllowed = !release.section_id || String(release.section_id) === sectionId;
  const scheduledAllowed = String(release.state) !== "scheduled" || isScheduledOpen(release, now);
  const openAllowed = !release.opens_at || new Date(String(release.opens_at)) <= now;
  const closeAllowed = !release.closes_at || new Date(String(release.closes_at)) >= now;
  return sectionAllowed && scheduledAllowed && openAllowed && closeAllowed;
}

function isScheduledOpen(release: Record<string, unknown>, now: Date) {
  return String(release.state) === "scheduled" && Boolean(release.opens_at) && new Date(String(release.opens_at)) <= now;
}

async function findOrCreateAttempt(db: Db, input: {
  activityInstanceId: string;
  profileId: string;
  sectionId: string;
  allowedAttempts: unknown;
}) {
  const policy = await attemptLimitPolicy(db, input);
  const openAttempt = policy.attempts.find((attempt) => !isClosedAttempt(attempt));
  if (openAttempt) {
    return {
      attempt: openAttempt,
      allowedAttempts: policy.allowedAttempts,
      attemptsUsed: policy.attemptsUsed,
      attemptsRemaining: policy.attemptsRemaining
    };
  }

  if (policy.attemptsUsed >= policy.allowedAttempts) {
    throw new Error("No attempts are remaining for this activity.");
  }

  const nextAttemptNumber = Math.max(0, ...policy.attempts.map((attempt) => Number(attempt.attempt_number || 1))) + 1;

  const { data, error } = await db
    .from("student_attempts")
    .insert({
      activity_instance_id: input.activityInstanceId,
      profile_id: input.profileId,
      section_id: input.sectionId,
      attempt_number: nextAttemptNumber,
      status: "started"
    })
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, score_final")
    .single();
  if (error) throw error;

  return {
    attempt: data,
    allowedAttempts: policy.allowedAttempts,
    attemptsUsed: policy.attemptsUsed + 1,
    attemptsRemaining: Math.max(0, policy.allowedAttempts - (policy.attemptsUsed + 1))
  };
}

async function attemptLimitPolicy(db: Db, input: {
  activityInstanceId: string;
  profileId: string;
  allowedAttempts: unknown;
}) {
  const allowedAttempts = normalizeAllowedAttempts(input.allowedAttempts);
  const { data: attempts, error } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, score_final")
    .eq("activity_instance_id", input.activityInstanceId)
    .eq("profile_id", input.profileId)
    .order("attempt_number", { ascending: true });
  if (error) throw error;

  const attemptsUsed = (attempts || []).length;
  return {
    attempts: attempts || [],
    allowedAttempts,
    attemptsUsed,
    attemptsRemaining: Math.max(0, allowedAttempts - attemptsUsed)
  };
}

function normalizeAllowedAttempts(value: unknown) {
  const attempts = Number(value || 1);
  if (!Number.isFinite(attempts)) return 1;
  return Math.min(20, Math.max(1, Math.trunc(attempts)));
}

function isClosedAttempt(attempt: Record<string, unknown>) {
  return Boolean(attempt.submitted_at) || ["submitted", "late", "excused", "missing", "locked"].includes(String(attempt.status || ""));
}

async function loadQuestionsForInstance(db: Db, instance: Record<string, unknown>) {
  const { data: template, error: templateError } = await db
    .from("activity_templates")
    .select("id, content_item_id, max_score")
    .eq("id", instance.activity_template_id)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) return [];

  const { data: banks, error: bankError } = await db
    .from("question_banks")
    .select("id")
    .eq("content_item_id", template.content_item_id)
    .eq("status", "active")
    .limit(5);
  if (bankError) throw bankError;
  const bankIds = (banks || []).map((bank) => bank.id);
  if (!bankIds.length) return [];

  const { data: questions, error: questionError } = await db
    .from("questions")
    .select("id, prompt, question_type, difficulty, topic_tags, points")
    .in("question_bank_id", bankIds)
    .eq("status", "active");
  if (questionError) throw questionError;

  const selectedQuestions = selectQuestions(questions || [], Number(instance.question_count || 0), String(instance.randomization_policy || "none"));
  const questionIds = selectedQuestions.map((question) => question.id);
  if (!questionIds.length) return [];

  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("id, question_id, option_text, position")
    .in("question_id", questionIds)
    .order("position", { ascending: true });
  if (optionError) throw optionError;

  const optionsByQuestion = new Map<string, Record<string, unknown>[]>();
  (options || []).forEach((option) => {
    const key = String(option.question_id);
    if (!optionsByQuestion.has(key)) optionsByQuestion.set(key, []);
    optionsByQuestion.get(key)!.push({
      id: option.id,
      option_text: option.option_text,
      position: option.position
    });
  });

  return selectedQuestions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    question_type: question.question_type,
    difficulty: question.difficulty,
    topic_tags: question.topic_tags || [],
    points: question.points,
    options: maybeShuffle(optionsByQuestion.get(String(question.id)) || [], String(instance.randomization_policy || "none").includes("options"))
  }));
}

function selectQuestions(questions: Record<string, unknown>[], count: number, policy: string) {
  const pool = policy.includes("shuffle") || policy.includes("random") ? maybeShuffle(questions, true) : [...questions];
  return count > 0 ? pool.slice(0, count) : pool;
}

function maybeShuffle<T>(values: T[], shouldShuffle: boolean) {
  if (!shouldShuffle) return [...values];
  return [...values].sort(() => Math.random() - 0.5);
}

async function loadAttempt(db: Db, attemptId: string, profileId: string) {
  const { data, error } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status")
    .eq("id", attemptId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Attempt not found for this profile.");
  return data;
}

async function gradeResponses(db: Db, responses: Record<string, unknown>[]) {
  const cleaned = responses
    .map((response) => ({
      question_id: cleanUuid(response.question_id, "question id"),
      selected_option_id: response.selected_option_id ? cleanUuid(response.selected_option_id, "selected option id") : null,
      response_json: normalizeResponseJson(response.response_json)
    }))
    .filter((response) => response.question_id);

  const questionIds = Array.from(new Set(cleaned.map((response) => response.question_id)));
  const optionIds = Array.from(new Set(cleaned.map((response) => response.selected_option_id).filter(Boolean))) as string[];

  const [{ data: questions, error: questionError }, { data: options, error: optionError }] = await Promise.all([
    db
      .from("questions")
      .select("id, points")
      .in("id", questionIds),
    optionIds.length
      ? db
          .from("question_options")
          .select("id, question_id, is_correct")
          .in("id", optionIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (questionError) throw questionError;
  if (optionError) throw optionError;

  const questionById = new Map((questions || []).map((question) => [question.id, question]));
  const optionById = new Map((options || []).map((option) => [option.id, option]));
  let scoreRaw = 0;
  let totalPoints = 0;

  const rows = cleaned.map((response) => {
    const question = questionById.get(response.question_id);
    if (!question) throw new Error("Submitted question was not found.");
    const points = Number(question.points || 0);
    totalPoints += points;
    const selected = response.selected_option_id ? optionById.get(response.selected_option_id) : null;
    const belongsToQuestion = selected && String(selected.question_id) === response.question_id;
    const isCorrect = Boolean(belongsToQuestion && selected.is_correct);
    const pointsAwarded = isCorrect ? points : 0;
    scoreRaw += pointsAwarded;
    return {
      question_id: response.question_id,
      selected_option_id: response.selected_option_id,
      response_json: response.response_json,
      is_correct: response.selected_option_id ? isCorrect : null,
      points_awarded: pointsAwarded
    };
  });

  return {
    rows,
    score_raw: scoreRaw,
    total_points: totalPoints,
    score_percent: totalPoints ? Math.round((scoreRaw / totalPoints) * 1000) / 10 : 0
  };
}

function normalizeResponseJson(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function safeInstance(instance: Record<string, unknown>) {
  return {
    id: instance.id,
    section_id: instance.section_id,
    class_session_id: instance.class_session_id,
    state: instance.state,
    starts_at: instance.starts_at,
    ends_at: instance.ends_at,
    time_limit_seconds: instance.time_limit_seconds,
    question_count: instance.question_count
  };
}
