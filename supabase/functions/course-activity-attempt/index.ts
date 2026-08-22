import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "../_shared/identity.ts";
import { assertCheckedIn } from "../_shared/attendance.ts";
import { askedQuestionIds, withoutAsked } from "../_shared/asked-questions.ts";
import { secondsForQuestion } from "../_shared/question-timing.ts";
import { pickRacerName } from "../_shared/racer-names.ts";
import { OPEN_INSTANCE_STATES, withinSubmitGrace } from "../_shared/quiz-close.ts";
import { podiumCut, rankAttempts } from "../_shared/quiz-rank.ts";
import { shuffle, dealQuestions, QUOTA } from "../_shared/shuffle.ts";
import {
  acceptableAnswers,
  committedAnswers,
  dealtQuestionIds,
  numberMap,
  stringMap
} from "../_shared/settle.ts";

type Db = ReturnType<typeof adminClient>;

const openStates = ["open", "live"];
const visibleAttemptStates = ["released", "live", "scheduled"];
// Speed used to be worth up to 5% of the grade. Under the room clock every
// student finishes in the same second, so it measured nothing — and equal
// correctness must mean an equal grade. Speed now pays in candy, which is the
// race and never the gradebook. Kept as a zero rather than deleted so the
// score payload keeps its shape for existing callers.
const maxSpeedBonusPercent = 0;

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
        responses: Array.isArray(body.responses) ? body.responses : [],
        integrity: sanitizeIntegrity(body.integrity)
      });
      return json(result);
    }

    if (body.action === "set_name_reveal") {
      const result = await setNameReveal(db, profile, {
        attemptId: cleanUuid(body.attempt_id, "attempt id"),
        revealed: body.revealed === true
      });
      return json(result);
    }

    if (body.action === "report_progress") {
      const result = await reportProgress(db, profile, {
        attemptId: cleanUuid(body.attempt_id, "attempt id"),
        position: Number(body.position),
        answered: Number(body.answered),
        answers: sanitizeAnswers(body.answers)
      });
      return json(result);
    }

    if (body.action === "cheer") {
      const result = await sendCheer(db, profile, cleanUuid(body.attempt_id, "attempt id"));
      return json(result);
    }

    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error.message || "Unable to process activity attempt.";
    // An expired token is an auth problem, not a bad request. As a 400 this
    // told Live.tsx "you are not in this class" mid-quiz — join cleared,
    // player unmounted — when the phone only needed one token refresh.
    if (message.includes("Invalid or expired session")) {
      return json({ error: message }, { status: 401 });
    }
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
  await assertCourseEmailAllowed(db, userData.user.email || "");

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
  await assertStudentEnrollment(db, String(profile.id), String(instance.section_id));
  // A quiz attached to a live class is part of that class: you have to be in
  // the room to sit it. Standalone activities are unaffected.
  await assertCheckedIn(db, instance.class_session_id as string | null, String(profile.id));
  const release = await resolveAttemptRelease(db, instance);

  // The open gate moved inside findOrCreateAttempt, where it can tell the two
  // cases apart: STARTING fresh needs an open instance, but RESUMING an
  // attempt already underway is allowed for as long as the submit grace runs —
  // the same window submit_attempt honours. A student thrown out in the final
  // seconds comes back to their saved attempt and sends it, instead of being
  // told "Activity is not open for attempts" while their work evaporates.
  const attemptPolicy = await findOrCreateAttempt(db, {
    activityInstanceId,
    profileId: String(profile.id),
    sectionId: String(instance.section_id),
    allowedAttempts: release?.allowed_attempts,
    instance
  });
  assertAttemptWithinTimeLimit(attemptPolicy.attempt, instance);
  attemptPolicy.attempt = await ensureRacerName(db, attemptPolicy.attempt, instance);
  const questions = await questionsForAttempt(db, attemptPolicy.attempt, instance);

  // The frozen deal travels as `questions`; no reason to send it twice.
  const { questions_json: _frozen, ...attemptRow } = attemptPolicy.attempt;

  return {
    attempt: withAttemptContext(attemptRow, instance, attemptPolicy),
    questions,
    activity_instance: safeInstance(instance)
  };
}

