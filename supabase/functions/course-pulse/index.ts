// Live in-lecture pulse questions.
//
// Instructor actions: push (open a question), reveal (show the answer and the
// distribution), close, results (one round, live), rounds (every round of a
// finished class, for the per-class review in the gradebook), attendance (how
// many students have scanned in, for the count above the QR code).
// Student actions: current (what should I see right now), answer (one shot).
//
// Grading is hybrid and happens here, at answer time: answering earns
// answer_points, answering correctly earns the full points. The award is mirrored
// into participation_events so the existing gradebook picks it up unchanged.
//
// Correctness is never sent to a student before the instructor reveals — the
// snapshot's correct_key is stripped on the way out.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { assertCheckpointPushMatches } from "../_shared/pulse-checkpoint.ts";
import { classDateFor, loadCheckInAt } from "../_shared/attendance.ts";
import {
  allowedPulseSourceStates,
  isPulseTransitionIdempotent,
  pulseTargetState,
  type PulseTransitionAction
} from "../_shared/pulse-transition.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const stablePulsePlanErrorCodes = new Set([
  "class_question_plan_checkpoint_id_invalid",
  "class_question_plan_checkpoint_locked",
  "class_question_plan_checkpoint_not_found",
  "class_question_plan_payload_invalid",
  "class_question_plan_question_id_invalid",
  "class_question_plan_question_not_candidate",
  "class_question_plan_question_unavailable"
]);

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const token = bearerToken(request.headers.get("Authorization"));
    if (!token) return json({ error: "Sign in is required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = adminClient();
    const courseId = cleanCourseId(body.course_id) || "tc2007b";
    const profile = await loadProfileForToken(db, token);
    const roles = await loadRoles(db, courseId, String(profile.id));
    const isTeacher = roles.some((role) => teacherRoles.includes(role));
    const isInstructor = roles.some((role) => instructorRoles.includes(role));
    const isGlobalOwner = roles.includes("platform_owner");
    const permittedSectionIds = isGlobalOwner ? [] : await loadPermittedSectionIds(db, String(profile.id), courseId);
    if (isTeacher && !isGlobalOwner && !permittedSectionIds.length) {
      throw new Error("You are not allowed to run pulses for this course.");
    }
    if (isTeacher && body.action !== "answer") {
      const sectionId = await pulseSectionForRequest(db, courseId, body);
      if (!isGlobalOwner && !permittedSectionIds.includes(sectionId)) {
        throw new Error("You are not allowed to run pulses for this class section.");
      }
    }

    switch (body.action) {
      case "push": {
        requireInstructor(isInstructor);
        return json(await pushRound(db, courseId, String(profile.id), body));
      }
      case "reveal":
      case "close": {
        requireInstructor(isInstructor);
        return json(await setRoundState(db, courseId, body, body.action));
      }
      case "results": {
        if (!isTeacher) throw new Error("Pulse results are not allowed for this role.");
        return json(await loadResults(db, courseId, cleanUuid(body.round_id, "round id"), true));
      }
      case "rounds": {
        if (!isTeacher) throw new Error("Pulse results are not allowed for this role.");
        return json(await loadSessionRounds(db, courseId, body));
      }
      case "attendance": {
        if (!isTeacher) throw new Error("Pulse results are not allowed for this role.");
        return json(await loadAttendanceCount(db, courseId, body));
      }
      case "current": {
        return json(await loadCurrent(db, courseId, String(profile.id), body, isTeacher));
      }
      case "answer": {
        return json(await recordAnswer(db, courseId, String(profile.id), body));
      }
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const code = stablePulseErrorCode(error);
    if (code) return json({ error: code, error_code: code }, { status: 400 });
    const message = error?.message || "Unable to run the pulse.";
    if (message.includes("not allowed") || message.includes("not enrolled")) {
      return json({ error: message }, { status: 403 });
    }
    return json({ error: message }, { status: 400 });
  }
});

function requireInstructor(isInstructor: boolean) {
  if (!isInstructor) throw new Error("Running a pulse is not allowed for this role.");
}

