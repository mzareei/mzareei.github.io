// The class grading rule, and the only implementation of it.
//
// A class is worth ONE grade. It is built from three things and nothing else:
// how many of the questions pushed during the lecture the student got right,
// how many of the end-of-class quiz questions they got right, and whether they
// handed in the exit ticket. There is no category, no weight, and no separate
// quiz grade sitting beside it — the quiz is a component of this number, not a
// peer of it.
//
// course-class-record computes it for a whole roster; course-student-progress
// computes it for one student across many classes. Those are two different
// data-loading shapes, so they load differently — but they both call
// computeGrade below, so a change to the rule cannot reach one screen and miss
// the other.
import { adminClient } from "./client.ts";

type Db = ReturnType<typeof adminClient>;

// The pulse questions asked during the lecture are worth less than the quiz at
// the end because they are asked under time pressure, one at a time, while the
// lecture is still moving.
export const PULSE_WEIGHT = 0.3;
export const QUIZ_WEIGHT = 0.7;

// The share of the material a student has to get right to earn 100 for the
// class. This is a THRESHOLD, not a count of forgiven mistakes: 20% of however
// many questions were actually asked. Three wrong out of fifteen and two wrong
// out of ten both land on 100.
export const MASTERY_THRESHOLD = 0.8;

// The final written submission is required but never graded for quality. Its
// absence costs a fifth of the class grade; its contents cost nothing.
export const MISSING_SUBMISSION_MULTIPLIER = 0.8;

// The one surviving gradebook category. It groups class grades; it does not
// weight them.
export const CLASS_GRADE_CATEGORY_NAME = "Class grades";

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * The whole grading rule, in one place.
 *
 *   raw   = 30% pulse accuracy + 70% quiz accuracy
 *   grade = min(100, raw / 0.80 × 100)
 *   final = grade × 0.80 when the written submission is missing
 *
 * Returns the arithmetic as well as the answer, because both the professor and
 * the student have to be able to see exactly how the number was reached.
 */
export function computeGrade(input: {
  pulseCorrect: number;
  pulseTotal: number;
  quizCorrect: number;
  quizTotal: number;
  submissionPresent: boolean;
  // False when the class never reached its end-of-class phase (nobody attempted
  // the quiz and nobody handed in a reflection). A student cannot be penalized
  // for skipping a submission that was never asked of the room.
  submissionRequired?: boolean;
}) {
  const pulseAvailable = input.pulseTotal > 0;
  const quizAvailable = input.quizTotal > 0;

  const pulseAccuracy = pulseAvailable ? input.pulseCorrect / input.pulseTotal : null;
  const quizAccuracy = quizAvailable ? input.quizCorrect / input.quizTotal : null;

  // Early in a semester a class often has pulses but no quiz, or the reverse.
  // Rather than scoring the missing half as zero, the surviving component takes
  // the full weight. When neither ran there is nothing to grade at all — and
  // that is null, never 0: a class that graded nothing did not fail anybody.
  let pulseWeight = 0;
  let quizWeight = 0;
  if (pulseAvailable && quizAvailable) {
    pulseWeight = PULSE_WEIGHT;
    quizWeight = QUIZ_WEIGHT;
  } else if (pulseAvailable) {
    pulseWeight = 1;
  } else if (quizAvailable) {
    quizWeight = 1;
  }

  const gradable = pulseAvailable || quizAvailable;
  const rawScore = gradable
    ? (pulseAccuracy ?? 0) * pulseWeight + (quizAccuracy ?? 0) * quizWeight
    : null;

  const scaled =
    rawScore === null ? null : Math.min(100, (rawScore / MASTERY_THRESHOLD) * 100);
  const submissionRequired = input.submissionRequired !== false;
  const penaltyApplied = gradable && submissionRequired && !input.submissionPresent;
  const finalGrade =
    scaled === null ? null : round2(penaltyApplied ? scaled * MISSING_SUBMISSION_MULTIPLIER : scaled);

  return {
    pulse_correct: input.pulseCorrect,
    pulse_total: input.pulseTotal,
    pulse_accuracy_percent: pulseAccuracy === null ? null : round2(pulseAccuracy * 100),
    pulse_weight_percent: round2(pulseWeight * 100),
    quiz_correct: input.quizCorrect,
    quiz_total: input.quizTotal,
    quiz_accuracy_percent: quizAccuracy === null ? null : round2(quizAccuracy * 100),
    quiz_weight_percent: round2(quizWeight * 100),
    raw_score_percent: rawScore === null ? null : round2(rawScore * 100),
    mastery_threshold_percent: round2(MASTERY_THRESHOLD * 100),
    scaled_grade: scaled === null ? null : round2(scaled),
    capped: scaled !== null && rawScore !== null && rawScore >= MASTERY_THRESHOLD,
    submission_present: input.submissionPresent,
    submission_required: submissionRequired,
    penalty_applied: penaltyApplied,
    penalty_percent: penaltyApplied ? round2((1 - MISSING_SUBMISSION_MULTIPLIER) * 100) : 0,
    calculated_grade: finalGrade
  };
}

