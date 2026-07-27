// Live in-lecture pulse questions.
//
// Instructor actions: push (open a question), reveal (show the answer and the
// distribution), close, results.
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

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const liveSessionStates = ["open", "live", "paused", "continued"];

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

    switch (body.action) {
      case "push": {
        requireInstructor(isInstructor);
        return json(await pushRound(db, courseId, String(profile.id), body));
      }
      case "reveal":
      case "close": {
        requireInstructor(isInstructor);
        return json(await setRoundState(db, courseId, body, body.action === "reveal" ? "revealed" : "closed"));
      }
      case "results": {
        if (!isTeacher) throw new Error("Pulse results are not allowed for this role.");
        return json(await loadResults(db, courseId, cleanUuid(body.round_id, "round id"), true));
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

async function loadSession(db: Db, courseId: string, sessionId: string) {
  const { data, error } = await db
    .from("class_sessions")
    .select("id, course_id, section_id, state, sequence_number, title")
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
      text: String((option as Record<string, unknown>)?.text || "").trim().slice(0, 400)
    }))
    .filter((option) => option.text);
  if (options.length < 2) throw new Error("A pulse needs at least two options.");
  if (options.length > 6) throw new Error("A pulse takes at most six options.");
  const correctKey = String(input.correct_key || "").trim();
  if (!options.some((option) => option.key === correctKey)) {
    throw new Error("One option must be marked correct.");
  }
  return { text: text.slice(0, 600), options, correct_key: correctKey };
}

async function snapshotFromBank(db: Db, questionId: string) {
  const { data: question, error } = await db
    .from("questions")
    .select("id, prompt, question_type, status")
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw error;
  if (!question) throw new Error("That question was not found in the bank.");

  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("id, option_text, is_correct, position")
    .eq("question_id", questionId)
    .order("position", { ascending: true });
  if (optionError) throw optionError;

  const mapped = (options || []).map((option) => ({
    key: String(option.id),
    text: String(option.option_text || "")
  }));
  const correct = (options || []).find((option) => option.is_correct);
  if (!correct) throw new Error("That bank question has no correct option.");
  return buildSnapshot({ text: question.prompt, options: mapped, correct_key: String(correct.id) });
}

async function pushRound(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);
  if (!liveSessionStates.includes(String(session.state))) {
    throw new Error("Start the class session before pushing a pulse.");
  }

  const snapshot = body.question_id
    ? await snapshotFromBank(db, cleanUuid(body.question_id, "question id"))
    : buildSnapshot((body.question as Record<string, unknown>) || {});

  const timeLimit = Math.min(900, Math.max(10, Number(body.time_limit_seconds) || 60));
  const points = Math.min(100, Math.max(0, Number(body.points ?? 1)));
  // Hybrid grading: half credit for answering, unless the caller overrides.
  const answerPoints = Math.min(
    points,
    Math.max(0, body.answer_points === undefined ? points / 2 : Number(body.answer_points))
  );

  // Only one question can be open at a time — close any leftovers first so a
  // student phone is never showing two questions.
  await db
    .from("pulse_rounds")
    .update({ state: "closed", closed_at: new Date().toISOString() })
    .eq("class_session_id", sessionId)
    .eq("state", "open");

  const now = new Date();
  const { data: round, error } = await db
    .from("pulse_rounds")
    .insert({
      course_id: courseId,
      class_session_id: sessionId,
      section_id: session.section_id,
      question_id: body.question_id ? cleanUuid(body.question_id, "question id") : null,
      prompt_snapshot: snapshot,
      state: "open",
      points,
      answer_points: answerPoints,
      time_limit_seconds: timeLimit,
      opened_at: now.toISOString(),
      ends_at: new Date(now.getTime() + timeLimit * 1000).toISOString(),
      created_by: actorProfileId
    })
    .select("id, state, points, answer_points, time_limit_seconds, opened_at, ends_at, prompt_snapshot")
    .maybeSingle();
  if (error) throw error;

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "pulse_round",
    target_id: round?.id || null,
    action: "pulse_pushed",
    metadata: { class_session_id: sessionId, points, time_limit_seconds: timeLimit }
  });

  return { round: teacherRound(round) };
}

async function setRoundState(db: Db, courseId: string, body: Record<string, unknown>, nextState: string) {
  const roundId = cleanUuid(body.round_id, "round id");
  const stamp = nextState === "revealed" ? { revealed_at: new Date().toISOString() } : { closed_at: new Date().toISOString() };
  const { data: round, error } = await db
    .from("pulse_rounds")
    .update({ state: nextState, ...stamp })
    .eq("id", roundId)
    .eq("course_id", courseId)
    .select("id, state, points, answer_points, time_limit_seconds, opened_at, ends_at, prompt_snapshot")
    .maybeSingle();
  if (error) throw error;
  if (!round) throw new Error("That pulse round was not found.");
  const results = await loadResults(db, courseId, roundId, true);
  return { round: teacherRound(round), ...results };
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
    text: snapshot.text,
    options: snapshot.options,
    correct_key: snapshot.correct_key
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
    text: snapshot.text,
    options: snapshot.options,
    correct_key: revealed ? snapshot.correct_key : null
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
    distribution,
    correct_key: round.state === "open" ? null : (round.prompt_snapshot as Record<string, unknown>).correct_key,
    respondents
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

  // Newest round that still matters: open, or revealed so the student sees the answer.
  const { data: rounds, error: roundError } = await db
    .from("pulse_rounds")
    .select("id, state, points, time_limit_seconds, opened_at, ends_at, prompt_snapshot")
    .eq("class_session_id", sessionId)
    .in("state", ["open", "revealed"])
    .order("opened_at", { ascending: false })
    .limit(1);
  if (roundError) throw roundError;

  const round = (rounds || [])[0];
  if (!round) {
    return { session_state: session.state, round: null, my_answer: null };
  }

  const { data: mine, error: mineError } = await db
    .from("pulse_answers")
    .select("option_key, is_correct, points_awarded, answered_at")
    .eq("round_id", round.id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (mineError) throw mineError;

  const revealed = String(round.state) === "revealed";
  return {
    session_state: session.state,
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
    results: revealed ? await loadResults(db, courseId, String(round.id), false) : null
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