function bearerToken(value: string | null) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cleanCourseId(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function cleanUuid(value: unknown, label: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return text;
}

function cleanUuidCode(value: unknown, code: string) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(code);
  }
  return text;
}

function stablePulseErrorCode(error: unknown) {
  const message = error instanceof Error
    ? error.message.trim()
    : typeof error === "object" && error && "message" in error && typeof error.message === "string"
    ? error.message.trim()
    : "";
  return stablePulsePlanErrorCodes.has(message) ? message : null;
}

async function loadProfileForToken(db: Db, token: string) {
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Invalid or expired session.");
  await assertCourseEmailAllowed(db, userData.user.email || "");

  const { data: profile, error } = await db
    .from("profiles")
    .select("id, auth_user_id, institutional_email, full_name, preferred_name, status")
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("No active course profile is linked to this account.");
  assertProfileMatchesAuthEmail(profile, userData.user.email || "");
  return profile;
}

async function loadRoles(db: Db, courseId: string, profileId: string) {
  const { data, error } = await db
    .from("course_memberships")
    .select("role, status")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).map((row) => String(row.role));
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
  return Array.from(new Set((data || []).map((row) => String(row.section_id))));
}

async function pulseSectionForRequest(db: Db, courseId: string, body: Record<string, unknown>) {
  if (["push", "rounds", "current", "attendance"].includes(String(body.action))) {
    const session = await loadSession(db, courseId, cleanUuid(body.class_session_id, "class session id"));
    return String(session.section_id);
  }
  const roundId = cleanUuid(body.round_id, "round id");
  const { data: round, error } = await db
    .from("pulse_rounds")
    .select("section_id, course_id")
    .eq("id", roundId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!round) throw new Error("That pulse round was not found.");
  return String(round.section_id);
}

