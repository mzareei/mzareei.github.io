import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    const attemptId = String(body.attempt_id || "");
    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (!attemptId) throw new Error("Attempt ID is required.");

    const db = adminClient();
    const { data: attempt, error: attemptError } = await db
      .from("quiz_attempts")
      .select("id, submitted_at, quiz_sessions(show_explanations)")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) throw new Error("Attempt not found.");
    if (attempt.submitted_at) throw new Error("This attempt was already submitted.");

    const { data: attemptQuestions, error: questionError } = await db
      .from("quiz_attempt_questions")
      .select("id, question_id, option_order, points, quiz_questions(prompt, explanation, quiz_options(id, option_text, is_correct))")
      .eq("attempt_id", attemptId);

    if (questionError) throw questionError;
    const selectedByQuestion = new Map(
      answers.map((answer) => [String(answer.attempt_question_id), String(answer.option_id || "")])
    );

    let score = 0;
    let total = 0;
    const rows = [];
    const details = [];

    for (const attemptQuestion of attemptQuestions || []) {
      const selectedOptionId = selectedByQuestion.get(attemptQuestion.id) || null;
      if (selectedOptionId && !(attemptQuestion.option_order || []).includes(selectedOptionId)) {
        throw new Error("Selected option does not belong to this attempt.");
      }

      const question = attemptQuestion.quiz_questions;
      const correctOption = (question.quiz_options || []).find((option) => option.is_correct);
      const isCorrect = correctOption?.id === selectedOptionId;
      const points = Number(attemptQuestion.points || 1);
      const awarded = isCorrect ? points : 0;
      score += awarded;
      total += points;

      rows.push({
        attempt_question_id: attemptQuestion.id,
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
        points_awarded: awarded
      });

      details.push({
        attempt_question_id: attemptQuestion.id,
        prompt: question.prompt,
        correct: isCorrect,
        explanation: attempt.quiz_sessions?.show_explanations ? question.explanation : null
      });
    }

    const { error: answerError } = await db.from("quiz_answers").insert(rows);
    if (answerError) throw answerError;

    const { error: updateError } = await db
      .from("quiz_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        score,
        total
      })
      .eq("id", attemptId);

    if (updateError) throw updateError;

    return json({
      score,
      total,
      percentage: Math.round((score / total) * 100),
      details
    });
  } catch (error) {
    return json({ error: error.message || "Unable to submit attempt." }, { status: 400 });
  }
});
