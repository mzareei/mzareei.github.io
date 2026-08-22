// End-of-class graded quiz.
//
// Reuses the authenticated activity engine (activity_templates / activity_instances
// / student_attempts in course-activity-attempt) rather than building a second
// grading path. This function only orchestrates the parts that engine doesn't do
// on its own: making sure a lecture has a quiz template, and opening/closing a
// live instance for a specific class session. It posts no grade of its own —
// the quiz is a component of the class grade, which course-class-record owns.
//
// Questions are never typed by the instructor — they come from the same
// generated bank the pulses draw from (course-question-bank), keyed by the
// lecture's own content_item_id. The activity engine deals a fixed 4 easy /
// 3 medium / 3 hard mix, in an order shuffled per student.
import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { askedQuestionIds, withoutAsked } from "../_shared/asked-questions.ts";
import { classDateFor } from "../_shared/attendance.ts";
import { roundAt, totalSecondsFor } from "../_shared/rounds.ts";
import { settleAttempt } from "../_shared/settle.ts";
import { pinataState } from "../_shared/pinata.ts";
import { closeReasonFor, maybeAutoCloseInstance } from "../_shared/quiz-close.ts";
import { podiumCut, rankAttempts } from "../_shared/quiz-rank.ts";

type Db = ReturnType<typeof adminClient>;

