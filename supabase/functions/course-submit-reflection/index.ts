import { adminClient } from "../_shared/client.ts";
import { handleOptions, json } from "../_shared/cors.ts";

const lectures: Record<string, string> = {
  "tc2007b-w1-l1": "Week 1 Lecture 1 · Introduction to Cybersecurity",
  "tc2007b-w1-l2": "Week 1 Lecture 2 · Legal and Ethical Aspects",
  "tc2007b-w2-l1": "Week 2 Lecture 1 · Authentication",
  "tc2007b-w2-l2": "Week 2 Lecture 2 · Access Control",
  "tc2007b-w3-l1": "Week 3 Lecture 1 · Database and Application Security",
  "tc2007b-w4-bridge": "Week 4 Bridge · Secure Coding and Release Risk",
  "tc2007b-w5-l1": "Week 5 Lecture 1 · Asymmetric Encryption",
  "tc2007b-w6-bridge": "Week 6 Bridge · Symmetric Crypto and Key Handling",
  "tc2007b-w7-l1": "Week 7 · Security Protocols and Hash Functions",
  "tc2007b-w8-bridge": "Week 8 Bridge · TLS and Secure Channels",
  "tc2007b-w9-l1": "Week 9 · Malicious Code",
  "tc2007b-w10-l1": "Week 10 Lecture 1 · Firewalls",
  "tc2007b-w11-l1": "Week 11 · Intrusion Detection"
};

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, { status: 405 });

  try {
    const body = await request.json();
    const lectureId = clean(body.lecture_id, 80) || "tc2007b-w1-l1";
    const ticket = {
      course_id: "tc2007b",
      lecture_id: lectureId,
      lecture_title: clean(body.lecture_title, 160) || lectures[lectureId] || lectureId,
      student_name: clean(body.student_name, 120),
      student_identifier: clean(body.student_identifier, 80),
      confidence: clamp(Number(body.confidence || 3), 1, 5),
      one_thing: clean(body.one_thing, 500),
      muddy_point: clean(body.muddy_point, 500),
      next_action: clean(body.next_action || "review_mission", 40)
    };

    if (!ticket.one_thing) throw new Error("One idea that clicked is required.");
    if (!ticket.muddy_point) throw new Error("One question or muddy point is required.");

    const db = adminClient();
    const { data, error } = await db
      .from("course_exit_tickets")
      .insert(ticket)
      .select("id, course_id, lecture_id, lecture_title, confidence, one_thing, muddy_point, next_action, created_at")
      .single();
    if (error) throw error;

    return json({ ticket: data });
  } catch (error) {
    return json({ error: error.message || "Unable to save exit ticket." }, { status: 400 });
  }
});

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