async function loadSession(db: Db, courseId: string, sessionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, state, sequence_number, title, content_item_id")
    .eq("id", sessionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That class session was not found.");
  return data;
}

/** Freeze the question, shuffle nothing server-side (the client shuffles for
 *  display; grading is by key, so order never matters here). */
function buildSnapshot(input: Record<string, unknown>) {
  const text = String(input.text || "").trim();
  if (text.length < 4) throw new Error("The pulse question needs some text.");
  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = rawOptions
    .map((option, index) => ({
      key: String((option as Record<string, unknown>)?.key || `o${index + 1}`).slice(0, 40),
      text: String((option as Record<string, unknown>)?.text || "").trim().slice(0, 400),
      text_es: String((option as Record<string, unknown>)?.text_es || "").trim().slice(0, 400) || null
    }))
    .filter((option) => option.text);
  if (options.length < 2) throw new Error("A pulse needs at least two options.");
  if (options.length > 6) throw new Error("A pulse takes at most six options.");
  const correctKey = String(input.correct_key || "").trim();
  if (!options.some((option) => option.key === correctKey)) {
    throw new Error("One option must be marked correct.");
  }
  return {
    text: text.slice(0, 600),
    text_es: String(input.text_es || "").trim().slice(0, 600) || null,
    options,
    correct_key: correctKey,
    segment_key: String(input.segment_key || "").trim() || null,
    checkpoint_after_slide:
      Number.isInteger(Number(input.checkpoint_after_slide))
      && Number(input.checkpoint_after_slide) > 0
        ? Number(input.checkpoint_after_slide)
        : null
  };
}

async function loadBankQuestion(db: Db, courseId: string, questionId: string) {
  const { data: question, error } = await db
    .from("questions")
    .select("id, question_bank_id, prompt, prompt_es, question_type, status, segment_key, checkpoint_after_slide")
    .eq("id", questionId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!question) throw new Error("That active question was not found in the bank.");

  const { data: bank, error: bankError } = await db
    .from("question_banks")
    .select("id, course_id, content_item_id, status")
    .eq("id", question.question_bank_id)
    .eq("course_id", courseId)
    .eq("status", "active")
    .maybeSingle();
  if (bankError) throw bankError;
  if (!bank) throw new Error("That question bank is not active for this course.");

  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("id, option_text, option_text_es, is_correct, position")
    .eq("question_id", questionId)
    .order("position", { ascending: true });
  if (optionError) throw optionError;

  const mapped = (options || []).map((option) => ({
    key: String(option.id),
    text: String(option.option_text || ""),
    text_es: String(option.option_text_es || "") || null
  }));
  const correct = (options || []).find((option) => option.is_correct);
  if (!correct) throw new Error("That bank question has no correct option.");
  return {
    questionId: String(question.id),
    bankContentItemId: String(bank.content_item_id || ""),
    checkpointAfterSlide: question.checkpoint_after_slide,
    snapshot: buildSnapshot({
      text: question.prompt,
      text_es: question.prompt_es,
      options: mapped,
      correct_key: String(correct.id),
      segment_key: question.segment_key,
      checkpoint_after_slide: question.checkpoint_after_slide
    })
  };
}

async function pushRound(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);
  if (String(session.state) !== "live") {
    throw new Error("Start the class session before pushing a pulse.");
  }

  const hasQuestionId = body.question_id !== undefined && body.question_id !== null;
  const planCheckpointId = body.plan_checkpoint_id === undefined || body.plan_checkpoint_id === null
    ? null
    : cleanUuidCode(body.plan_checkpoint_id, "class_question_plan_checkpoint_id_invalid");
  const hasCheckpoint = (
    body.checkpoint_after_slide !== undefined
    && body.checkpoint_after_slide !== null
  );
  if (planCheckpointId && hasCheckpoint) {
    throw new Error("class_question_plan_payload_invalid");
  }
  if (planCheckpointId && !hasQuestionId) {
    throw new Error("class_question_plan_question_id_invalid");
  }
  if (!planCheckpointId && hasQuestionId !== hasCheckpoint) {
    throw new Error("A bank question and slide checkpoint must be supplied together.");
  }

  const questionId = hasQuestionId
    ? planCheckpointId
      ? cleanUuidCode(body.question_id, "class_question_plan_question_id_invalid")
      : cleanUuid(body.question_id, "question id")
    : "";
  const requestedCheckpoint = hasCheckpoint
    ? Number(body.checkpoint_after_slide)
    : null;
  if (
    hasCheckpoint
    && (!Number.isInteger(requestedCheckpoint) || Number(requestedCheckpoint) < 1)
  ) {
    throw new Error("The checkpoint slide must be a positive integer.");
  }

  let bankQuestion = null;
  if (planCheckpointId) {
    try {
      bankQuestion = await loadBankQuestion(db, courseId, questionId);
    } catch {
      throw new Error("class_question_plan_question_unavailable");
    }
  } else if (questionId) {
    bankQuestion = await loadBankQuestion(db, courseId, questionId);
  }
  if (!planCheckpointId && bankQuestion) {
    assertCheckpointPushMatches({
      sessionState: session.state,
      sessionContentItemId: session.content_item_id,
      bankContentItemId: bankQuestion.bankContentItemId,
      questionCheckpoint: bankQuestion.checkpointAfterSlide,
      requestedCheckpoint
    });
  }

  const snapshot = bankQuestion
    ? bankQuestion.snapshot
    : buildSnapshot((body.question as Record<string, unknown>) || {});

  const timeLimit = Math.min(900, Math.max(10, Number(body.time_limit_seconds) || 60));
  const points = Math.min(100, Math.max(0, Number(body.points ?? 1)));
  // Hybrid grading: half credit for answering, unless the caller overrides.
  const answerPoints = Math.min(
    points,
    Math.max(0, body.answer_points === undefined ? points / 2 : Number(body.answer_points))
  );

  const now = new Date();
  const endsAt = new Date(now.getTime() + timeLimit * 1000).toISOString();
  if (planCheckpointId) {
    const { data: round, error } = await db
      .rpc("push_class_question_plan_round", {
        p_course_id: courseId,
        p_class_session_id: sessionId,
        p_section_id: session.section_id,
        p_question_id: bankQuestion ? bankQuestion.questionId : null,
        p_plan_checkpoint_id: planCheckpointId,
        p_prompt_snapshot: snapshot,
        p_points: points,
        p_answer_points: answerPoints,
        p_time_limit_seconds: timeLimit,
        p_opened_at: now.toISOString(),
        p_ends_at: endsAt,
        p_created_by: actorProfileId
      })
      .single();
    if (error) throw error;

    await db.from("audit_log").insert({
      course_id: courseId,
      actor_profile_id: actorProfileId,
      target_type: "pulse_round",
      target_id: round?.id || null,
      action: "pulse_pushed",
      metadata: {
        class_session_id: sessionId,
        question_id: bankQuestion?.questionId || null,
        plan_checkpoint_id: planCheckpointId,
        checkpoint_after_slide: requestedCheckpoint,
        points,
        time_limit_seconds: timeLimit
      }
    });

    return { round: teacherRound(round) };
  }

  // Only one question can be open at a time — close any leftovers first so a
  // student phone is never showing two questions.
  await db
    .from("pulse_rounds")
    .update({ state: "closed", closed_at: new Date().toISOString() })
    .eq("class_session_id", sessionId)
    .eq("state", "open");

  const { data: round, error } = await db
    .from("pulse_rounds")
    .insert({
      course_id: courseId,
      class_session_id: sessionId,
      section_id: session.section_id,
      question_id: bankQuestion ? bankQuestion.questionId : null,
      plan_checkpoint_id: planCheckpointId || null,
      prompt_snapshot: snapshot,
      state: "open",
      points,
      answer_points: answerPoints,
      time_limit_seconds: timeLimit,
      opened_at: now.toISOString(),
      ends_at: endsAt,
      created_by: actorProfileId
    })
    .select("id, state, points, answer_points, time_limit_seconds, opened_at, ends_at, revealed_at, prompt_snapshot")
    .maybeSingle();
  if (error) throw error;

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "pulse_round",
    target_id: round?.id || null,
    action: "pulse_pushed",
    metadata: {
      class_session_id: sessionId,
      question_id: bankQuestion?.questionId || null,
      plan_checkpoint_id: planCheckpointId,
      checkpoint_after_slide: requestedCheckpoint,
      points,
      time_limit_seconds: timeLimit
    }
  });

  return { round: teacherRound(round) };
}

