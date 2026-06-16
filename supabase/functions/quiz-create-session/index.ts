import { adminClient, assertTeacherPin } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    assertTeacherPin(body.teacher_pin);

    const lectureId = String(body.lecture_id || "tc2007b-w1-l1");
    const questionCount = clamp(Number(body.question_count || 10), 1, 30);
    const durationMinutes = clamp(Number(body.duration_minutes || 8), 1, 90);
    const sessionCode = normalizeCode(body.session_code) || makeCode();
    const closesAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    const db = adminClient();
    const { data, error } = await db
      .from("quiz_sessions")
      .insert({
        session_code: sessionCode,
        lecture_id: lectureId,
        title: String(body.title || "Quick Quiz"),
        question_count: questionCount,
        closes_at: closesAt,
        show_explanations: Boolean(body.show_explanations),
        status: "open"
      })
      .select("id, session_code, lecture_id, title, question_count, starts_at, closes_at, status")
      .single();

    if (error) throw error;
    return json(data);
  } catch (error) {
    return json({ error: error.message || "Unable to create session." }, { status: 400 });
  }
});

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
