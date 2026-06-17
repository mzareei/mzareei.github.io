import { adminClient, assertTeacherPin } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

type ImportOption = {
  text?: string;
  is_correct?: boolean;
};

type ImportQuestion = {
  prompt?: string;
  explanation?: string;
  difficulty?: string;
  topic?: string[] | string;
  options?: ImportOption[];
};

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    assertTeacherPin(body.teacher_pin);
    const lectureId = String(body.lecture_id || "").trim();
    const questions = Array.isArray(body.questions) ? body.questions as ImportQuestion[] : [];
    if (!lectureId) throw new Error("Lecture ID is required.");
    if (!questions.length) throw new Error("At least one question is required.");

    questions.forEach(validateQuestion);

    const db = adminClient();
    const inserted = [];
    for (const question of questions) {
      const { data: questionRow, error: questionError } = await db
        .from("quiz_questions")
        .insert({
          lecture_id: lectureId,
          prompt: String(question.prompt || "").trim(),
          explanation: String(question.explanation || "").trim() || null,
          difficulty: normalizeDifficulty(question.difficulty),
          topic: normalizeTopics(question.topic),
          active: true
        })
        .select("id, prompt")
        .single();

      if (questionError) throw questionError;

      const optionRows = (question.options || []).map((option, index) => ({
        question_id: questionRow.id,
        option_text: String(option.text || "").trim(),
        is_correct: Boolean(option.is_correct),
        position: index + 1
      }));
      const { error: optionError } = await db.from("quiz_options").insert(optionRows);
      if (optionError) throw optionError;
      inserted.push(questionRow);
    }

    return json({ imported: inserted.length, questions: inserted });
  } catch (error) {
    return json({ error: error.message || "Unable to import questions." }, { status: 400 });
  }
});

function validateQuestion(question: ImportQuestion, index: number) {
  const label = `Question ${index + 1}`;
  if (!String(question.prompt || "").trim()) throw new Error(`${label}: prompt is required.`);
  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length < 2) throw new Error(`${label}: at least two options are required.`);
  options.forEach((option, optionIndex) => {
    if (!String(option.text || "").trim()) {
      throw new Error(`${label}, option ${optionIndex + 1}: text is required.`);
    }
  });
  const correctCount = options.filter((option) => option.is_correct).length;
  if (correctCount !== 1) throw new Error(`${label}: exactly one option must be marked correct.`);
}

function normalizeDifficulty(value: unknown) {
  const difficulty = String(value || "medium").trim().toLowerCase();
  return ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
}

function normalizeTopics(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