/**
 * The questions an attempt was dealt, frozen at first start. The selection
 * shuffles once (per the instance's randomization policy); after that the
 * attempt's questions are a stored fact. Before this, every start_attempt
 * re-shuffled questions AND options, so a phone that reloaded mid-quiz got a
 * brand-new quiz — the 2026-08-20 class lost three students' work to exactly
 * that. The guard on `questions_json IS NULL` makes two racing first starts
 * converge on a single deal.
 */
async function questionsForAttempt(db: Db, attempt: Record<string, unknown>, instance: Record<string, unknown>) {
  if (attempt.questions_json) return attempt.questions_json as Record<string, unknown>[];

  const dealt = await loadQuestionsForInstance(db, instance);
  const { data: frozen, error } = await db
    .from("student_attempts")
    .update({ questions_json: dealt, updated_at: new Date().toISOString() })
    .eq("id", String(attempt.id))
    .is("questions_json", null)
    .select("questions_json")
    .maybeSingle();
  if (error) throw error;
  if (frozen?.questions_json) return frozen.questions_json as Record<string, unknown>[];

  // A concurrent first start won the freeze — serve its deal, not ours.
  const { data: existing, error: readError } = await db
    .from("student_attempts")
    .select("questions_json")
    .eq("id", String(attempt.id))
    .maybeSingle();
  if (readError) throw readError;
  return (existing?.questions_json as Record<string, unknown>[] | null) ?? dealt;
}