/** The constants, shaped for display. Both screens print the same sentence. */
export function gradingWeights() {
  return {
    pulse_percent: round2(PULSE_WEIGHT * 100),
    quiz_percent: round2(QUIZ_WEIGHT * 100),
    mastery_threshold_percent: round2(MASTERY_THRESHOLD * 100),
    missing_submission_penalty_percent: round2((1 - MISSING_SUBMISSION_MULTIPLIER) * 100)
  };
}

// --------------------------------------------------------- the student's view

export type StudentClassGrade = ReturnType<typeof computeGrade> & {
  class_session_id: string;
  sequence_number: number;
  title: string;
  planned_date: string | null;
  /** What is actually reported: the posted score, override included. */
  grade: number | null;
  /** True when the reported grade is not what the formula produced. */
  adjusted: boolean;
  adjustment_reason: string | null;
};

/**
 * Every class grade a student can see, with the arithmetic behind each one.
 *
 * Only classes the professor has POSTED are included. Posting is a deliberate
 * act on the class record screen, and it stays the line between "the numbers
 * exist" and "the student may read them" — a grade should not appear on a phone
 * because a screen was opened.
 *
 * Batched across sessions on purpose: the per-roster loaders in
 * course-class-record run four queries per class, which is fine for one class
 * and quadratic-feeling for a whole semester of them.
 */
export async function studentClassGrades(
  db: Db,
  courseId: string,
  profileId: string,
  sectionIds: string[]
): Promise<StudentClassGrade[]> {
  if (!sectionIds.length) return [];

  const posted = await loadPostedClassScores(db, courseId, profileId, sectionIds);
  if (!posted.size) return [];

  const sessionIds = Array.from(posted.keys());
  const { data: sessions, error: sessionError } = await db
    .from("class_sessions")
    .select("id, sequence_number, title, planned_date")
    .in("id", sessionIds);
  if (sessionError) throw sessionError;
  if (!(sessions || []).length) return [];

  const [pulse, quiz, submissions, overrides, endOfClassRan] = await Promise.all([
    loadStudentPulse(db, sessionIds, profileId),
    loadStudentQuiz(db, sessionIds, profileId),
    loadStudentSubmissions(db, sessionIds, profileId),
    loadStudentOverrides(db, sessionIds, profileId),
    loadEndOfClassRan(db, sessionIds)
  ]);

  return (sessions || [])
    .map((session) => {
      const sessionId = String(session.id);
      const pulseTally = pulse.get(sessionId) || { correct: 0, graded: 0 };
      const quizTally = quiz.get(sessionId) || { correct: 0, total: 0 };
      const score = posted.get(sessionId)!;
      const classFinished = endOfClassRan.has(sessionId);

      const breakdown = computeGrade({
        // A graded question that was never answered is wrong, not excused. The
        // denominator is every graded question pushed to the room.
        pulseCorrect: pulseTally.correct,
        pulseTotal: pulseTally.graded,
        // A quiz instance nobody ever attempted is a quiz that was never given:
        // the class was cut short, so the pulse questions carry the grade.
        quizCorrect: classFinished ? quizTally.correct : 0,
        quizTotal: classFinished ? quizTally.total : 0,
        submissionPresent: submissions.has(sessionId),
        submissionRequired: classFinished
      });

      const override = overrides.get(sessionId) ?? null;
      const grade = score.score_final;

      return {
        ...breakdown,
        class_session_id: sessionId,
        sequence_number: Number(session.sequence_number || 0),
        title: String(session.title || ""),
        planned_date: session.planned_date ? String(session.planned_date) : null,
        grade,
        // Compared against what was posted, not against the live recomputation:
        // the student is owed an explanation when the professor changed their
        // grade, not when a late-arriving response shifted the arithmetic.
        adjusted:
          grade !== null &&
          score.score_raw !== null &&
          round2(grade) !== round2(score.score_raw),
        adjustment_reason: override
      };
    })
    .sort((a, b) => a.sequence_number - b.sequence_number);
}

