const CONFIG = window.QUIZ_CONFIG || {};
const STORAGE_KEY = "tc2007b-exit-tickets";

export const lectures = {
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

export function isConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

export async function submitExitTicket(payload) {
  const ticket = normalizeTicket(payload);
  saveLocal(ticket);
  if (!isConfigured()) {
    return { ticket, mode: "local" };
  }
  const remote = await callFunction("course-submit-reflection", ticket);
  return { ticket: remote.ticket || ticket, mode: "supabase" };
}

export async function reflectionSummary(payload) {
  if (!isConfigured()) {
    return localSummary(payload);
  }
  return callFunction("course-reflection-summary", payload);
}

export function readLocalTickets() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function saveLocal(ticket) {
  const tickets = readLocalTickets();
  tickets.unshift(ticket);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets.slice(0, 80)));
}

function normalizeTicket(payload) {
  const lectureId = String(payload.lecture_id || "tc2007b-w1-l1");
  return {
    id: payload.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    course_id: "tc2007b",
    lecture_id: lectureId,
    lecture_title: lectures[lectureId] || lectureId,
    student_name: clean(payload.student_name, 120),
    student_identifier: clean(payload.student_identifier, 80),
    confidence: clamp(Number(payload.confidence || 3), 1, 5),
    one_thing: clean(payload.one_thing, 500),
    muddy_point: clean(payload.muddy_point, 500),
    next_action: clean(payload.next_action || "review_mission", 40),
    created_at: payload.created_at || new Date().toISOString()
  };
}

function localSummary(payload = {}) {
  const lectureId = String(payload.lecture_id || "");
  const tickets = readLocalTickets().filter((ticket) => !lectureId || ticket.lecture_id === lectureId);
  const averageConfidence = tickets.length
    ? tickets.reduce((sum, ticket) => sum + Number(ticket.confidence || 0), 0) / tickets.length
    : 0;
  const actionCounts = countBy(tickets, "next_action");
  const lectureCounts = countBy(tickets, "lecture_title");
  return {
    mode: "local",
    tickets: tickets.slice(0, 40),
    stats: {
      total: tickets.length,
      average_confidence: round1(averageConfidence),
      low_confidence: tickets.filter((ticket) => Number(ticket.confidence || 0) <= 2).length
    },
    action_counts: actionCounts,
    lecture_counts: lectureCounts,
    muddy_points: tickets
      .filter((ticket) => ticket.muddy_point)
      .slice(0, 8)
      .map((ticket) => ({
        text: ticket.muddy_point,
        lecture_title: ticket.lecture_title,
        confidence: ticket.confidence
      }))
  };
}

async function callFunction(name, payload) {
  const base = CONFIG.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }
  return body;
}

function countBy(rows, key) {
  const counts = {};
  rows.forEach((row) => {
    const value = row[key] || "Unspecified";
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
