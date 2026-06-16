import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    const sessionCode = normalizeCode(body.session_code);
    const studentName = String(body.student_name || "").trim();
    const studentIdentifier = String(body.student_identifier || "").trim();
    if (!sessionCode) throw new Error("Session code is required.");
    if (!studentName) throw new Error("Student name is required.");
    if (!studentIdentifier) throw new Error("Student ID is required.");

    const db = adminClient();
    const { data: session, error: sessionError } = await db
      .from("quiz_sessions")
      .select("id, session_code, lecture_id, title, question_count, closes_at, status")
      .eq("session_code", sessionCode)
      .single();

    if (sessionError || !session) throw new Error("Session not found.");
    if (session.status !== "open") throw new Error("This session is closed.");
    if (session.closes_at && new Date(session.closes_at).getTime() < Date.now()) {
      throw new Error("This session has expired.");
    }

    const { data: existing } = await db
      .from("quiz_attempts")
      .select("id, submitted_at")
      .eq("session_id", session.id)
      .eq("student_identifier", studentIdentifier)
      .maybeSingle();
    if (existing?.submitted_at) throw new Error("This student ID already submitted.");
    if (existing?.id) return json(await buildAttemptResponse(db, existing.id, session));

    const { data: questions, error: questionError } = await db
      .from("quiz_questions")
      .select("id, prompt, points, quiz_options(id, option_text, position)")
      .eq("lecture_id", session.lecture_id)
      .eq("active", true);

    if (questionError) throw questionError;
    const usableQuestions = (questions || []).filter((question) => (question.quiz_options || []).length >= 2);
    if (usableQuestions.length < session.question_count) {
      throw new Error("Not enough active questions in the bank.");
    }

    const selected = shuffle(usableQuestions).slice(0, session.question_count);
    const { data: attempt, error: attemptError } = await db
      .from("quiz_attempts")
      .insert({
        session_id: session.id,
        student_name: studentName,
        student_identifier: studentIdentifier,
        total: selected.reduce((sum, question) => sum + Number(question.points || 1), 0)
      })
      .select("id")
      .single();

    if (attemptError) throw attemptError;

    const attemptRows = selected.map((question, index) => ({
      attempt_id: attempt.id,
      question_id: question.id,
      position: index + 1,
      option_order: shuffle((question.quiz_options || []).map((option) => option.id)),
      points: Number(question.points || 1)
    }));

    const { error: rowsError } = await db.from("quiz_attempt_questions").insert(attemptRows);
    if (rowsError) throw rowsError;

    return json(await buildAttemptResponse(db, attempt.id, session));
  } catch (error) {
    return json({ error: error.message || "Unable to start attempt." }, { status: 400 });
  }
});

async function buildAttemptResponse(db: ReturnType<typeof adminClient>, attemptId: string, session: Record<string, unknown>) {
  const { data: rows, error } = await db
    .from("quiz_attempt_questions")
    .select("id, position, option_order, quiz_questions(id, prompt, quiz_options(id, option_text, position))")
    .eq("attempt_id", attemptId)
    .order("position", { ascending: true });

  if (error) throw error;

  return {
    attempt_id: attemptId,
    session_code: session.session_code,
    title: session.title,
    closes_at: session.closes_at,
    questions: (rows || []).map((row) => {
      const question = row.quiz_questions;
      const optionsById = new Map((question.quiz_options || []).map((option) => [option.id, option]));
      return {
        attempt_question_id: row.id,
        position: row.position,
        prompt: question.prompt,
        options: (row.option_order || [])
          .map((optionId: string) => optionsById.get(optionId))
          .filter(Boolean)
          .map((option) => ({
            option_id: option.id,
            text: option.option_text
          }))
      };
    })
  };
}

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function shuffle<T>(items: T[]) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
