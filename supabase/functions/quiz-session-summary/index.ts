import { adminClient, assertTeacherPin } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    assertTeacherPin(body.teacher_pin);
    const sessionCode = normalizeCode(body.session_code);
    if (!sessionCode) throw new Error("Session code is required.");

    const db = adminClient();
    const { data: session, error: sessionError } = await db
      .from("quiz_sessions")
      .select("id, session_code, lecture_id, title, question_count, starts_at, closes_at, status")
      .eq("session_code", sessionCode)
      .single();

    if (sessionError || !session) throw new Error("Session not found.");

    const { data: attempts, error: attemptError } = await db
      .from("quiz_attempts")
      .select("id, student_name, student_identifier, started_at, submitted_at, score, total")
      .eq("session_id", session.id)
      .order("started_at", { ascending: false });

    if (attemptError) throw attemptError;
    const enrichedAttempts = (attempts || [])
      .map((attempt) => ({
        ...attempt,
        ...attemptMetrics(attempt, session)
      }))
      .sort(compareAttempts)
      .map((attempt, index) => ({
        ...attempt,
        rank: attempt.submitted_at ? index + 1 : null
      }));
    const submitted = enrichedAttempts.filter((attempt) => attempt.submitted_at);
    const averageScore = submitted.length
      ? submitted.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / submitted.length
      : 0;
    const averageGrade = submitted.length
      ? submitted.reduce((sum, attempt) => sum + Number(attempt.grade_percent || 0), 0) / submitted.length
      : 0;
    const averageAScore = submitted.length
      ? submitted.reduce((sum, attempt) => sum + Number(attempt.a_score || 0), 0) / submitted.length
      : 0;
    const total = submitted[0]?.total || session.question_count;

    return json({
      session,
      attempts: enrichedAttempts,
      stats: {
        started: enrichedAttempts.length,
        submitted: submitted.length,
        average_score: averageScore,
        average_grade_percent: round1(averageGrade),
        average_a_score: round1(averageAScore),
        total
      }
    });
  } catch (error) {
    return json({ error: error.message || "Unable to load summary." }, { status: 400 });
  }
});

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function attemptMetrics(attempt: Record<string, unknown>, session: Record<string, unknown>) {
  const score = Number(attempt.score || 0);
  const total = Number(attempt.total || session.question_count || 10);
  const submitted = Boolean(attempt.submitted_at);
  const gradePercent = submitted && total ? (score / total) * 100 : null;
  const startedAt = new Date(String(attempt.started_at || session.starts_at || Date.now())).getTime();
  const submittedAt = submitted ? new Date(String(attempt.submitted_at)).getTime() : null;
  const sessionStart = new Date(String(session.starts_at || attempt.started_at || Date.now())).getTime();
  const sessionEnd = new Date(String(session.closes_at || sessionStart + 8 * 60000)).getTime();
  const durationSeconds = Math.max(1, Math.round((sessionEnd - sessionStart) / 1000));
  const elapsedSeconds = submittedAt ? Math.max(0, Math.round((submittedAt - startedAt) / 1000)) : null;
  const accuracyRatio = total ? score / total : 0;
  const remainingRatio = elapsedSeconds == null ? 0 : Math.max(0, 1 - elapsedSeconds / durationSeconds);
  const speedBonus = submitted ? 10 * accuracyRatio * remainingRatio : null;
  const aScore = submitted ? Number(gradePercent || 0) + Number(speedBonus || 0) : null;

  return {
    grade_percent: gradePercent == null ? null : round1(gradePercent),
    elapsed_seconds: elapsedSeconds,
    speed_bonus: speedBonus == null ? null : round1(speedBonus),
    a_score: aScore == null ? null : round1(aScore)
  };
}

function compareAttempts(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aSubmitted = a.submitted_at ? 1 : 0;
  const bSubmitted = b.submitted_at ? 1 : 0;
  if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
  const aScore = Number(a.a_score ?? -1);
  const bScore = Number(b.a_score ?? -1);
  if (aScore !== bScore) return bScore - aScore;
  const aGrade = Number(a.grade_percent ?? -1);
  const bGrade = Number(b.grade_percent ?? -1);
  if (aGrade !== bGrade) return bGrade - aGrade;
  const aElapsed = Number(a.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  const bElapsed = Number(b.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  if (aElapsed !== bElapsed) return aElapsed - bElapsed;
  return String(a.started_at).localeCompare(String(b.started_at));
}

function round1(value: number) {
  return Math.round(Number(value || 0) * 10) / 10;
}