async function submitAttempt(db: Db, profile: Record<string, unknown>, input: {
  attemptId: string;
  responses: Record<string, unknown>[];
  integrity?: Record<string, unknown>;
}) {
  const attempt = await loadAttempt(db, input.attemptId, String(profile.id));
  if (["submitted", "locked"].includes(String(attempt.status))) {
    throw new Error("This attempt has already been submitted.");
  }

  const instance = await loadActivityInstance(db, String(attempt.activity_instance_id));
  assertActivityOpenForSubmit(instance, attempt);
  await assertStudentEnrollment(db, String(profile.id), String(instance.section_id));
  const release = await resolveAttemptRelease(db, instance);
  assertAttemptWithinTimeLimit(attempt, instance);

  // THE GRADE IS COMPUTED FROM WHAT THE SERVER RECORDED, NOT FROM WHAT THE
  // PHONE SENDS. The break hands every phone its round's correct option id ten
  // seconds after that round closes, so by the final round a client holds the
  // whole answer key; grading `input.responses` meant a scripted phone could
  // post a perfect score in a payload indistinguishable from an honest one.
  // `committedAnswers` replays the same window test the candy already uses: an
  // answer counts only if the server saw it before its round stopped taking
  // answers, which is the only evidence that it predates the reveal.
  //
  // The client's array is still folded in first, under the same rule report_progress
  // applies — a last tap whose ping is still in flight, or a ping that failed
  // while its round is open, is a real answer and must not be lost to a race
  // with the submit. It is never trusted for a round that has already closed.
  const clock = roomClockFor(attempt, instance);
  const submitAt = Date.now();
  const clientAnswers = clientAnswerMap(input.responses);
  const storedAnswers = stringMap(attempt.progress_answers);
  const storedTimes = numberMap(attempt.round_answer_times);
  const lateAccepted = clock
    ? acceptableAnswers({
        startedAt: clock.startedAt,
        questionCount: clock.questionCount,
        now: submitAt,
        questionIds: clock.questionIds,
        stored: storedAnswers,
        incoming: clientAnswers
      })
    : {};
  const finalAnswers = { ...storedAnswers, ...lateAccepted };
  const finalTimes = { ...storedTimes };
  for (const questionId of Object.keys(lateAccepted)) {
    if (finalTimes[questionId] === undefined) finalTimes[questionId] = submitAt;
  }

  const serverResponses = clock
    ? committedAnswers({
        startedAt: clock.startedAt,
        questionCount: clock.questionCount,
        questionIds: clock.questionIds,
        answers: finalAnswers,
        answerTimes: finalTimes
      }).map((row) => ({ ...row, response_json: {} }))
    : null;

  const gradedBase = await gradeResponses(db, serverResponses ?? input.responses);
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
  // A student who answered nothing now submits ten blanks and scores zero,
  // rather than being refused and left ungraded. Only a submission with no
  // rows at all — a stale client sending an empty array — is an error.
  if (!graded.rows.length) throw new Error("No questions were submitted.");

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
  const questionCount = Math.max(0, Number(instance.question_count || 0)) || graded.rows.length;
  const { data: updated, error: updateError } = await db
    .from("student_attempts")
    .update({
      submitted_at: submittedAt,
      status,
      // graded.rows is every dealt question now, not just the answered ones —
      // an unfiltered length would stamp the dealt count here, not the answered
      // count, and two other services read this column as "answers given":
      // course-class-quiz's piñata "hits" and course-pulse's my_race.pinata.
      // Filtering back to the truly-selected rows keeps the column's meaning.
      progress_answered: graded.rows.filter((row) => row.selected_option_id).length,
      progress_position: questionCount,
      // The record the grade was computed from, so the review list, the candy
      // and the gradebook all describe the same answers.
      ...(clock ? { progress_answers: finalAnswers, round_answer_times: finalTimes } : {}),
      score_raw: graded.score_raw,
      score_percent: graded.score_percent,
      speed_bonus: graded.speed_bonus,
      score_final: graded.score_final,
      updated_at: submittedAt
    })
    .eq("id", input.attemptId)
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, speed_bonus, score_final, racer_name, racer_emoji, progress_position, progress_answered")
    .single();
  if (updateError) throw updateError;
  const gradebookScore = await syncGradebookScore(db, updated, instance, graded);

  const integrity = input.integrity || {};
  const integrityFlag = computeIntegrityFlag(integrity);
  const courseId = await sectionCourseId(db, String(instance.section_id));
  const { error: integrityAuditError } = await db
    .from("audit_log")
    .insert({
      course_id: courseId,
      actor_profile_id: updated.profile_id,
      target_type: "student_attempt",
      target_id: updated.id,
      action: integrityFlag.flagged ? "integrity_flagged" : "integrity_report",
      metadata: {
        ...integrity,
        flagged: integrityFlag.flagged,
        reasons: integrityFlag.reasons,
        activity_instance_id: updated.activity_instance_id,
        // Where the score came from, and where the phone's account of the
        // attempt differs from the server's. A student whose progress pings
        // never landed scores what the server can prove they committed, which
        // may be nothing — this is the row that shows the professor exactly
        // which attempts to look at, rather than the score silently going wrong.
        graded_from: serverResponses ? "server_record" : "client_payload",
        server_answered: serverResponses
          ? serverResponses.filter((row) => row.selected_option_id).length
          : null,
        client_answered: Object.values(clientAnswers).filter(Boolean).length,
        client_disagreed_on: serverResponses
          ? serverResponses
              .filter((row) => (clientAnswers[row.question_id] || "") !== (row.selected_option_id || ""))
              .map((row) => row.question_id)
          : []
      }
    });
  if (integrityAuditError) throw integrityAuditError;

  const attemptPolicy = await attemptLimitPolicy(db, {
    activityInstanceId: String(updated.activity_instance_id),
    profileId: String(updated.profile_id),
    allowedAttempts: release?.allowed_attempts
  });

  return {
    attempt: withAttemptContext(updated, instance, attemptPolicy),
    gradebook_score: gradebookScore,
    integrity: { ...integrity, flagged: integrityFlag.flagged, reasons: integrityFlag.reasons },
    score: {
      raw: graded.score_raw,
      total: graded.total_points,
      percent: graded.score_percent,
      speed_bonus: graded.speed_bonus,
      final: graded.score_final
    }
  };
}