async function setRoundState(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  action: PulseTransitionAction
) {
  const roundId = cleanUuid(body.round_id, "round id");
  const nextState = pulseTargetState(action);
  const stamp = nextState === "revealed" ? { revealed_at: new Date().toISOString() } : { closed_at: new Date().toISOString() };
  const { data: round, error } = await db
    .from("pulse_rounds")
    .update({ state: nextState, ...stamp })
    .eq("id", roundId)
    .eq("course_id", courseId)
    .in("state", allowedPulseSourceStates(action))
    .select("id, state, points, answer_points, time_limit_seconds, opened_at, ends_at, revealed_at, prompt_snapshot")
    .maybeSingle();
  if (error) throw error;
  if (round) {
    const results = await loadResults(db, courseId, roundId, true);
    return { round: teacherRound(round), ...results };
  }

  const { data: existing, error: existingError } = await db
    .from("pulse_rounds")
    .select("id, state, points, answer_points, time_limit_seconds, opened_at, ends_at, revealed_at, prompt_snapshot")
    .eq("id", roundId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("That pulse round was not found.");
  if (!isPulseTransitionIdempotent(existing.state, action)) {
    throw new Error(
      action === "reveal"
        ? "That pulse round is already closed."
        : "That pulse round cannot be closed from its current state."
    );
  }
  const results = await loadResults(db, courseId, roundId, true);
  return { round: teacherRound(existing), ...results };
}

function teacherRound(round: Record<string, unknown> | null) {
  if (!round) return null;
  const snapshot = (round.prompt_snapshot || {}) as Record<string, unknown>;
  return {
    round_id: round.id,
    state: round.state,
    points: round.points,
    answer_points: round.answer_points,
    time_limit_seconds: round.time_limit_seconds,
    opened_at: round.opened_at,
    ends_at: round.ends_at,
    // The cockpit retires a revealed question on the same clock the students'
    // phones already use (revealDisplayMinutes below). Without this the two
    // surfaces disagree: the phones move on, the panel keeps the question.
    revealed_at: round.revealed_at ?? null,
    text: snapshot.text,
    text_es: snapshot.text_es,
    options: snapshot.options,
    correct_key: snapshot.correct_key,
    segment_key: snapshot.segment_key || null,
    checkpoint_after_slide: snapshot.checkpoint_after_slide || null
  };
}

/** What a student may see: never the correct key while the round is open. */
function studentRound(round: Record<string, unknown>, revealed: boolean) {
  const snapshot = (round.prompt_snapshot || {}) as Record<string, unknown>;
  return {
    round_id: round.id,
    state: round.state,
    points: round.points,
    time_limit_seconds: round.time_limit_seconds,
    opened_at: round.opened_at,
    ends_at: round.ends_at,
    // The cockpit retires a revealed question on the same clock the students'
    // phones already use (revealDisplayMinutes below). Without this the two
    // surfaces disagree: the phones move on, the panel keeps the question.
    revealed_at: round.revealed_at ?? null,
    text: snapshot.text,
    text_es: snapshot.text_es,
    options: snapshot.options,
    correct_key: revealed ? snapshot.correct_key : null,
    segment_key: snapshot.segment_key || null,
    checkpoint_after_slide: snapshot.checkpoint_after_slide || null
  };
}

async function loadResults(db: Db, courseId: string, roundId: string, includeNames: boolean) {
  const { data: round, error: roundError } = await db
    .from("pulse_rounds")
    .select("id, course_id, class_session_id, section_id, state, points, prompt_snapshot")
    .eq("id", roundId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (roundError) throw roundError;
  if (!round) throw new Error("That pulse round was not found.");

  const { data: answers, error: answerError } = await db
    .from("pulse_answers")
    .select("profile_id, option_key, is_correct, points_awarded, latency_ms, answered_at")
    .eq("round_id", roundId);
  if (answerError) throw answerError;

  const snapshot = (round.prompt_snapshot || {}) as { options?: Array<{ key: string; text: string }> };
  const counts = new Map<string, number>();
  for (const answer of answers || []) {
    counts.set(String(answer.option_key), (counts.get(String(answer.option_key)) || 0) + 1);
  }
  const distribution = (snapshot.options || []).map((option) => ({
    key: option.key,
    text: option.text,
    count: counts.get(option.key) || 0
  }));

  // How many students could have answered, so "12 of 30" is meaningful.
  const { count: enrolled } = await db
    .from("section_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("section_id", round.section_id)
    .eq("role", "student")
    .eq("status", "active");

  // How many are actually in the room. `enrolled` is the roster and includes
  // every absent student, so "everyone has answered" can never be true against
  // it. Only the students who scanned in can answer, so they are the ones a
  // completeness check has to count.
  // Counted for *today*. Since 0048 a class resumed on a second day has two
  // attendance rows for anyone who came to both, and counting them all would
  // inflate this denominator past the number of people who can actually answer
  // — making "everyone has answered" unreachable, which is the condition that
  // reveals a question without the professor leaving fullscreen.
  const { count: present } = await db
    .from("class_attendance")
    .select("id", { count: "exact", head: true })
    .eq("class_session_id", round.class_session_id)
    .eq("attendance_date", classDateFor());

  let respondents: Array<Record<string, unknown>> = [];
  if (includeNames && (answers || []).length) {
    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("id, full_name, preferred_name, student_identifier")
      .in("id", (answers || []).map((answer) => answer.profile_id));
    if (profileError) throw profileError;
    const byId = new Map((profiles || []).map((p) => [String(p.id), p]));
    respondents = (answers || []).map((answer) => {
      const person = byId.get(String(answer.profile_id)) || {};
      return {
        profile_id: answer.profile_id,
        name: person.preferred_name || person.full_name || "Student",
        student_identifier: person.student_identifier || null,
        option_key: answer.option_key,
        is_correct: answer.is_correct,
        points_awarded: answer.points_awarded,
        latency_ms: answer.latency_ms
      };
    });
  }

  return {
    round_id: roundId,
    state: round.state,
    answered: (answers || []).length,
    correct: (answers || []).filter((answer) => answer.is_correct).length,
    enrolled: enrolled ?? 0,
    present: present ?? 0,
    distribution,
    correct_key: round.state === "open" ? null : (round.prompt_snapshot as Record<string, unknown>).correct_key,
    respondents
  };
}

/**
 * Every pulse round of one class session, in the order they were asked, each
 * with its distribution. This is the after-class review — loadResults answers
 * "what is happening right now" for a single round, which would be an N+1 here,
 * so answers and enrollment are fetched once for the whole session instead.
 *
 * Correctness is not withheld: by the time anyone reads this the class is over,
 * and only a teacher role reaches it.
 */
async function loadSessionRounds(db: Db, courseId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);

  const { data: rounds, error: roundError } = await db
    .from("pulse_rounds")
    .select("id, state, points, opened_at, prompt_snapshot")
    .eq("course_id", courseId)
    .eq("class_session_id", sessionId)
    .order("opened_at", { ascending: true });
  if (roundError) throw roundError;
  if (!(rounds || []).length) return { rounds: [] };

  const roundIds = (rounds || []).map((round) => String(round.id));
  const [{ data: answers, error: answerError }, { count: enrolled }] = await Promise.all([
    db.from("pulse_answers").select("round_id, option_key, is_correct").in("round_id", roundIds),
    db.from("section_enrollments").select("id", { count: "exact", head: true })
      .eq("section_id", session.section_id).eq("role", "student").eq("status", "active")
  ]);
  if (answerError) throw answerError;

  const byRound = new Map<string, Array<{ option_key: string; is_correct: boolean }>>();
  for (const answer of answers || []) {
    const key = String(answer.round_id);
    if (!byRound.has(key)) byRound.set(key, []);
    byRound.get(key)!.push({
      option_key: String(answer.option_key),
      is_correct: Boolean(answer.is_correct)
    });
  }

  return {
    rounds: (rounds || []).map((round) => {
      const snapshot = (round.prompt_snapshot || {}) as {
        text?: string;
        options?: Array<{ key: string; text: string; text_es?: string | null }>;
        correct_key?: string;
      };
      const mine = byRound.get(String(round.id)) || [];
      const counts = new Map<string, number>();
      for (const answer of mine) {
        counts.set(answer.option_key, (counts.get(answer.option_key) || 0) + 1);
      }
      return {
        round_id: round.id,
        state: round.state,
        opened_at: round.opened_at,
        points: round.points,
        text: snapshot.text || "",
        correct_key: snapshot.correct_key ?? null,
        answered: mine.length,
        correct: mine.filter((answer) => answer.is_correct).length,
        enrolled: enrolled ?? 0,
        distribution: (snapshot.options || []).map((option) => ({
          key: option.key,
          text: option.text,
          count: counts.get(option.key) || 0
        }))
      };
    })
  };
}

/**
 * How many students are in the room right now, for the counter the professor
 * watches above the QR code while the class files in.
 *
 * Deliberately not folded into `current` or `results`: this is polled for the
 * whole hour, including *before* the class goes live and while no question is
 * open, and `current` costs four queries plus a full results load. Two counting
 * queries with `head: true` return no rows at all.
 *
 * Counted for today, the same way `loadResults` counts `present` — a class
 * paused and resumed on a second day has an attendance row per day since 0048,
 * and counting them all would show a room fuller than the one in front of him.
 */
async function loadAttendanceCount(db: Db, courseId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);
  const attendanceDate = classDateFor();

  const [{ count: present }, { count: enrolled }] = await Promise.all([
    db
      .from("class_attendance")
      .select("id", { count: "exact", head: true })
      .eq("class_session_id", sessionId)
      .eq("attendance_date", attendanceDate),
    db
      .from("section_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("section_id", session.section_id)
      .eq("role", "student")
      .eq("status", "active")
  ]);

  return {
    class_session_id: sessionId,
    attendance_date: attendanceDate,
    present: present ?? 0,
    enrolled: enrolled ?? 0
  };
}

async function loadCurrent(
  db: Db,
  courseId: string,
  profileId: string,
  body: Record<string, unknown>,
  isTeacher: boolean
) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);

  if (!isTeacher) {
    const { data: enrollment, error } = await db
      .from("section_enrollments")
      .select("id")
      .eq("profile_id", profileId)
      .eq("section_id", session.section_id)
      .eq("role", "student")
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!enrollment) throw new Error("You are not enrolled in this class section.");
  }

  // Same one poll drives the whole "in class" screen: pulse takes priority,
  // then the quiz, then the reflection — matching the order the professor
  // actually moves through a class (pulses during the lecture, quiz at the
  // end, reflection last). Nothing here is typed by the instructor; it just
  // reports what Run Class has already done.
  const [pulseInfo, quizInfo, reflectionInfo, checkedInAt] = await Promise.all([
    loadCurrentPulse(db, courseId, profileId, sessionId, isTeacher),
    loadCurrentQuiz(db, sessionId),
    loadReflectionStatus(db, sessionId, profileId),
    loadCheckInAt(db, sessionId, profileId)
  ]);

  return {
    session_state: session.state,
    // The live screen is gated on this, not on localStorage: a student on a
    // second device, or in private browsing, has no stored join but does have a
    // check-in row. The server is the only thing that knows they scanned.
    // Teachers are never gated — they are running the class, not attending it.
    checked_in: isTeacher || Boolean(checkedInAt),
    checked_in_at: checkedInAt,
    ...pulseInfo,
    quiz: quizInfo,
    reflection: reflectionInfo
  };
}


