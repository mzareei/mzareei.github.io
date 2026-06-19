import { adminClient, assertTeacherPin } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    assertTeacherPin(body.teacher_pin);
    const db = adminClient();

    const [sessionsResult, ticketsResult, portfoliosResult] = await Promise.all([
      db
        .from("quiz_sessions")
        .select("id, session_code, lecture_id, title, starts_at")
        .order("starts_at", { ascending: false })
        .limit(300),
      db
        .from("course_exit_tickets")
        .select("id, lecture_id, lecture_title, student_name, student_identifier, confidence, created_at")
        .eq("course_id", "tc2007b")
        .order("created_at", { ascending: false })
        .limit(1000),
      db
        .from("course_portfolio_submissions")
        .select("id, student_name, student_identifier, overall_percent, mission_average, quiz_average, case_completed, attack_chain_percent, concept_map_percent, review_cards, reflections, created_at")
        .eq("course_id", "tc2007b")
        .order("created_at", { ascending: false })
        .limit(1000)
    ]);

    if (sessionsResult.error) throw sessionsResult.error;
    if (ticketsResult.error) throw ticketsResult.error;
    if (portfoliosResult.error) throw portfoliosResult.error;

    const sessions = sessionsResult.data || [];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const sessionIds = sessions.map((session) => session.id);
    const attempts = sessionIds.length ? await loadAttempts(db, sessionIds) : [];
    const rows = aggregateStudents({
      attempts,
      sessionById,
      tickets: ticketsResult.data || [],
      portfolios: portfoliosResult.data || []
    });

    return json({
      students: rows.slice(0, 500),
      stats: {
        students: rows.length,
        quiz_attempts: attempts.length,
        quiz_submissions: attempts.filter((attempt) => attempt.submitted_at).length,
        reflections: (ticketsResult.data || []).length,
        portfolios: (portfoliosResult.data || []).length,
        average_quiz_percent: average(rows.map((row) => row.quiz_average)),
        average_portfolio_percent: average(rows.map((row) => row.portfolio_overall)),
        needs_attention: rows.filter((row) => row.participation_signal === "Needs attention").length
      }
    });
  } catch (error) {
    return json({ error: error.message || "Unable to load participation summary." }, { status: 400 });
  }
});

async function loadAttempts(db: ReturnType<typeof adminClient>, sessionIds: string[]) {
  const { data, error } = await db
    .from("quiz_attempts")
    .select("id, session_id, student_name, student_identifier, started_at, submitted_at, score, total")
    .in("session_id", sessionIds)
    .order("started_at", { ascending: false })
    .limit(1500);
  if (error) throw error;
  return data || [];
}

function aggregateStudents({ attempts, sessionById, tickets, portfolios }: {
  attempts: Record<string, unknown>[];
  sessionById: Map<unknown, Record<string, unknown>>;
  tickets: Record<string, unknown>[];
  portfolios: Record<string, unknown>[];
}) {
  const students = new Map<string, Record<string, unknown>>();

  attempts.forEach((attempt) => {
    const student = ensureStudent(students, attempt.student_identifier, attempt.student_name);
    const session = sessionById.get(attempt.session_id) || {};
    const total = Number(attempt.total || 0);
    const score = Number(attempt.score || 0);
    const percent = attempt.submitted_at && total ? Math.round((score / total) * 100) : null;
    const quizRows = student.quiz_rows as Record<string, unknown>[];
    quizRows.push({
      lecture_id: session.lecture_id,
      title: session.title,
      session_code: session.session_code,
      percent,
      submitted_at: attempt.submitted_at,
      started_at: attempt.started_at
    });
    touch(student, attempt.submitted_at || attempt.started_at);
  });

  tickets.forEach((ticket) => {
    const student = ensureStudent(students, ticket.student_identifier, ticket.student_name);
    const reflectionRows = student.reflection_rows as Record<string, unknown>[];
    reflectionRows.push(ticket);
    touch(student, ticket.created_at);
  });

  portfolios.forEach((portfolio) => {
    const student = ensureStudent(students, portfolio.student_identifier, portfolio.student_name);
    const current = student.latest_portfolio as Record<string, unknown> | null;
    if (!current || String(portfolio.created_at || "") > String(current.created_at || "")) {
      student.latest_portfolio = portfolio;
    }
    touch(student, portfolio.created_at);
  });

  return Array.from(students.values())
    .map(finalizeStudent)
    .sort((a, b) => {
      const signal = signalWeight(a.participation_signal) - signalWeight(b.participation_signal);
      if (signal !== 0) return signal;
      return String(b.last_activity || "").localeCompare(String(a.last_activity || ""));
    });
}