/**
 * A student on the podium choosing to be named.
 *
 * Three guards, all of them load-bearing:
 *   - the attempt must be theirs, so a phone cannot reveal a classmate;
 *   - the attempt must actually be in the top three, so a phone cannot talk
 *     its way onto the celebration screen by calling this directly;
 *   - the quiz must be closed, so nobody advertises a place while the quiz is
 *     still being taken.
 *
 * Reversible on purpose. A student who says yes and immediately regrets it in
 * front of the room has to be able to take it back, and the podium reverts to
 * their student ID within one poll.
 *
 * WHICH IS WHY THE PODIUM GUARD APPLIES TO REVEALING ONLY. Rankings move after
 * the close: a submission landing inside the sixty-second grace is graded like
 * any other and can displace someone who was third when they tapped "show my
 * name". Requiring podium membership to withdraw would leave that student with a
 * banner telling them their name is on the screen at the front of the room and
 * an error every time they tried to take it down. Consent that cannot be
 * withdrawn is not consent, and nothing is protected by refusing: hiding a name
 * can only ever remove information.
 */
async function setNameReveal(
  db: Db,
  profile: Record<string, unknown>,
  input: { attemptId: string; revealed: boolean }
) {
  const attempt = await loadAttempt(db, input.attemptId, String(profile.id));
  const instance = await loadActivityInstance(db, String(attempt.activity_instance_id));
  if (String(instance.state) !== "closed") {
    throw new Error("The quiz is still running.");
  }

  if (input.revealed) {
    const { data: attempts, error } = await db
      .from("student_attempts")
      .select("profile_id, status, score_final, submitted_at, progress_answered")
      .eq("activity_instance_id", attempt.activity_instance_id);
    if (error) throw error;

    const top = podiumCut(rankAttempts((attempts || []) as never));
    if (!top.some((entry) => String(entry.profile_id) === String(profile.id))) {
      throw new Error("Only the top three can be named on the podium.");
    }
  }

  const { data: updated, error: updateError } = await db
    .from("student_attempts")
    .update({ name_revealed: input.revealed, updated_at: new Date().toISOString() })
    .eq("id", input.attemptId)
    .eq("profile_id", profile.id)
    .select("id, name_revealed")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error("That attempt was not found.");

  return { attempt_id: updated.id, name_revealed: Boolean(updated.name_revealed) };
}

/**
 * The room's round schedule for this attempt, or null when there is none.
 *
 * Only a quiz attached to a live class runs on the room clock — the same test
 * `ensureRacerName` and the check-in gate already use — and only once the deal
 * is frozen, because the schedule is "question k is round k" and without the
 * deal there is no k. A standalone activity has no rounds, so none of the round
 * rules apply to it and it keeps its old behaviour exactly.
 */
function roomClockFor(attempt: Record<string, unknown>, instance: Record<string, unknown>) {
  if (!instance.class_session_id) return null;
  const startedAt = Date.parse(String(instance.starts_at || ""));
  if (!Number.isFinite(startedAt)) return null;
  const questionCount = Math.max(1, Number(instance.question_count || 0) || 1);
  const questionIds = dealtQuestionIds(attempt.questions_json).slice(0, questionCount);
  if (!questionIds.length) return null;
  return { startedAt, questionCount, questionIds };
}

/**
 * The phone saying "I'm on question 5, answered 4" so the room's screen can
 * move a racer and crack the piñata — and, since the 2026-08-20 class lost
 * three students' work to mid-quiz kicks, also the running save: each ping
 * carries the full answer map, merged over what is stored so a stale ping can
 * add but never erase. Fire-and-forget by contract: monotonic, clamped, and
 * every no-op answers { ok: true } — a dropped or stale ping must never
 * surface an error on a phone mid-quiz.
 *
 * These ARE the graded answers now, not a recovery copy beside them: submit
 * grades what the server recorded here, because the break reveals each round's
 * correct option to every phone and a client's own account of its answers can
 * no longer be taken on trust. So a ping may add an answer, and may change one
 * while its round is still open — and may not touch it afterwards.
 *
 * The first ping also anchors the clock: clock_t0 is set exactly once (the
 * "Let's go" tap sends position 0), so a phone that reloads cannot mint itself
 * a fresh full-length schedule.
 */