// How long a revealed answer stays on screen before the live view moves on.
// Without this, an instructor who forgets to click "Close the question" (easy
// to do — the class keeps moving) would freeze every student's screen on that
// answer for the rest of the session, blocking the quiz and reflection.
const revealDisplayMinutes = 3;

async function loadCurrentPulse(
  db: Db,
  courseId: string,
  profileId: string,
  sessionId: string,
  isTeacher: boolean
) {
  // Newest round that still matters: open, or revealed recently enough that a
  // student is still looking at the answer.
  const { data: rounds, error: roundError } = await db
    .from("pulse_rounds")
    .select("id, state, points, time_limit_seconds, opened_at, ends_at, revealed_at, prompt_snapshot")
    .eq("class_session_id", sessionId)
    .in("state", ["open", "revealed"])
    .order("opened_at", { ascending: false })
    .limit(1);
  if (roundError) throw roundError;

  let round = (rounds || [])[0];
  if (round && String(round.state) === "revealed" && round.revealed_at) {
    const staleAfter = new Date(round.revealed_at).getTime() + revealDisplayMinutes * 60 * 1000;
    if (Date.now() > staleAfter) round = undefined;
  }
  if (!round) return { round: null, my_answer: null, results: null };

  const { data: mine, error: mineError } = await db
    .from("pulse_answers")
    .select("option_key, is_correct, points_awarded, answered_at")
    .eq("round_id", round.id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (mineError) throw mineError;

  const revealed = String(round.state) === "revealed";
  return {
    round: studentRound(round, revealed),
    // Correctness of their own answer is only meaningful once revealed.
    my_answer: mine
      ? {
          option_key: mine.option_key,
          answered_at: mine.answered_at,
          is_correct: revealed ? mine.is_correct : null,
          points_awarded: revealed ? mine.points_awarded : null
        }
      : null,
    results: revealed
      ? await loadResults(db, courseId, String(round.id), isTeacher)
      : null
  };
}

/** Is there a quiz to take right now, or has one already run and closed? */
async function loadCurrentQuiz(db: Db, sessionId: string) {
  const { data: instances, error } = await db
    .from("activity_instances")
    .select("id, state, ends_at, question_count")
    .eq("class_session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const instance = (instances || [])[0];
  if (!instance) return { instance_id: null, state: null };
  return {
    instance_id: instance.id,
    state: instance.state, // 'live' -> take it now; 'closed' -> reflection can open
    ends_at: instance.ends_at,
    question_count: instance.question_count
  };
}

async function loadReflectionStatus(db: Db, sessionId: string, profileId: string) {
  const { data: session, error: sessionError } = await db
    .from("class_sessions")
    .select("reflection_min_words, reflection_max_words")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;

  const { data: ticket, error: ticketError } = await db
    .from("exit_tickets")
    .select("id")
    .eq("class_session_id", sessionId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (ticketError) throw ticketError;

  return {
    submitted: Boolean(ticket),
    min_words: session?.reflection_min_words ?? 50,
    max_words: session?.reflection_max_words ?? 100
  };
}

async function recordAnswer(db: Db, courseId: string, profileId: string, body: Record<string, unknown>) {
  const roundId = cleanUuid(body.round_id, "round id");
  const optionKey = String(body.option_key || "").trim().slice(0, 40);
  if (!optionKey) throw new Error("Pick an option first.");

  const { data: round, error: roundError } = await db
    .from("pulse_rounds")
    .select("id, course_id, class_session_id, section_id, state, points, answer_points, ends_at, prompt_snapshot")
    .eq("id", roundId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (roundError) throw roundError;
  if (!round) throw new Error("That pulse round was not found.");
  if (String(round.state) !== "open") throw new Error("This question is closed.");
  if (round.ends_at && new Date(String(round.ends_at)) < new Date()) {
    throw new Error("Time is up for this question.");
  }

  const { data: enrollment, error: enrollmentError } = await db
    .from("section_enrollments")
    .select("id")
    .eq("profile_id", profileId)
    .eq("section_id", round.section_id)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (enrollmentError) throw enrollmentError;
  if (!enrollment) throw new Error("You are not enrolled in this class section.");

  // Scanning the QR code is what puts a student in the room. Without this the
  // gate on the live screen would be cosmetic — anyone enrolled could answer
  // from anywhere, and the attendance table would be describing a fiction.
  const checkedInAt = await loadCheckInAt(db, String(round.class_session_id), profileId);
  if (!checkedInAt) throw new Error("Scan the class QR code to join before answering.");

  const snapshot = (round.prompt_snapshot || {}) as {
    options?: Array<{ key: string }>;
    correct_key?: string;
  };
  if (!(snapshot.options || []).some((option) => option.key === optionKey)) {
    throw new Error("That option is not part of this question.");
  }

  const isCorrect = optionKey === snapshot.correct_key;
  const pointsAwarded = isCorrect ? Number(round.points) : Number(round.answer_points);
  const latency = Number.isFinite(Number(body.latency_ms))
    ? Math.max(0, Math.round(Number(body.latency_ms)))
    : null;

  const { error: insertError } = await db.from("pulse_answers").insert({
    round_id: roundId,
    profile_id: profileId,
    option_key: optionKey,
    is_correct: isCorrect,
    points_awarded: pointsAwarded,
    latency_ms: latency
  });
  if (insertError) {
    // The unique constraint is the anti-double-answer guard.
    if (String(insertError.code) === "23505" || /duplicate key/i.test(String(insertError.message))) {
      throw new Error("You already answered this question.");
    }
    throw insertError;
  }

  // Mirror into participation_events so the gradebook needs no changes.
  const { error: eventError } = await db.from("participation_events").insert({
    course_id: courseId,
    profile_id: profileId,
    section_id: round.section_id,
    class_session_id: round.class_session_id,
    event_type: "pulse_response",
    points: pointsAwarded,
    metadata: { round_id: roundId, option_key: optionKey, is_correct: isCorrect }
  });
  if (eventError) throw eventError;

  // Recorded, but correctness stays hidden until the instructor reveals.
  return { recorded: true, round_id: roundId, option_key: optionKey };
}
