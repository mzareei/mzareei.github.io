import { adminClient, assertTeacherPin } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    assertTeacherPin(body.teacher_pin);
    const lectureId = String(body.lecture_id || "").trim();

    const db = adminClient();
    let query = db
      .from("course_exit_tickets")
      .select("id, lecture_id, lecture_title, student_name, student_identifier, confidence, one_thing, muddy_point, next_action, created_at")
      .eq("course_id", "tc2007b")
      .order("created_at", { ascending: false })
      .limit(500);
    if (lectureId) query = query.eq("lecture_id", lectureId);

    const { data, error } = await query;
    if (error) throw error;
    const tickets = data || [];
    const averageConfidence = tickets.length
      ? tickets.reduce((sum, ticket) => sum + Number(ticket.confidence || 0), 0) / tickets.length
      : 0;

    return json({
      tickets: tickets.slice(0, 80),
      stats: {
        total: tickets.length,
        average_confidence: round1(averageConfidence),
        low_confidence: tickets.filter((ticket) => Number(ticket.confidence || 0) <= 2).length
      },
      action_counts: countBy(tickets, "next_action"),
      lecture_counts: countBy(tickets, "lecture_title"),
      muddy_points: tickets
        .filter((ticket) => ticket.muddy_point)
        .slice(0, 12)
        .map((ticket) => ({
          text: ticket.muddy_point,
          lecture_title: ticket.lecture_title,
          confidence: ticket.confidence
        }))
    });
  } catch (error) {
    return json({ error: error.message || "Unable to load reflection summary." }, { status: 400 });
  }
});

function countBy(rows: Record<string, unknown>[], key: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = String(row[key] || "Unspecified");
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function round1(value: number) {
  return Math.round(Number(value || 0) * 10) / 10;
}