async function reportProgress(
  db: Db,
  profile: Record<string, unknown>,
  input: { attemptId: string; position: number; answered: number; answers: Record<string, string> }
) {
  const attempt = await loadAttempt(db, input.attemptId, String(profile.id));
  if (attempt.submitted_at || String(attempt.status) !== "started") return { ok: true };
  const instance = await loadActivityInstance(db, String(attempt.activity_instance_id));
  if (!openStates.includes(String(instance.state))) return { ok: true };

  const cap = Math.max(1, Number(instance.question_count || 0) || 100);
  const clamp = (value: number) =>
    Math.max(0, Math.min(cap, Math.trunc(Number.isFinite(value) ? value : 0)));
  const position = Math.max(clamp(input.position), Number(attempt.progress_position || 0));
  const answered = Math.max(clamp(input.answered), Number(attempt.progress_answered || 0));

  const stored = stringMap(attempt.progress_answers);
  const stampedAt = Date.now();
  // A student may change their mind while the round is still taking answers,
  // and not after. The break shows every phone its round's correct option, and
  // the stamp below is pinned to the first answer seen — so an unguarded merge
  // would let a crafted ping swap in the revealed answer during the break and
  // keep the early timestamp, collecting on it in both candy and grade.
  const clock = roomClockFor(attempt, instance);
  const accepted = clock
    ? acceptableAnswers({
        startedAt: clock.startedAt,
        questionCount: clock.questionCount,
        now: stampedAt,
        questionIds: clock.questionIds,
        stored,
        incoming: input.answers
      })
    : input.answers;
  const merged = { ...stored, ...accepted };

  if (!attempt.clock_t0) {
    const { error: clockError } = await db
      .from("student_attempts")
      .update({ clock_t0: new Date().toISOString() })
      .eq("id", input.attemptId)
      .is("clock_t0", null);
    if (clockError) throw clockError;
  }

  // First answer wins. A student who changes their choice keeps the timestamp
  // of when they first committed, so "fast" cannot be gamed by re-tapping.
  const mergedAnswerTimes = { ...numberMap(attempt.round_answer_times) };
  for (const questionId of Object.keys(accepted)) {
    if (mergedAnswerTimes[questionId] === undefined) mergedAnswerTimes[questionId] = stampedAt;
  }

  const { error } = await db
    .from("student_attempts")
    .update({
      progress_position: position,
      progress_answered: answered,
      progress_answers: merged,
      round_answer_times: mergedAnswerTimes,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.attemptId);
  if (error) throw error;
  return { ok: true };
}

/**
 * question_id -> selected_option_id, both UUIDs; anything else is dropped and
 * the map is capped, because this arrives from a phone and lands in a jsonb
 * column. An empty result is fine — the merge treats it as "nothing new".
 */
function sanitizeAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const isUuid = (text: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= 100) break;
    const option = String(entry || "");
    if (isUuid(key) && isUuid(option)) out[key] = option;
  }
  return out;
}

/** A finished student cheering someone still swinging. The server picks the
 *  target so it is never a pile-on, and enforces the 20-second cooldown so a
 *  bored phone cannot flood the room's screen. */
