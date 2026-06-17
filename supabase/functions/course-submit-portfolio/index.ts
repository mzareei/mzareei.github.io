import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    const portfolio = normalizePortfolio(body.portfolio || body);
    const summary = portfolio.summary || {};
    const student = portfolio.student || {};
    const encoded = JSON.stringify(portfolio);
    if (encoded.length > 200000) throw new Error("Portfolio export is too large.");

    const submission = {
      course_id: "tc2007b",
      student_name: clean(student.name, 120),
      student_identifier: clean(student.id, 80),
      overall_percent: percent(summary.overall_percent),
      mission_average: percent(summary.mission_average),
      quiz_average: percent(summary.quiz_average),
      case_completed: clampInt(summary.case_completed, 0, 5),
      attack_chain_percent: percent(summary.attack_chain_percent),
      concept_map_percent: percent(summary.concept_map_percent),
      review_cards: clampInt(summary.review_cards, 0, 500),
      reflections: clampInt(summary.reflections, 0, 500),
      portfolio
    };

    if (!submission.student_name && !submission.student_identifier) {
      throw new Error("Student name or ID is required.");
    }

    const db = adminClient();
    const { data, error } = await db
      .from("course_portfolio_submissions")
      .insert(submission)
      .select("id, course_id, student_name, student_identifier, overall_percent, mission_average, quiz_average, case_completed, attack_chain_percent, concept_map_percent, review_cards, reflections, created_at")
      .single();
    if (error) throw error;

    return json({ submission: data });
  } catch (error) {
    return json({ error: error.message || "Unable to save portfolio." }, { status: 400 });
  }
});

function normalizePortfolio(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Portfolio object is required.");
  }
  return value as Record<string, any>;
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function percent(value: unknown) {
  return clampInt(value, 0, 100);
}

function clampInt(value: unknown, min: number, max: number) {
  const number = Math.round(Number(value || 0));
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : 0));
}