/**
 * Which of these sessions genuinely ran their end-of-class quiz: someone
 * submitted an attempt, or someone answered at least one question. A merely
 * *opened* attempt does not count — when a class is cut short, a couple of
 * students always manage to open the quiz in the last seconds, and that must
 * not put a 12-question zero on everyone else. A class that never really ran
 * its quiz grades on its pulse questions alone, and nobody is penalized for
 * the reflection that was never asked of the room.
 */
export async function loadEndOfClassRan(db: Db, sessionIds: string[]) {
  const ran = new Set<string>();
  if (!sessionIds.length) return ran;

  const { data: instances, error: instanceError } = await db
    .from("activity_instances")
    .select("id, class_session_id")
    .in("class_session_id", sessionIds);
  if (instanceError) throw instanceError;

  const instanceToSession = new Map<string, string>();
  for (const instance of instances || []) {
    instanceToSession.set(String(instance.id), String(instance.class_session_id));
  }
  if (!instanceToSession.size) return ran;

  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, activity_instance_id, submitted_at")
    .in("activity_instance_id", Array.from(instanceToSession.keys()));
  if (attemptError) throw attemptError;

  const openAttemptToSession = new Map<string, string>();
  for (const attempt of attempts || []) {
    const sessionId = instanceToSession.get(String(attempt.activity_instance_id));
    if (!sessionId) continue;
    if (attempt.submitted_at) ran.add(sessionId);
    else openAttemptToSession.set(String(attempt.id), sessionId);
  }

  // An unsubmitted attempt still proves the quiz ran if questions were answered.
  const pending = Array.from(openAttemptToSession.keys()).filter(
    (id) => !ran.has(openAttemptToSession.get(id)!)
  );
  if (pending.length) {
    const { data: responses, error: responseError } = await db
      .from("student_responses")
      .select("student_attempt_id")
      .in("student_attempt_id", pending);
    if (responseError) throw responseError;
    for (const response of responses || []) {
      const sessionId = openAttemptToSession.get(String(response.student_attempt_id));
      if (sessionId) ran.add(sessionId);
    }
  }

  return ran;
}

/** The posted class-grade rows for this student, keyed by class session. */
async function loadPostedClassScores(
  db: Db,
  courseId: string,
  profileId: string,
  sectionIds: string[]
) {
  const { data: items, error: itemError } = await db
    .from("gradebook_items")
    .select("id, class_session_id")
    .eq("course_id", courseId)
    .not("class_session_id", "is", null);
  if (itemError) throw itemError;
  if (!(items || []).length) return new Map<string, PostedScore>();

  const sessionByItem = new Map(
    (items || []).map((item) => [String(item.id), String(item.class_session_id)])
  );

  const { data: scores, error: scoreError } = await db
    .from("gradebook_scores")
    .select("gradebook_item_id, score_raw, score_final, status")
    .eq("profile_id", profileId)
    .in("section_id", sectionIds)
    .in("gradebook_item_id", Array.from(sessionByItem.keys()))
    .in("status", ["posted", "locked"]);
  if (scoreError) throw scoreError;

  const bySession = new Map<string, PostedScore>();
  for (const score of scores || []) {
    const sessionId = sessionByItem.get(String(score.gradebook_item_id));
    if (!sessionId) continue;
    bySession.set(sessionId, {
      score_raw: score.score_raw === null ? null : Number(score.score_raw),
      score_final: score.score_final === null ? null : Number(score.score_final)
    });
  }
  return bySession;
}

type PostedScore = { score_raw: number | null; score_final: number | null };