async function sendCheer(db: Db, profile: Record<string, unknown>, attemptId: string) {
  const attempt = await loadAttempt(db, attemptId, String(profile.id));
  if (!["submitted", "late"].includes(String(attempt.status))) {
    throw new Error("Finish the quiz before cheering.");
  }
  const instance = await loadActivityInstance(db, String(attempt.activity_instance_id));
  if (!OPEN_INSTANCE_STATES.includes(String(instance.state))) {
    throw new Error("The quiz is over — the cheering is too.");
  }

  const twentySecondsAgo = new Date(Date.now() - 20_000).toISOString();
  const { data: recent, error: recentError } = await db
    .from("quiz_cheers")
    .select("id")
    .eq("from_attempt_id", attemptId)
    .gte("created_at", twentySecondsAgo)
    .limit(1);
  if (recentError) throw recentError;
  if ((recent || []).length) throw new Error("Wait a moment before the next cheer.");

  const { data: running, error: runningError } = await db
    .from("student_attempts")
    .select("id, racer_name, racer_emoji")
    .eq("activity_instance_id", String(instance.id))
    .eq("status", "started")
    .is("submitted_at", null)
    .not("racer_name", "is", null);
  if (runningError) throw runningError;
  const candidates = (running || []).filter((row) => String(row.id) !== attemptId);
  if (!candidates.length) return { ok: false, reason: "nobody_left" };

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const { error: insertError } = await db.from("quiz_cheers").insert({
    activity_instance_id: String(instance.id),
    from_attempt_id: attemptId,
    to_attempt_id: String(target.id)
  });
  if (insertError) throw insertError;
  return { ok: true, to: { racer_name: target.racer_name, racer_emoji: target.racer_emoji } };
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
    // updated_at is here for withinSubmitGrace: on a CLOSED instance it is when
    // the quiz actually stopped, which is earlier than ends_at whenever the
    // professor closed it by hand. See closedAtOf below.
    .select("id, activity_template_id, section_id, class_session_id, state, starts_at, ends_at, updated_at, time_limit_seconds, randomization_policy, question_count")
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

/**
 * When this instance stopped being open, for the submit grace.
 *
 * `updated_at` is a PROXY for the stop time — it is only the last write to the
 * row — and it is honest ONLY once the row is closed, because closing is the
 * last thing that happens to a closed instance: both closers stamp it as they
 * set `state = 'closed'`, and the one transition out of `closed` is to
 * `archived`, which fails this check anyway. On a still-running instance
 * `updated_at` is some unrelated edit, so it is withheld: null means "use
 * ends_at", which is the right answer for a quiz that has not stopped.
 */
function closedAtOf(instance: Record<string, unknown>): string | null {
  if (String(instance.state) !== "closed") return null;
  return (instance.updated_at as string | null) ?? null;
}

/**
 * The submit path's gate, deliberately laxer than the start path's.
 *
 * assertActivityOpen rejected anything arriving after ends_at, which threw away
 * every answer a student had given if the clock ran out mid-question. Nobody
 * hit it while the deadline was invisible and generous; a visible, tight,
 * self-closing deadline makes it likely.
 *
 * The grace finishes work already begun, for sixty seconds after the quiz
 * STOPPED — which for a professor's "Close the quiz" is minutes before ends_at.
 * Keying it to ends_at alone left the students who were mid-question at a manual
 * close with no grace at all: refused outright, every answer lost. An attempt
 * whose started_at is after the stop was never legitimately open and gets
 * nothing — that check lives in withinSubmitGrace, so starting late is still
 * refused by assertActivityOpen on the start path.
 */
function assertActivityOpenForSubmit(
  instance: Record<string, unknown>,
  attempt: Record<string, unknown>
) {
  const now = new Date();
  if (instance.starts_at && new Date(String(instance.starts_at)) > now) {
    throw new Error("Activity is not open yet.");
  }
  const stillOpen = openStates.includes(String(instance.state))
    && (!instance.ends_at || new Date(String(instance.ends_at)) >= now);
  if (stillOpen) return;

  if (withinSubmitGrace({
    endsAt: (instance.ends_at as string | null) ?? null,
    startedAt: (attempt.started_at as string | null) ?? null,
    closedAt: closedAtOf(instance),
    now
  })) return;

  throw new Error("Activity is closed.");
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
  // Same sixty seconds as the instance grace: a student finishing the last
  // question as their own clock expires must not lose the whole attempt.
  if (withinSubmitGrace({
    endsAt: (instance.ends_at as string | null) ?? null,
    startedAt: (attempt.started_at as string | null) ?? null,
    closedAt: closedAtOf(instance),
    now: new Date()
  })) return;

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

// An activity instance created by Run Class's "Start the quiz" (course-class-quiz)
// always carries class_session_id and is authorized by its own state/window —
// already checked by assertActivityOpen, exactly like pulse questions and
// reflections, which the professor's own guide says are "driven by the class
// session's own state." Gating it a second time on the underlying lecture's
// independent content_releases row (meant for self-study/standalone
// publishing, per pitfall #25) ties an in-class action to a database state
// Run Class never touches — a lecture left in review_only from earlier
// release-management work then blocks every in-class attempt with no
// visible cause. Only a standalone activity instance (course-quiz-compatibility,
// class_session_id always null) goes through the release-based gate.
async function resolveAttemptRelease(db: Db, instance: Record<string, unknown>) {
  if (instance.class_session_id) return undefined;
  return assertReleasedForStudent(db, instance);
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
  instance: Record<string, unknown>;
}): Promise<{
  attempt: Record<string, unknown>;
  allowedAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
}> {
  const policy = await attemptLimitPolicy(db, input);
  const openAttempt = policy.attempts.find((attempt) => !isClosedAttempt(attempt));
  if (openAttempt) {
    // A resume. The submit gate, not the start gate: an attempt already
    // underway may come back while the instance is open OR inside the
    // sixty-second grace after it stopped — withinSubmitGrace decides, exactly
    // as it does for submit_attempt.
    assertActivityOpenForSubmit(input.instance, openAttempt);
    return {
      attempt: openAttempt,
      allowedAttempts: policy.allowedAttempts,
      attemptsUsed: policy.attemptsUsed,
      attemptsRemaining: policy.attemptsRemaining
    };
  }

  // Starting fresh: the instance must actually be open.
  assertActivityOpen(input.instance);

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
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, score_final, racer_name, racer_emoji, progress_position, progress_answered, progress_answers, clock_t0, questions_json")
    .single();
  if (error) throw error;

  return {
    attempt: data,
    allowedAttempts: policy.allowedAttempts,
    attemptsUsed: policy.attemptsUsed + 1,
    attemptsRemaining: Math.max(0, policy.allowedAttempts - (policy.attemptsUsed + 1))
  };
}

/**
 * A live-class quiz attempt gets a secret racer identity, once. The unique
 * partial index on (activity_instance_id, racer_name) is the real guard —
 * two phones starting in the same second race, one hits 23505, and retries
 * with another name. Standalone activities (no class session) get none.
 * Failing to name a racer never fails the quiz: after five collisions the
 * attempt simply stays unnamed.
 */
async function ensureRacerName(
  db: Db,
  attempt: Record<string, unknown>,
  instance: Record<string, unknown>
) {
  if (!instance.class_session_id || attempt.racer_name) return attempt;
  const { data: existing, error } = await db
    .from("student_attempts")
    .select("racer_name")
    .eq("activity_instance_id", String(instance.id))
    .not("racer_name", "is", null);
  if (error) throw error;
  const used = (existing || []).map((row) => String(row.racer_name));

  for (let round = 0; round < 5; round++) {
    const pick = pickRacerName(used);
    if (!pick) return attempt;
    const { data: updated, error: updateError } = await db
      .from("student_attempts")
      .update({ racer_name: pick.name, racer_emoji: pick.emoji })
      .eq("id", String(attempt.id))
      .is("racer_name", null)
      .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, score_final, racer_name, racer_emoji, progress_position, progress_answered, progress_answers, clock_t0, questions_json")
      .maybeSingle();
    if (!updateError && updated) return updated;
    if (updateError && String(updateError.code) !== "23505") throw updateError;
    used.push(pick.name);
  }
  return attempt;
}

async function attemptLimitPolicy(db: Db, input: {
  activityInstanceId: string;
  profileId: string;
  allowedAttempts: unknown;
}): Promise<{
  attempts: Record<string, unknown>[];
  allowedAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
}> {
  const allowedAttempts = normalizeAllowedAttempts(input.allowedAttempts);
  const { data: attempts, error } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, score_raw, score_percent, score_final, racer_name, racer_emoji, progress_position, progress_answered, progress_answers, clock_t0, questions_json")
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
    .select("id, prompt, prompt_es, question_type, difficulty, topic_tags, points")
    .in("question_bank_id", bankIds)
    .eq("status", "active");
  if (questionError) throw questionError;

  // A question this class already answered as a live pulse is spent — it must
  // not come back in the same class's quiz. course-class-quiz sized
  // question_count off the same subtraction, so the two agree on the pool.
  const asked = await askedQuestionIds(db, instance.class_session_id);
  const pool = withoutAsked(questions || [], asked, (question) => String(question.id));

  // The class quiz is always the 4/3/3 mix in a shuffled order. `question_count`
  // stays on the instance for the schedule and the piñata's denominator, but it
  // no longer decides the deal — the quota does.
  const selectedQuestions = dealQuestions(pool, QUOTA);
  const questionIds = selectedQuestions.map((question) => question.id);
  if (!questionIds.length) return [];

  const { data: options, error: optionError } = await db
    .from("question_options")
    .select("id, question_id, option_text, option_text_es, position")
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
      option_text_es: option.option_text_es,
      position: option.position
    });
  });

  return selectedQuestions.map((question) => {
    // Options are always shuffled for a class quiz, with a real shuffle: two
    // students on the same question never see the same letter order.
    const options = shuffle(optionsByQuestion.get(String(question.id)) || []);
    return {
      id: question.id,
      prompt: question.prompt,
      prompt_es: question.prompt_es,
      question_type: question.question_type,
      difficulty: question.difficulty,
      topic_tags: question.topic_tags || [],
      points: question.points,
      // The phone holds no timing rule of its own. Two repos deploy
      // independently, so a constant kept on both sides drifts silently — the
      // server decides and the player obeys.
      seconds: secondsForQuestion({
        prompt: question.prompt as string | null,
        prompt_es: question.prompt_es as string | null,
        options: options as Array<{ option_text?: string | null; option_text_es?: string | null }>
      }),
      options
    };
  });
}

