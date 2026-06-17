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
    const { data, error } = await db
      .from("course_portfolio_submissions")
      .select("id, student_name, student_identifier, overall_percent, mission_average, quiz_average, case_completed, attack_chain_percent, concept_map_percent, review_cards, reflections, created_at")
      .eq("course_id", "tc2007b")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const submissions = data || [];
    return json({
      submissions: submissions.slice(0, 100),
      stats: {
        total: submissions.length,
        average_overall: average(submissions.map((row) => row.overall_percent)),
        low_evidence: submissions.filter((row) => Number(row.overall_percent || 0) < 70).length,
        average_concept_map: average(submissions.map((row) => row.concept_map_percent))
      },
      gaps: [
        ["Quiz below 70", submissions.filter((row) => Number(row.quiz_average || 0) < 70).length],
        ["Concept map below 70", submissions.filter((row) => Number(row.concept_map_percent || 0) < 70).length],
        ["Attack chain below 70", submissions.filter((row) => Number(row.attack_chain_percent || 0) < 70).length],
        ["Less than 3 cases", submissions.filter((row) => Number(row.case_completed || 0) < 3).length],
        ["Few review cards", submissions.filter((row) => Number(row.review_cards || 0) < 5).length]
      ].map(([label, count]) => ({ label, count }))
    });
  } catch (error) {
    return json({ error: error.message || "Unable to load portfolio summary." }, { status: 400 });
  }
});

function average(values: unknown[]) {
  const usable = values.map((value) => Number(value || 0)).filter(Number.isFinite);
  return usable.length ? Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 10) / 10 : 0;
}