/** Graded pulse questions pushed per class, and how many this student got right. */
async function loadStudentPulse(db: Db, sessionIds: string[], profileId: string) {
  const { data: rounds, error } = await db
    .from("pulse_rounds")
    .select("id, class_session_id, points, prompt_snapshot")
    .in("class_session_id", sessionIds);
  if (error) throw error;

  // A round is GRADED only if it carries points and had a right answer to find.
  // An ad-hoc show-of-hands question still counts toward engagement — it was
  // asked, and answering it is participation — but grading it would be scoring
  // students against an answer key that does not exist.
  const gradedRounds = (rounds || []).filter((round) => {
    const snapshot = (round.prompt_snapshot || {}) as { correct_key?: string | null };
    return Number(round.points || 0) > 0 && Boolean(snapshot.correct_key);
  });

  const tally = new Map<string, { correct: number; graded: number }>();
  const sessionByRound = new Map<string, string>();
  for (const round of gradedRounds) {
    const sessionId = String(round.class_session_id);
    sessionByRound.set(String(round.id), sessionId);
    const current = tally.get(sessionId) || { correct: 0, graded: 0 };
    current.graded += 1;
    tally.set(sessionId, current);
  }
  if (!sessionByRound.size) return tally;

  const { data: answers, error: answerError } = await db
    .from("pulse_answers")
    .select("round_id, is_correct")
    .eq("profile_id", profileId)
    .in("round_id", Array.from(sessionByRound.keys()));
  if (answerError) throw answerError;

  for (const answer of answers || []) {
    if (!answer.is_correct) continue;
    const sessionId = sessionByRound.get(String(answer.round_id));
    if (!sessionId) continue;
    tally.get(sessionId)!.correct += 1;
  }
  return tally;
}

/**
 * The final quiz for each class. A session can hold more than one — the Run
 * Class screen deliberately allows starting another — so "final" is the most
 * recently opened instance, matching course-class-record.
 */