async function loadAttempt(db: Db, attemptId: string, profileId: string) {
  const { data, error } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, profile_id, section_id, attempt_number, started_at, submitted_at, status, racer_name, racer_emoji, progress_position, progress_answered, progress_answers, clock_t0, round_answer_times, candy, correct_count, settled_through, questions_json")
    .eq("id", attemptId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Attempt not found for this profile.");
  return data;
}

/** The phone's account of its own answers. Used to record where it differs
 *  from the server's, and for nothing else — never to decide correctness. */
function clientAnswerMap(responses: Record<string, unknown>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const response of Array.isArray(responses) ? responses : []) {
    const questionId = String(response?.question_id || "");
    if (questionId) out[questionId] = String(response?.selected_option_id || "");
  }
  return out;
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

function sanitizeIntegrity(value: unknown) {
  const v = (value && typeof value === "object" && !Array.isArray(value)) ? value as Record<string, unknown> : {};
  const num = (x: unknown, max: number) => {
    const n = Number(x || 0);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(max, Math.trunc(n));
  };
  return {
    focus_loss_count: num(v.focus_loss_count, 100000),
    hidden_ms: num(v.hidden_ms, 86400000),
    paste_count: num(v.paste_count, 100000),
    copy_count: num(v.copy_count, 100000),
    elapsed_ms: num(v.elapsed_ms, 86400000),
    canary_triggered: Boolean(v.canary_triggered),
    user_agent: String(v.user_agent || "").slice(0, 400)
  };
}

function computeIntegrityFlag(i: Record<string, unknown>) {
  const reasons: string[] = [];
  if (i.canary_triggered) reasons.push("ai_canary");
  if (Number(i.focus_loss_count) >= 2) reasons.push("focus_loss");
  if (Number(i.paste_count) >= 1) reasons.push("paste");
  return { flagged: reasons.length > 0, reasons };
}

async function sectionCourseId(db: Db, sectionId: string) {
  const { data, error } = await db
    .from("course_sections")
    .select("course_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.course_id : null;
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
