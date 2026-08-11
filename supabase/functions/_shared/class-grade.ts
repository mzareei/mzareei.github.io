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
  const penaltyApplied = gradable && !input.submissionPresent;
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

  const [pulse, quiz, submissions, overrides] = await Promise.all([
    loadStudentPulse(db, sessionIds, profileId),
    loadStudentQuiz(db, sessionIds, profileId),
    loadStudentSubmissions(db, sessionIds, profileId),
    loadStudentOverrides(db, sessionIds, profileId)
  ]);

  return (sessions || [])
    .map((session) => {
      const sessionId = String(session.id);
      const pulseTally = pulse.get(sessionId) || { correct: 0, graded: 0 };
      const quizTally = quiz.get(sessionId) || { correct: 0, total: 0 };
      const score = posted.get(sessionId)!;

      const breakdown = computeGrade({
        // A graded question that was never answered is wrong, not excused. The
        // denominator is every graded question pushed to the room.
        pulseCorrect: pulseTally.correct,
        pulseTotal: pulseTally.graded,
        quizCorrect: quizTally.correct,
        quizTotal: quizTally.total,
        submissionPresent: submissions.has(sessionId)
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