async function loadStudentQuiz(db: Db, sessionIds: string[], profileId: string) {
  const { data: instances, error } = await db
    .from("activity_instances")
    .select("id, class_session_id, question_count, created_at")
    .in("class_session_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latestBySession = new Map<string, { id: string; questionCount: number }>();
  for (const instance of instances || []) {
    const sessionId = String(instance.class_session_id);
    if (latestBySession.has(sessionId)) continue;
    latestBySession.set(sessionId, {
      id: String(instance.id),
      questionCount: Number(instance.question_count || 0)
    });
  }

  const tally = new Map<string, { correct: number; total: number }>();
  if (!latestBySession.size) return tally;

  const instanceIds = Array.from(latestBySession.values()).map((instance) => instance.id);
  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, activity_instance_id")
    .eq("profile_id", profileId)
    .in("activity_instance_id", instanceIds);
  if (attemptError) throw attemptError;

  const attemptToSession = new Map<string, string>();
  for (const [sessionId, instance] of latestBySession) {
    const attempt = (attempts || []).find(
      (row) => String(row.activity_instance_id) === instance.id
    );
    // No attempt is not "excused" — the questions were still asked, so the
    // denominator stands and every one of them counts as wrong.
    tally.set(sessionId, { correct: 0, total: instance.questionCount });
    if (attempt) attemptToSession.set(String(attempt.id), sessionId);
  }
  if (!attemptToSession.size) return tally;

  const { data: responses, error: responseError } = await db
    .from("student_responses")
    .select("student_attempt_id, is_correct")
    .in("student_attempt_id", Array.from(attemptToSession.keys()));
  if (responseError) throw responseError;

  const answeredByAttempt = new Map<string, number>();
  for (const response of responses || []) {
    const attemptId = String(response.student_attempt_id);
    answeredByAttempt.set(attemptId, (answeredByAttempt.get(attemptId) || 0) + 1);
    if (!response.is_correct) continue;
    const sessionId = attemptToSession.get(attemptId);
    if (!sessionId) continue;
    tally.get(sessionId)!.correct += 1;
  }

  // question_count is what the instance was opened with. A legacy instance with
  // a null count falls back to what this student was actually asked, so the
  // grade divides by a real denominator instead of zero.
  for (const [attemptId, sessionId] of attemptToSession) {
    const entry = tally.get(sessionId)!;
    if (!entry.total) entry.total = answeredByAttempt.get(attemptId) || 0;
  }
  return tally;
}

/** Which classes this student handed the exit ticket in for. */
async function loadStudentSubmissions(db: Db, sessionIds: string[], profileId: string) {
  const { data, error } = await db
    .from("exit_tickets")
    .select("class_session_id")
    .eq("profile_id", profileId)
    .in("class_session_id", sessionIds);
  if (error) throw error;
  return new Set((data || []).map((row) => String(row.class_session_id)));
}

/**
 * The reason behind the most recent active override, per class.
 *
 * The student sees why their grade was changed, not the audit trail of who
 * changed it and when — that is the professor's record, not theirs.
 */
async function loadStudentOverrides(db: Db, sessionIds: string[], profileId: string) {
  const { data, error } = await db
    .from("class_grade_overrides")
    .select("class_session_id, grade, reason, created_at")
    .eq("profile_id", profileId)
    .in("class_session_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const bySession = new Map<string, string | null>();
  for (const row of data || []) {
    const sessionId = String(row.class_session_id);
    if (bySession.has(sessionId)) continue;
    bySession.set(sessionId, row.grade === null ? null : String(row.reason));
  }
  return bySession;
}

// ------------------------------------------------- the roster's view, and posting
//
// The same rule applied to a whole class at once, plus the write that puts the
// result in the gradebook.
//
// This lived in course-class-record until 2026-08-14, when posting stopped
// being a button the professor pressed. Three different functions now have to
// be able to post — the exit ticket (one student, the moment they finish), the
// session close (the whole roster, including whoever never submitted), and a
// grade override (one student, so the correction reaches their phone) — and an
// edge function cannot import another edge function. It belongs here anyway:
// this module is the one implementation of the grading rule, and posting is
// what makes that rule visible to a student.

export type ClassGradeSession = {
  id: string;
  course_id: string;
  section_id: string;
  sequence_number: number;
  title: string;
};

export type RosterStudent = {
  profile_id: string;
  name: string;
  student_identifier: string | null;
};

export function laterOf(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Every active student enrolled in the class's section, name-sorted. */
export async function loadRoster(db: Db, sectionId: string): Promise<RosterStudent[]> {
  const { data: enrollments, error } = await db
    .from("section_enrollments")
    .select("profile_id")
    .eq("section_id", sectionId)
    .eq("role", "student")
    .eq("status", "active");
  if (error) throw error;

  const profileIds = Array.from(new Set((enrollments || []).map((row) => String(row.profile_id))));
  if (!profileIds.length) return [];

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name, student_identifier")
    .in("id", profileIds);
  if (profileError) throw profileError;

  return (profiles || [])
    .map((person) => ({
      profile_id: String(person.id),
      name: String(person.preferred_name || person.full_name || "Student"),
      student_identifier: person.student_identifier ? String(person.student_identifier) : null
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** When each student handed in the exit ticket for this class, if they did. */
export async function loadReflections(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("exit_tickets")
    .select("profile_id, created_at")
    .eq("class_session_id", sessionId);
  if (error) throw error;
  const byProfile = new Map<string, string>();
  for (const row of data || []) {
    const key = String(row.profile_id);
    byProfile.set(key, laterOf(byProfile.get(key) ?? null, String(row.created_at))!);
  }
  return byProfile;
}

export async function loadPulse(db: Db, sessionId: string) {
  const { data: rounds, error } = await db
    .from("pulse_rounds")
    .select("id, points, prompt_snapshot")
    .eq("class_session_id", sessionId);
  if (error) throw error;

  const roundIds = (rounds || []).map((round) => String(round.id));
  // A round is GRADED only if it carries points and had a right answer to find.
  // An ad-hoc show-of-hands question still counts toward engagement — it was
  // asked, and answering it is participation — but grading it would be scoring
  // students against an answer key that does not exist.
  const gradedRoundIds = new Set(
    (rounds || [])
      .filter((round) => {
        const snapshot = (round.prompt_snapshot || {}) as { correct_key?: string | null };
        return Number(round.points || 0) > 0 && Boolean(snapshot.correct_key);
      })
      .map((round) => String(round.id))
  );

  const { data: answers, error: answerError } = roundIds.length
    ? await db
        .from("pulse_answers")
        .select("round_id, profile_id, is_correct, answered_at")
        .in("round_id", roundIds)
    : { data: [], error: null };
  if (answerError) throw answerError;

  const answersByProfile = new Map<
    string,
    Array<{ round_id: string; is_correct: boolean; answered_at: string }>
  >();
  for (const answer of answers || []) {
    const key = String(answer.profile_id);
    if (!answersByProfile.has(key)) answersByProfile.set(key, []);
    answersByProfile.get(key)!.push({
      round_id: String(answer.round_id),
      is_correct: Boolean(answer.is_correct),
      answered_at: String(answer.answered_at)
    });
  }

  return {
    roundCount: roundIds.length,
    gradedRoundIds,
    gradedRoundCount: gradedRoundIds.size,
    answersByProfile
  };
}

/**
 * The final quiz for the class. A session can hold more than one quiz — the Run
 * Class screen deliberately allows starting another — so "final" is the most
 * recently opened instance, not the union of all of them.
 */
export async function loadQuiz(db: Db, sessionId: string) {
  const { data: instances, error } = await db
    .from("activity_instances")
    .select("id, state, question_count, created_at")
    .eq("class_session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const instance = (instances || [])[0] || null;
  if (!instance) {
    return { instance: null, questionCount: 0, attemptsByProfile: new Map() };
  }

  const { data: attempts, error: attemptError } = await db
    .from("student_attempts")
    .select("id, profile_id, status, submitted_at, score_percent")
    .eq("activity_instance_id", instance.id);
  if (attemptError) throw attemptError;

  const attemptIds = (attempts || []).map((attempt) => String(attempt.id));
  const { data: responses, error: responseError } = attemptIds.length
    ? await db
        .from("student_responses")
        .select("student_attempt_id, is_correct")
        .in("student_attempt_id", attemptIds)
    : { data: [], error: null };
  if (responseError) throw responseError;

  const answeredByAttempt = new Map<string, { correct: number; answered: number }>();
  for (const response of responses || []) {
    const key = String(response.student_attempt_id);
    const tally = answeredByAttempt.get(key) || { correct: 0, answered: 0 };
    tally.answered += 1;
    if (response.is_correct) tally.correct += 1;
    answeredByAttempt.set(key, tally);
  }

  const attemptsByProfile = new Map<
    string,
    { id: string; status: string; submitted_at: string | null; correct: number; answered: number }
  >();
  for (const attempt of attempts || []) {
    const tally = answeredByAttempt.get(String(attempt.id)) || { correct: 0, answered: 0 };
    attemptsByProfile.set(String(attempt.profile_id), {
      id: String(attempt.id),
      status: String(attempt.status),
      submitted_at: attempt.submitted_at ? String(attempt.submitted_at) : null,
      correct: tally.correct,
      answered: tally.answered
    });
  }

  // question_count is what the instance was opened with. Fall back to the widest
  // attempt actually seen, so a legacy instance with a null count still grades
  // against a real denominator instead of dividing by zero.
  const widestAttempt = Math.max(0, ...Array.from(attemptsByProfile.values()).map((a) => a.answered));
  const questionCount = Number(instance.question_count || 0) || widestAttempt;

  return { instance, questionCount, attemptsByProfile };
}

/** True when someone submitted the quiz or answered at least one question. */
export function quizPhaseRan(quiz: Awaited<ReturnType<typeof loadQuiz>>) {
  for (const attempt of quiz.attemptsByProfile.values()) {
    if (attempt.submitted_at || attempt.answered > 0) return true;
  }
  return false;
}

export type OverrideRow = {
  grade: number | null;
  calculated_grade: number | null;
  reason: string;
  actor_name: string;
  created_at: string;
};

export async function loadOverrides(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("class_grade_overrides")
    .select("profile_id, grade, calculated_grade, reason, actor_profile_id, created_at")
    .eq("class_session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!(data || []).length) return new Map<string, OverrideRow[]>();

  const actorIds = Array.from(new Set((data || []).map((row) => String(row.actor_profile_id))));
  const { data: actors, error: actorError } = await db
    .from("profiles")
    .select("id, full_name, preferred_name")
    .in("id", actorIds);
  if (actorError) throw actorError;
  const actorNames = new Map(
    (actors || []).map((person) => [
      String(person.id),
      String(person.preferred_name || person.full_name || "Instructor")
    ])
  );

  const byProfile = new Map<string, OverrideRow[]>();
  for (const row of data || []) {
    const key = String(row.profile_id);
    if (!byProfile.has(key)) byProfile.set(key, []);
    byProfile.get(key)!.push({
      grade: row.grade === null ? null : Number(row.grade),
      calculated_grade: row.calculated_grade === null ? null : Number(row.calculated_grade),
      reason: String(row.reason || ""),
      actor_name: actorNames.get(String(row.actor_profile_id)) || "Instructor",
      created_at: String(row.created_at)
    });
  }
  return byProfile;
}

/**
 * Every student in the class, graded, with the arithmetic behind each number.
 *
 * Returns the totals alongside the rows because the professor's class record
 * prints them as the header of the same table — recomputing them at the call
 * site would be a second place for the denominator to drift.
 */
export async function classGradingRows(db: Db, session: ClassGradeSession) {
  const roster = await loadRoster(db, String(session.section_id));
  const [pulse, quiz, reflections, overrides] = await Promise.all([
    loadPulse(db, session.id),
    loadQuiz(db, session.id),
    loadReflections(db, session.id),
    loadOverrides(db, session.id)
  ]);

  // A quiz nobody ever finished or answered is a quiz that was never given —
  // the class was cut short. Its question count must not stand as a
  // denominator, and the reflection that was never asked for must not cost
  // anyone 20%.
  const endOfClassRan = quizPhaseRan(quiz);

  const rows = roster.map((student) => {
    const answers = pulse.answersByProfile.get(student.profile_id) || [];
    const gradedAnswers = answers.filter((answer) => pulse.gradedRoundIds.has(answer.round_id));
    const attempt = quiz.attemptsByProfile.get(student.profile_id) || null;
    const submissionAt = reflections.get(student.profile_id) || null;

    const breakdown = computeGrade({
      // A graded question that was never answered is wrong, not excused. The
      // denominator is every graded question pushed to the room.
      pulseCorrect: gradedAnswers.filter((answer) => answer.is_correct).length,
      pulseTotal: pulse.gradedRoundCount,
      quizCorrect: endOfClassRan ? attempt?.correct ?? 0 : 0,
      quizTotal: endOfClassRan ? quiz.questionCount : 0,
      submissionPresent: Boolean(submissionAt),
      submissionRequired: endOfClassRan
    });

    const history = overrides.get(student.profile_id) || [];
    const active = history[0] && history[0].grade !== null ? history[0] : null;

    return {
      ...student,
      ...breakdown,
      submission_at: submissionAt,
      quiz_status: attempt?.status ?? null,
      quiz_submitted_at: attempt?.submitted_at ?? null,
      override_grade: active ? active.grade : null,
      override_reason: active ? active.reason : null,
      override_at: active ? active.created_at : null,
      override_by: active ? active.actor_name : null,
      // What the professor is actually reporting for this student. The
      // calculated grade above never changes to match it — an override replaces
      // what is reported, never what was computed.
      final_grade: active ? active.grade : breakdown.calculated_grade,
      override_history: history
    };
  });

  return {
    totals: {
      graded_pulse_questions: pulse.gradedRoundCount,
      pulse_rounds_pushed: pulse.roundCount,
      quiz_questions: endOfClassRan ? quiz.questionCount : 0,
      quiz_instance_id: quiz.instance ? String(quiz.instance.id) : null
    },
    rows
  };
}

/**
 * Write class grades into the gradebook, which is also what lets the student
 * read them: `studentClassGrades` above only reports a class that has a posted
 * score, and that gate is deliberate — a grade must not appear on a phone
 * merely because a screen was opened.
 *
 * `profileIds` is the whole point of the parameter list. Posting the entire
 * roster whenever ONE student finishes would hand every classmate who has not
 * written their reflection yet a grade carrying the 20% missing-submission
 * penalty — a punishment for something they still have time to do. The exit
 * ticket therefore posts exactly one row; only the class closing posts the room.
 */
export async function postClassGrades(
  db: Db,
  session: ClassGradeSession,
  options: {
    /** Restrict the write to these students. Omit for the whole roster. */
    profileIds?: string[];
    /** Null when nobody pressed anything — the class ended, or a ticket landed. */
    actorProfileId?: string | null;
    /** What caused this write, for the audit log. */
    trigger: "reflection_submitted" | "class_closed" | "grade_override";
  }
) {
  const { rows } = await classGradingRows(db, session);
  const wanted = options.profileIds ? new Set(options.profileIds) : null;
  const scoped = wanted ? rows.filter((row) => wanted.has(row.profile_id)) : rows;

  const gradable = scoped.filter((row) => row.final_grade !== null);
  const skipped = scoped.length - gradable.length;
  if (!gradable.length) return { gradebook_item_id: null, posted: 0, skipped };

  const categoryId = await ensureGradebookCategory(db, session.course_id);
  const itemId = await ensureGradebookItem(db, session, categoryId);

  const now = new Date().toISOString();
  const { error } = await db.from("gradebook_scores").upsert(
    gradable.map((row) => ({
      gradebook_item_id: itemId,
      profile_id: row.profile_id,
      section_id: session.section_id,
      // score_raw keeps what the formula produced; score_final is what is
      // reported. When they differ, an override is the reason, and the reason
      // itself lives in class_grade_overrides.
      score_raw: row.calculated_grade,
      score_percent: row.raw_score_percent,
      score_final: row.final_grade,
      status: "posted",
      updated_at: now
    })),
    { onConflict: "gradebook_item_id,profile_id" }
  );
  if (error) throw error;

  await db.from("audit_log").insert({
    course_id: session.course_id,
    actor_profile_id: options.actorProfileId ?? null,
    target_type: "gradebook_item",
    target_id: itemId,
    action: "post_class_grades",
    metadata: {
      class_session_id: session.id,
      trigger: options.trigger,
      posted: gradable.length,
      skipped
    }
  });

  return { gradebook_item_id: itemId, posted: gradable.length, skipped };
}

/**
 * Posting must never be the reason a student cannot hand in their reflection,
 * or a professor cannot end their class. Both callers are doing something else
 * that already succeeded; a gradebook write that fails is a number that shows
 * up a moment later, when the next trigger fires.
 */
export async function postClassGradesQuietly(
  db: Db,
  session: ClassGradeSession,
  options: Parameters<typeof postClassGrades>[2]
) {
  try {
    return await postClassGrades(db, session, options);
  } catch (error) {
    console.error("Posting class grades failed", {
      class_session_id: session.id,
      trigger: options.trigger,
      error: (error as Error)?.message
    });
    return null;
  }
}

async function ensureGradebookCategory(db: Db, courseId: string) {
  const { data: existing, error } = await db
    .from("gradebook_categories")
    .select("id")
    .eq("course_id", courseId)
    .eq("name", CLASS_GRADE_CATEGORY_NAME)
    .maybeSingle();
  if (error) throw error;
  if (existing) return String(existing.id);

  // The category groups class grades; it does not weight them. There is one
  // grade per class and the course total is their plain average, so
  // weight_percent has nothing left to configure.
  const { data: created, error: createError } = await db
    .from("gradebook_categories")
    .insert({ course_id: courseId, name: CLASS_GRADE_CATEGORY_NAME, weight_percent: 100, status: "active" })
    .select("id")
    .single();
  if (createError) throw createError;
  return String(created.id);
}

/**
 * One item per class, found by its class session rather than by rebuilding its
 * title. Renaming a session used to strand its grades behind a title that no
 * longer matched and silently post a second item beside the first.
 */
async function ensureGradebookItem(db: Db, session: ClassGradeSession, categoryId: string) {
  const title = `Class ${session.sequence_number} — ${session.title}`.slice(0, 180);
  const { data: existing, error } = await db
    .from("gradebook_items")
    .select("id, title")
    .eq("class_session_id", session.id)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    // Keep the label current if the class was renamed since it was first posted.
    if (String(existing.title) !== title) {
      const { error: renameError } = await db
        .from("gradebook_items")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (renameError) throw renameError;
    }
    return String(existing.id);
  }

  const { data: created, error: createError } = await db
    .from("gradebook_items")
    .insert({
      course_id: session.course_id,
      category_id: categoryId,
      class_session_id: session.id,
      title,
      max_score: 100,
      status: "published"
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return String(created.id);
}