const instructorRoles = ["platform_owner", "instructor"];
const teacherRoles = ["platform_owner", "instructor", "teaching_assistant"];
const openSessionStates = ["open", "live", "paused", "continued"];
// An activity_instance in one of these is still "running" — students can reach
// it, and starting a quiz reuses it rather than opening a duplicate.
const openInstanceStates = ["open", "live", "paused"];
const defaultQuestionCount = 12;

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
      throw new Error("You are not allowed to manage quizzes for this course.");
    }
    if (isTeacher && body.class_session_id) {
      const targetSession = await loadSession(db, courseId, cleanUuid(body.class_session_id, "class session id"));
      if (!isGlobalOwner && !permittedSectionIds.includes(String(targetSession.section_id))) {
        throw new Error("You are not allowed to manage quizzes for this class section.");
      }
    }

    switch (body.action) {
      case "current": {
        if (!isTeacher) throw new Error("Quiz status is not allowed for this role.");
        return json(await currentQuiz(db, courseId, body));
      }
      case "start": {
        if (!isInstructor) throw new Error("Starting a quiz is not allowed for this role.");
        return json(await startQuiz(db, courseId, String(profile.id), body));
      }
      case "close": {
        if (!isInstructor) throw new Error("Closing a quiz is not allowed for this role.");
        return json(await closeQuiz(db, courseId, body, isGlobalOwner, permittedSectionIds));
      }
      case "status": {
        if (!isTeacher) throw new Error("Quiz status is not allowed for this role.");
        return json(await quizStatus(db, courseId, body, isGlobalOwner, permittedSectionIds));
      }
      case "race": {
        if (!isTeacher) throw new Error("Quiz status is not allowed for this role.");
        return json(await quizRace(db, courseId, body, isGlobalOwner, permittedSectionIds));
      }
      case "summary": {
        if (!isTeacher) throw new Error("Quiz summary is not allowed for this role.");
        return json(await quizSummary(db, courseId, body, roles.includes("teaching_assistant") && !isInstructor, String(profile.id)));
      }
      case "podium": {
        if (!isTeacher) throw new Error("Quiz results are not allowed for this role.");
        return json(await quizPodium(db, courseId, body, isGlobalOwner, permittedSectionIds));
      }
      case "reflections": {
        if (!isTeacher) throw new Error("Reflections are not allowed for this role.");
        return json(await classReflections(db, courseId, body, roles.includes("teaching_assistant") && !isInstructor, String(profile.id)));
      }
      default:
        return json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    const message = error?.message || "Unable to manage the class quiz.";
    if (message.includes("not allowed")) return json({ error: message }, { status: 403 });
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
    .select("id, auth_user_id, institutional_email, full_name, status")
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

/** The lecture's own content item — the same one the deck and the pulse bank use. */
async function loadLectureItem(db: Db, courseId: string, slug: string) {
  const { data, error } = await db
    .from("content_items")
    .select("id, slug, title, content_type")
    .eq("course_id", courseId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No content item found for slug "${slug}".`);
  return data;
}

/**
 * One quiz template per lecture, created once and reused.
 *
 * Deliberately no gradebook item. The quiz score is a COMPONENT of the class
 * grade — 70% of it — not a grade of its own. Posting it separately put the
 * same performance in the gradebook twice, once raw and once folded into the
 * class grade, and the raw one is the number that has no defensible meaning on
 * its own: it ignores the mastery threshold, the pulse questions, and the exit
 * ticket. The class record is the only thing that posts a grade.
 *
 * With no item carrying this template, course-activity-attempt's
 * syncGradebookScore finds nothing and posts nothing — that is the intended
 * path, not an accident of lookup order.
 */
async function ensureQuizTemplate(db: Db, item: { id: string; title: string }) {
  const { data: template, error: templateError } = await db
    .from("activity_templates")
    .upsert(
      {
        content_item_id: item.id,
        activity_type: "quiz",
        grading_mode: "correctness",
        max_score: 100,
        weight_category: "quizzes",
        updated_at: new Date().toISOString()
      },
      { onConflict: "content_item_id,activity_type" }
    )
    .select("id")
    .maybeSingle();
  if (templateError) throw templateError;
  return { templateId: template!.id };
}

/** The questions this class session may still be asked, with the text the
 *  timing rule needs to size them.
 *
 *  Ids alone are not enough any more: the quiz clock is the sum of the longest
 *  questions a student could draw, so the prompts and options have to come back
 *  with them. Runs once per "Start the quiz", so the wider query is fine.
 *
 *  The asked-question subtraction is unchanged and still has to match
 *  course-activity-attempt's selector exactly — sizing the instance off the raw
 *  bank while the selector filters would hand a student a quiz that ends before
 *  its own progress indicator does. */
async function bankQuestionPool(
  db: Db,
  courseId: string,
  contentItemId: string,
  classSessionId?: string
) {
  const { data: bank, error } = await db
    .from("question_banks")
    .select("id")
    .eq("course_id", courseId)
    .eq("content_item_id", contentItemId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!bank) return [];

  const { data: rows, error: questionError } = await db
    .from("questions")
    .select("id, prompt, prompt_es")
    .eq("question_bank_id", bank.id)
    .eq("status", "active");
  if (questionError) throw questionError;

  const questions = rows || [];
  const asked = await askedQuestionIds(db, classSessionId);
  const pool = withoutAsked(questions, asked, (row) => String(row.id));
  if (!pool.length) return [];

  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("question_id, option_text, option_text_es")
    .in("question_id", pool.map((row) => String(row.id)));
  if (optionError) throw optionError;

  const byQuestion = new Map<string, Array<Record<string, unknown>>>();
  for (const option of options || []) {
    const key = String(option.question_id);
    if (!byQuestion.has(key)) byQuestion.set(key, []);
    byQuestion.get(key)!.push(option);
  }

  return pool.map((row) => ({
    id: String(row.id),
    prompt: row.prompt,
    prompt_es: row.prompt_es,
    options: byQuestion.get(String(row.id)) || []
  }));
}

/** Recovers the instructor's place after a page reload — Run Class only keeps
 *  the instance id in memory, so without this a refresh makes a running quiz
 *  look like it was never started.
 *
 *  Reports the ACTIVE instance and the last FINISHED one separately. Collapsing
 *  the two is what made "Start the quiz" vanish for good once a session's first
 *  quiz was closed: the screen recovered the closed instance and then had no
 *  path back to starting another one. A session can legitimately run more than
 *  one quiz (a retry, a second short check), so "finished" must never block
 *  "start". */
async function currentQuiz(db: Db, courseId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const slug = String(body.content_slug || "").trim();
  const item = await loadLectureItem(db, courseId, slug);
  const empty = { instance_id: null, state: null, last_closed_instance_id: null };

  const { data: template, error: templateError } = await db
    .from("activity_templates")
    .select("id")
    .eq("content_item_id", item.id)
    .eq("activity_type", "quiz")
    .maybeSingle();
  if (templateError) throw templateError;
  if (!template) return empty;

  const { data: instances, error } = await db
    .from("activity_instances")
    .select("id, state")
    .eq("activity_template_id", template.id)
    .eq("class_session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const rows = instances || [];
  const active = rows.find((row) => openInstanceStates.includes(String(row.state)));
  const lastClosed = rows.find((row) => String(row.state) === "closed");
  return {
    instance_id: active?.id ?? null,
    state: active ? String(active.state) : null,
    last_closed_instance_id: lastClosed?.id ?? null
  };
}

async function startQuiz(db: Db, courseId: string, actorProfileId: string, body: Record<string, unknown>) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const slug = String(body.content_slug || "").trim();
  const session = await loadSession(db, courseId, sessionId);
  if (!openSessionStates.includes(String(session.state))) {
    throw new Error("Start the class session before starting the quiz.");
  }
  const item = await loadLectureItem(db, courseId, slug);
  const pool = await bankQuestionPool(db, courseId, item.id, sessionId);
  if (!pool.length) throw new Error("This lecture has no question bank yet.");

  const { templateId } = await ensureQuizTemplate(db, item);
  const questionCount = Math.min(pool.length, Math.max(1, Number(body.question_count) || defaultQuestionCount));
  // The clock follows the room's round schedule (_shared/rounds.ts): one
  // ROUND_SECONDS slot per question, plus the cushion for a slow-opening
  // phone. An explicit override from the caller still wins.
  const timeLimit = Number(body.time_limit_seconds)
    ? Math.min(3600, Math.max(60, Number(body.time_limit_seconds)))
    : totalSecondsFor(questionCount);

  // Reuse a still-open instance for this session if one already exists —
  // "Start quiz" is idempotent, so a refreshed page never creates a duplicate.
  const { data: existing, error: existingError } = await db
    .from("activity_instances")
    .select("id, state, ends_at")
    .eq("activity_template_id", templateId)
    .eq("class_session_id", sessionId)
    .in("state", openInstanceStates)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { instance_id: existing.id, reused: true };

  const now = new Date();
  const { data: instance, error: insertError } = await db
    .from("activity_instances")
    .insert({
      activity_template_id: templateId,
      section_id: session.section_id,
      class_session_id: sessionId,
      state: "live",
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + timeLimit * 1000).toISOString(),
      time_limit_seconds: timeLimit,
      randomization_policy: "shuffle_questions_and_options",
      question_count: questionCount,
      created_by: actorProfileId
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  await db.from("audit_log").insert({
    course_id: courseId,
    actor_profile_id: actorProfileId,
    target_type: "activity_instance",
    target_id: instance.id,
    action: "class_quiz_started",
    metadata: { class_session_id: sessionId, content_slug: slug, question_count: questionCount }
  });

  return { instance_id: instance.id, reused: false };
}

// The instance id arrives from the caller, so the caller's section permissions
// must be checked against the row itself — the class_session_id gate at the top
// of the handler only fires when the caller chooses to send that field, which
// an authenticated crafted request simply omits. Loading through the section's
// course also pins the instance to this course; activity_instances carries no
// course_id of its own.
async function loadInstanceForActor(
  db: Db,
  courseId: string,
  instanceId: string,
  isGlobalOwner: boolean,
  permittedSectionIds: string[]
) {
  const { data: instance, error } = await db
    .from("activity_instances")
    .select("id, activity_template_id, section_id, class_session_id, state, starts_at, ends_at, question_count, course_sections!inner(course_id)")
    .eq("id", instanceId)
    .eq("course_sections.course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!instance) throw new Error("That quiz instance was not found.");
  if (!isGlobalOwner && !permittedSectionIds.includes(String(instance.section_id))) {
    throw new Error("You are not allowed to manage quizzes for this class section.");
  }
  return instance;
}

async function closeQuiz(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  isGlobalOwner: boolean,
  permittedSectionIds: string[]
) {
  const instanceId = cleanUuid(body.activity_instance_id, "activity instance id");
  await loadInstanceForActor(db, courseId, instanceId, isGlobalOwner, permittedSectionIds);
  const { data: updated, error } = await db
    .from("activity_instances")
    .update({ state: "closed", updated_at: new Date().toISOString() })
    .eq("id", instanceId)
    .select("id, class_session_id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error("That quiz instance was not found.");
  return { instance_id: updated.id, state: "closed" };
}

async function quizStatus(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  isGlobalOwner: boolean,
  permittedSectionIds: string[]
) {
  const instanceId = cleanUuid(body.activity_instance_id, "activity instance id");
  const instance = await loadInstanceForActor(db, courseId, instanceId, isGlobalOwner, permittedSectionIds);

  // Closing happens here rather than on a schedule: this poll and every
  // student's poll both run it, so whichever arrives first ends the quiz and a
  // reloaded Run Class tab cannot hold it open over a finished room.
  const closed = await maybeAutoCloseInstance(
    db,
    {
      id: String(instance.id),
      state: String(instance.state),
      starts_at: (instance as Record<string, unknown>).starts_at as string | null,
      ends_at: instance.ends_at as string | null,
      class_session_id: (instance as Record<string, unknown>).class_session_id as string | null
    },
    classDateFor
  );

  const { count: enrolled } = await db
    .from("section_enrollments").select("id", { count: "exact", head: true })
    .eq("section_id", instance.section_id).eq("role", "student").eq("status", "active");
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts").select("id, status, score_final")
    .eq("activity_instance_id", instanceId);
  if (attemptError) throw attemptError;

  const submitted = (attempts || []).filter((a) => ["submitted", "late"].includes(String(a.status)));
  return {
    instance_id: instance.id,
    state: closed.state,
    ends_at: instance.ends_at,
    question_count: instance.question_count,
    enrolled: enrolled ?? 0,
    // The roster is who COULD have come; `present` is who is in the room. The
    // completeness message has to speak in the second one.
    present: closed.present,
    started: (attempts || []).length,
    submitted: submitted.length,
    closed_reason: closed.state === "closed"
      ? (closed.closed_reason
         ?? closeReasonFor({ presentCount: closed.present, submittedCount: submitted.length }))
      : null,
    average_score: submitted.length
      ? Math.round((submitted.reduce((sum, a) => sum + Number(a.score_final || 0), 0) / submitted.length) * 10) / 10
      : null
  };
}

/** Everything the room's piñata screen needs, in one call: the same
 *  auto-close check as `status`, then the racers by secret name only.
 *  Nothing here maps a racer to a student — that mapping never leaves the
 *  attempt rows. */
async function quizRace(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  isGlobalOwner: boolean,
  permittedSectionIds: string[]
) {
  const instanceId = cleanUuid(body.activity_instance_id, "activity instance id");
  const instance = await loadInstanceForActor(db, courseId, instanceId, isGlobalOwner, permittedSectionIds);

  const closed = await maybeAutoCloseInstance(
    db,
    {
      id: String(instance.id),
      state: String(instance.state),
      starts_at: (instance as Record<string, unknown>).starts_at as string | null,
      ends_at: instance.ends_at as string | null,
      class_session_id: (instance as Record<string, unknown>).class_session_id as string | null
    },
    classDateFor
  );

  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, status, submitted_at, racer_name, racer_emoji, questions_json, progress_answers, round_answer_times, settled_through, candy, correct_count")
    .eq("activity_instance_id", instanceId);
  if (attemptError) throw attemptError;
  const rows = attempts || [];

  const submittedRows = rows
    .filter((row) => ["submitted", "late"].includes(String(row.status)))
    .sort((a, b) => String(a.submitted_at || "").localeCompare(String(b.submitted_at || "")));
  const placeByAttempt = new Map(submittedRows.map((row, index) => [String(row.id), index + 1]));

  // The room's clock, read from the instance's own start. course-pulse hands
  // every phone the same window, so the screen and the phones tick together
  // instead of each running a countdown of its own.
  const questionCount = Math.max(1, Number(instance.question_count || 0) || 1);
  const startedAt = Date.parse(String((instance as Record<string, unknown>).starts_at || ""));
  const now = Date.now();
  // No anchor, no rounds: settling against a NaN window would mark every round
  // closed and unanswered, and then store those zeroes over real candy.
  const round = Number.isFinite(startedAt) ? roundAt(startedAt, now, questionCount) : null;

  // Settling happens on READ. A student who answers round 3 and then puts the
  // phone down would otherwise never have round 3 graded, so this poll grades
  // every round whose window has passed. settleAttempt recomputes from scratch,
  // which is what makes it safe for this poll and thirty phone polls to run it
  // in the same second.
  const settled = new Map<string, ReturnType<typeof settleAttempt>>();
  if (round) {
    // One query for the answer key of every question dealt in this room. Thirty
    // phones deal out of the same small bank, so the deduplicated id list is a
    // few dozen rows however big the class is — and it never leaves this
    // function: nothing the room's screen returns names an option.
    const correctByQuestion = await correctOptionIds(db, rows.flatMap((row) => dealtQuestionIds(row.questions_json)));
    for (const row of rows) {
      settled.set(String(row.id), settleAttempt({
        startedAt,
        now,
        questionCount,
        questions: settleQuestions(row.questions_json, correctByQuestion, questionCount),
        answers: stringMap(row.progress_answers),
        answerTimes: numberMap(row.round_answer_times),
        settledThrough: Number(row.settled_through ?? -1)
      }));
    }
    await storeSettled(db, rows, settled);
  }

  const racers = rows.map((row) => {
    const result = settled.get(String(row.id));
    return {
      racer_name: String(row.racer_name || "🎒 Mochila"),
      racer_emoji: String(row.racer_emoji || "🎒"),
      // Height on the climb: correctness plus speed. Never a grade.
      candy: result ? result.candy : Math.max(0, Number(row.candy || 0)),
      // Size on the climb: cumulative, so a racer never shrinks.
      correct_count: result ? result.correctCount : Math.max(0, Number(row.correct_count || 0)),
      finished: placeByAttempt.has(String(row.id)),
      finish_place: placeByAttempt.get(String(row.id)) ?? null
    };
  });

  // The flash beat: how many students got the round that just closed right.
  // While the room is answering, the round that just closed is the one before
  // the live one; during a break — and once the quiz is done — it is the live
  // index itself.
  const closedIndex = round ? (round.phase === "answering" ? round.index - 1 : round.index) : -1;
  const roundCorrect = closedIndex < 0 ? 0 : rows.reduce((sum, row) => {
    const detail = settled.get(String(row.id))?.rounds.find((entry) => entry.index === closedIndex);
    return sum + (detail?.correct ? 1 : 0);
  }, 0);

  const closedReason = closed.state === "closed"
    ? (closed.closed_reason
       ?? closeReasonFor({ presentCount: closed.present, submittedCount: submittedRows.length }))
    : null;
  // Damage is correct answers, not answers given. course-pulse feeds pinataState
  // the same three numbers off the same columns — one formula, two doors, and
  // they have to agree to the digit or the phone and the screen contradict each
  // other in front of the class.
  const correctInRoom = racers.reduce((sum, racer) => sum + racer.correct_count, 0);
  const pinata = pinataState({
    correct: correctInRoom,
    started: rows.length,
    questionCount,
    closedReason
  });

  // The piñata is named after the lecture: instance → template → content item.
  const { data: template } = await db
    .from("activity_templates")
    .select("content_item_id")
    .eq("id", (instance as Record<string, unknown>).activity_template_id)
    .maybeSingle();
  const { data: item } = template?.content_item_id
    ? await db.from("content_items").select("title").eq("id", template.content_item_id).maybeSingle()
    : { data: null };

  const twentySecondsAgo = new Date(Date.now() - 20_000).toISOString();
  const { data: cheerRows, error: cheerError } = await db
    .from("quiz_cheers")
    .select("from_attempt_id, to_attempt_id, created_at")
    .eq("activity_instance_id", instanceId)
    .gte("created_at", twentySecondsAgo)
    .order("created_at", { ascending: true });
  if (cheerError) throw cheerError;
  const { count: cheersTotal } = await db
    .from("quiz_cheers")
    .select("id", { count: "exact", head: true })
    .eq("activity_instance_id", instanceId);

  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const cheers = (cheerRows || []).flatMap((cheer) => {
    const from = byId.get(String(cheer.from_attempt_id));
    const to = byId.get(String(cheer.to_attempt_id));
    if (!from || !to) return [];
    return [{
      from_name: String(from.racer_name || "🎒 Mochila"),
      from_emoji: String(from.racer_emoji || "🎒"),
      to_name: String(to.racer_name || "🎒 Mochila"),
      to_emoji: String(to.racer_emoji || "🎒"),
      at: String(cheer.created_at)
    }];
  });

  return {
    instance_id: instance.id,
    state: closed.state,
    ends_at: instance.ends_at,
    question_count: instance.question_count,
    present: closed.present,
    started: rows.length,
    submitted: submittedRows.length,
    closed_reason: closedReason,
    round: round
      ? {
          index: round.index,
          phase: round.phase,
          answer_ends_at: new Date(round.answerEnd).toISOString(),
          break_ends_at: new Date(round.breakEnd).toISOString()
        }
      : null,
    round_correct: roundCorrect,
    pinata: { name: String(item?.title || ""), ...pinata },
    racers,
    cheers,
    cheers_total: cheersTotal ?? 0
  };
}

// ------------------------------------------------------------------ settling
// The plumbing a closed round needs: what an attempt was dealt, which option is
// right, and what the student chose. The RULES — which rounds are closed, what
// counts as answered in time, what candy is worth — stay in _shared/settle.ts,
// shared with the phone's poll in course-pulse. Two services that deploy
// independently cannot each keep their own copy of a rule — the same reason the
// per-question seconds are decided on the server and not in the phone.

/** The question ids an attempt was dealt, in dealt order — index k is round k
 *  for that student. */
function dealtQuestionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((question) => String((question as Record<string, unknown> | null)?.id || ""))
    .filter(Boolean);
}

/** A jsonb object read back as question id -> option id. */
function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = String(entry || "");
  return out;
}

/** A jsonb object read back as question id -> ms epoch. */
function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = Number(entry);
  return out;
}

/** The answer key for every question dealt in the room, in one query. */
async function correctOptionIds(db: Db, questionIds: string[]) {
  const ids = Array.from(new Set(questionIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data, error } = await db
    .from("question_options")
    .select("id, question_id")
    .in("question_id", ids)
    .eq("is_correct", true);
  if (error) throw error;
  (data || []).forEach((option) => {
    // A bank question with two options flagged correct would otherwise settle
    // differently depending on row order. First one wins, every poll.
    if (!map.has(String(option.question_id))) map.set(String(option.question_id), String(option.id));
  });
  return map;
}

/** The dealt questions in the shape settleAttempt wants, cut to the room's
 *  round count. `windowFor` clamps an index past the last round, so an
 *  eleventh question in a ten-round room would be graded against round ten's
 *  window — the count that bounds this array and the count passed beside it
 *  have to be one number. */
function settleQuestions(questionsJson: unknown, correctByQuestion: Map<string, string>, questionCount: number) {
  return dealtQuestionIds(questionsJson)
    .slice(0, questionCount)
    .map((id) => ({ id, correctOptionId: correctByQuestion.get(id) ?? null }));
}

/** Store the rows whose numbers actually moved. A three-second poll rewriting
 *  the whole class every tick would be pure noise, and settleAttempt recomputes
 *  from scratch, so a stale writer can only store a number the next poll
 *  corrects — nothing reads these columns as truth. They are the record kept for
 *  an attempt whose phone has gone quiet. No `updated_at`: settling is the
 *  server's bookkeeping, not an edit the student made. */
async function storeSettled(
  db: Db,
  rows: Record<string, unknown>[],
  settled: Map<string, { candy: number; correctCount: number; settledThrough: number }>
) {
  const changed = rows.filter((row) => {
    const result = settled.get(String(row.id));
    if (!result) return false;
    return Number(row.candy ?? 0) !== result.candy
      || Number(row.correct_count ?? 0) !== result.correctCount
      || Number(row.settled_through ?? -1) !== result.settledThrough;
  });
  if (!changed.length) return;

  const writes = await Promise.all(changed.map((row) => {
    const result = settled.get(String(row.id))!;
    return db
      .from("student_attempts")
      .update({ candy: result.candy, correct_count: result.correctCount, settled_through: result.settledThrough })
      .eq("id", String(row.id));
  }));
  const failed = writes.find((write) => write.error);
  if (failed?.error) throw failed.error;
}

async function quizSummary(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  taScoped: boolean,
  actorProfileId: string
) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);

  if (taScoped) {
    const { data: enrollment, error } = await db
      .from("section_enrollments")
      .select("id")
      .eq("profile_id", actorProfileId)
      .eq("section_id", session.section_id)
      .eq("role", "teaching_assistant")
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!enrollment) throw new Error("Quiz summary is not allowed for this section.");
  }

  const { data: instances, error: instanceError } = await db
    .from("activity_instances")
    .select("id, state")
    .eq("class_session_id", sessionId);
  if (instanceError) throw instanceError;
  if (!(instances || []).length) return { attempts: [] };

  const instanceIds = (instances || []).map((i) => i.id);
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, profile_id, status, score_raw, score_percent, score_final, submitted_at")
    .in("activity_instance_id", instanceIds);
  if (attemptError) throw attemptError;

  const profileIds = Array.from(new Set((attempts || []).map((a) => String(a.profile_id))));
  const { data: profiles, error: profileError } = profileIds.length
    ? await db.from("profiles").select("id, full_name, preferred_name, student_identifier").in("id", profileIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const byId = new Map((profiles || []).map((p) => [String(p.id), p]));

  return {
    attempts: (attempts || []).map((attempt) => {
      const person = byId.get(String(attempt.profile_id)) || {};
      return {
        profile_id: attempt.profile_id,
        name: person.preferred_name || person.full_name || "Student",
        student_identifier: person.student_identifier || null,
        status: attempt.status,
        score_percent: attempt.score_percent,
        score_final: attempt.score_final,
        submitted_at: attempt.submitted_at
      };
    })
  };
}

/** The top three of the last quiz this class ran, for the celebration screen.
 *
 *  A real name is WITHHELD HERE unless that student opted in. Sending every
 *  podium name and hiding two of them in the client would put a classmate's
 *  name in a response the professor's browser — and anything with his session —
 *  can read. The student ID is the public identity; the name is the exception
 *  they granted. */
async function quizPodium(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  isGlobalOwner: boolean,
  permittedSectionIds: string[]
) {
  let instanceId = "";
  if (body.activity_instance_id) {
    instanceId = cleanUuid(body.activity_instance_id, "activity instance id");
    await loadInstanceForActor(db, courseId, instanceId, isGlobalOwner, permittedSectionIds);
  } else {
    const sessionId = cleanUuid(body.class_session_id, "class session id");
    const session = await loadSession(db, courseId, sessionId);
    if (!isGlobalOwner && !permittedSectionIds.includes(String(session.section_id))) {
      throw new Error("You are not allowed to manage quizzes for this class section.");
    }
    const { data: instances, error } = await db
      .from("activity_instances")
      .select("id, state")
      .eq("class_session_id", sessionId)
      .eq("state", "closed")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    instanceId = String((instances || [])[0]?.id || "");
  }
  if (!instanceId) return { instance_id: null, entries: [] };

  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("profile_id, status, score_final, submitted_at, name_revealed, progress_answered")
    .eq("activity_instance_id", instanceId);
  if (attemptError) throw attemptError;

  const top = podiumCut(rankAttempts((attempts || []) as never));
  if (!top.length) return { instance_id: instanceId, entries: [] };

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name, student_identifier")
    .in("id", top.map((entry) => String(entry.profile_id)));
  if (profileError) throw profileError;
  const byId = new Map((profiles || []).map((p) => [String(p.id), p]));

  return {
    instance_id: instanceId,
    entries: top.map((entry) => {
      const person = byId.get(String(entry.profile_id)) || {};
      const name_revealed = Boolean((entry as Record<string, unknown>).name_revealed);
      return {
        rank: entry.rank,
        profile_id: entry.profile_id,
        student_identifier: person.student_identifier || null,
        score_final: entry.score_final,
        name_revealed,
        name: name_revealed ? (person.preferred_name || person.full_name || null) : null
      };
    })
  };
}

async function classReflections(
  db: Db,
  courseId: string,
  body: Record<string, unknown>,
  taScoped: boolean,
  actorProfileId: string
) {
  const sessionId = cleanUuid(body.class_session_id, "class session id");
  const session = await loadSession(db, courseId, sessionId);

  if (taScoped) {
    const { data: enrollment, error } = await db
      .from("section_enrollments")
      .select("id")
      .eq("profile_id", actorProfileId)
      .eq("section_id", session.section_id)
      .eq("role", "teaching_assistant")
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!enrollment) throw new Error("Reflections are not allowed for this section.");
  }

  const { data: tickets, error } = await db
    .from("exit_tickets")
    .select("profile_id, one_thing, created_at")
    .eq("class_session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!(tickets || []).length) return { reflections: [] };

  const profileIds = Array.from(new Set((tickets || []).map((t) => String(t.profile_id))));
  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name, student_identifier")
    .in("id", profileIds);
  if (profileError) throw profileError;
  const byId = new Map((profiles || []).map((p) => [String(p.id), p]));

  return {
    reflections: (tickets || []).map((ticket) => {
      const person = byId.get(String(ticket.profile_id)) || {};
      return {
        profile_id: ticket.profile_id,
        name: person.preferred_name || person.full_name || "Student",
        student_identifier: person.student_identifier || null,
        one_thing: ticket.one_thing,
        created_at: ticket.created_at
      };
    })
  };
}