function ensureStudent(students: Map<string, Record<string, unknown>>, rawId: unknown, rawName: unknown) {
  const studentId = normalizeStudentId(rawId);
  const fallback = normalizeStudentId(rawName) || "UNKNOWN";
  const key = studentId || fallback;
  if (!students.has(key)) {
    students.set(key, {
      student_identifier: studentId,
      student_name: cleanName(rawName),
      quiz_rows: [],
      reflection_rows: [],
      latest_portfolio: null,
      last_activity: ""
    });
  }
  const student = students.get(key)!;
  if (!student.student_name && cleanName(rawName)) student.student_name = cleanName(rawName);
  if (!student.student_identifier && studentId) student.student_identifier = studentId;
  return student;
}

function finalizeStudent(student: Record<string, unknown>) {
  const quizRows = student.quiz_rows as Record<string, unknown>[];
  const submittedQuizRows = quizRows.filter((row) => row.percent != null);
  const reflectionRows = student.reflection_rows as Record<string, unknown>[];
  const portfolio = student.latest_portfolio as Record<string, unknown> | null;
  const quizAverage = average(submittedQuizRows.map((row) => row.percent));
  const averageConfidence = average(reflectionRows.map((row) => row.confidence));
  const reflectionScore = Math.min(100, reflectionRows.length * 20);
  const portfolioScore = Number(portfolio?.overall_percent || 0);
  const participationScore = Math.round((quizAverage * 0.35) + (reflectionScore * 0.25) + (portfolioScore * 0.4));
  const signal = participationSignal({
    quizAverage,
    reflections: reflectionRows.length,
    portfolioScore,
    participationScore
  });

  return {
    student_name: student.student_name || "",
    student_identifier: student.student_identifier || "",
    quiz_attempts: quizRows.length,
    quiz_submissions: submittedQuizRows.length,
    quiz_average: quizAverage,
    reflections: reflectionRows.length,
    average_confidence: averageConfidence,
    low_confidence: reflectionRows.filter((row) => Number(row.confidence || 0) <= 2).length,
    portfolio_overall: portfolioScore,
    portfolio_mission_average: Number(portfolio?.mission_average || 0),
    portfolio_quiz_average: Number(portfolio?.quiz_average || 0),
    portfolio_cases: Number(portfolio?.case_completed || 0),
    portfolio_submitted_at: portfolio?.created_at || "",
    last_activity: student.last_activity || "",
    participation_score: participationScore,
    participation_signal: signal
  };
}

function participationSignal(row: { quizAverage: number; reflections: number; portfolioScore: number; participationScore: number }) {
  if (row.participationScore >= 80 && row.reflections >= 3 && row.portfolioScore >= 70) return "Strong";
  if (row.participationScore >= 60 && (row.quizAverage >= 70 || row.portfolioScore >= 70)) return "Developing";
  return "Needs attention";
}

function touch(student: Record<string, unknown>, value: unknown) {
  const stamp = String(value || "");
  if (stamp && stamp > String(student.last_activity || "")) student.last_activity = stamp;
}

function normalizeStudentId(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, 40);
}

function cleanName(value: unknown) {
  return String(value || "").trim().slice(0, 120);
}

function average(values: unknown[]) {
  const usable = values.map((value) => Number(value || 0)).filter(Number.isFinite);
  return usable.length ? Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 10) / 10 : 0;
}

function signalWeight(value: unknown) {
  const weights: Record<string, number> = {
    "Needs attention": 0,
    "Developing": 1,
    "Strong": 2
  };
  return weights[String(value)] ?? 3;
}
