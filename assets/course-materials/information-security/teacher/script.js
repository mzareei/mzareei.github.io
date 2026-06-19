import { isConfigured, lectures, reflectionSummary } from "../exit-ticket/reflection-api.js";

const CONFIG = window.QUIZ_CONFIG || {};
const lectureId = document.getElementById("lectureId");
const teacherPin = document.getElementById("teacherPin");
const loadBtn = document.getElementById("loadBtn");
const loadParticipationBtn = document.getElementById("loadParticipationBtn");
const exportParticipationBtn = document.getElementById("exportParticipationBtn");
const insightStatus = document.getElementById("insightStatus");
const ticketStat = document.getElementById("ticketStat");
const avgConfidence = document.getElementById("avgConfidence");
const lowConfidence = document.getElementById("lowConfidence");
const actionList = document.getElementById("actionList");
const muddyList = document.getElementById("muddyList");
const ticketList = document.getElementById("ticketList");
const semesterStats = document.getElementById("semesterStats");
const participationRows = document.getElementById("participationRows");

let lastParticipationSummary = null;

populateLectures();
renderParticipationEmpty();

loadBtn.addEventListener("click", loadInsights);
loadParticipationBtn.addEventListener("click", loadParticipation);
exportParticipationBtn.addEventListener("click", exportParticipationCsv);
loadInsights();

async function loadInsights() {
  setStatus("Loading...", "");
  loadBtn.disabled = true;
  try {
    if (isConfigured() && !teacherPin.value) {
      setStatus("Enter the teacher PIN to load Supabase reflections.", "warn");
      renderSummary(emptySummary());
      return;
    }
    const summary = await reflectionSummary({
      lecture_id: lectureId.value,
      teacher_pin: teacherPin.value
    });
    renderSummary(summary);
    setStatus(summary.mode === "local" ? "Showing local browser reflections." : "Updated from Supabase.", "good");
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    loadBtn.disabled = false;
  }
}

function renderSummary(summary) {
  const stats = summary.stats || {};
  const tickets = summary.tickets || [];
  ticketStat.textContent = String(stats.total || tickets.length || 0);
  avgConfidence.textContent = String(stats.average_confidence || 0);
  lowConfidence.textContent = String(stats.low_confidence || 0);
  renderCounts(actionList, summary.action_counts || [], "No action data yet.");
  renderMuddy(summary.muddy_points || []);
  renderTickets(tickets);
}

async function loadParticipation() {
  if (!isConfigured()) {
    setStatus("Supabase is required for semester participation.", "warn");
    return;
  }
  if (!teacherPin.value) {
    setStatus("Enter the teacher PIN to load semester participation.", "warn");
    return;
  }
  loadParticipationBtn.disabled = true;
  setStatus("Loading semester summary...", "");
  try {
    const summary = await callFunction("course-participation-summary", {
      teacher_pin: teacherPin.value
    });
    lastParticipationSummary = summary;
    renderParticipation(summary);
    setStatus("Semester summary loaded.", "good");
  } catch (error) {
    setStatus(error.message || "Unable to load semester summary.", "danger");
  } finally {
    loadParticipationBtn.disabled = false;
  }
}

function renderParticipation(summary) {
  const stats = summary.stats || {};
  semesterStats.innerHTML = "";
  [
    ["Students", stats.students || 0],
    ["Quiz avg", `${stats.average_quiz_percent || 0}%`],
    ["Portfolio avg", `${stats.average_portfolio_percent || 0}%`],
    ["Needs attention", stats.needs_attention || 0]
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.innerHTML = "<strong></strong><span></span>";
    card.querySelector("strong").textContent = value;
    card.querySelector("span").textContent = label;
    semesterStats.appendChild(card);
  });

  const students = summary.students || [];
  participationRows.innerHTML = "";
  if (!students.length) {
    participationRows.innerHTML = `<tr><td colspan="7">No semester records found yet.</td></tr>`;
    return;
  }
  students.slice(0, 120).forEach((student) => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td><strong></strong></td><td></td>";
    tr.children[0].textContent = student.student_name || "Unnamed";
    tr.children[1].textContent = student.student_identifier || "";
    tr.children[2].textContent = `${student.quiz_average || 0}% · ${student.quiz_submissions || 0}/${student.quiz_attempts || 0}`;
    tr.children[3].textContent = `${student.reflections || 0} · conf ${student.average_confidence || 0}/5`;
    tr.children[4].textContent = `${student.portfolio_overall || 0}%`;
    tr.querySelector("strong").textContent = student.participation_signal || "Needs attention";
    tr.children[6].textContent = readableDate(student.last_activity);
    participationRows.appendChild(tr);
  });
}

function renderParticipationEmpty() {
  semesterStats.innerHTML = "";
  participationRows.innerHTML = `<tr><td colspan="7">Load semester participation after students submit quizzes, reflections, or portfolios.</td></tr>`;
}

function exportParticipationCsv() {
  const students = lastParticipationSummary?.students || [];
  if (!students.length) {
    setStatus("Load semester participation before exporting.", "warn");
    return;
  }
  const rows = [
    ["student_name", "student_identifier", "quiz_attempts", "quiz_submissions", "quiz_average", "reflections", "average_confidence", "low_confidence", "portfolio_overall", "portfolio_mission_average", "portfolio_quiz_average", "portfolio_cases", "participation_score", "participation_signal", "last_activity"],
    ...students.map((student) => [
      student.student_name || "",
      student.student_identifier || "",
      student.quiz_attempts || 0,
      student.quiz_submissions || 0,
      student.quiz_average || 0,
      student.reflections || 0,
      student.average_confidence || 0,
      student.low_confidence || 0,
      student.portfolio_overall || 0,
      student.portfolio_mission_average || 0,
      student.portfolio_quiz_average || 0,
      student.portfolio_cases || 0,
      student.participation_score || 0,
      student.participation_signal || "",
      student.last_activity || ""
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tc2007b-semester-participation-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Semester CSV exported.", "good");
}

function populateLectures() {
  const requested = new URLSearchParams(window.location.search).get("lecture");
  lectureId.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All active lectures";
  lectureId.appendChild(allOption);
  Object.entries(lectures).forEach(([id, title]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = title;
    lectureId.appendChild(option);
  });
  if (requested && lectures[requested]) lectureId.value = requested;
}

function renderCounts(container, rows, emptyText) {
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = `<article class="insight-item"><span>${emptyText}</span></article>`;
    return;
  }
  rows.slice(0, 5).forEach((row) => {
    const item = document.createElement("article");
    item.className = "insight-item";
    item.innerHTML = `<strong></strong><span></span>`;
    item.querySelector("strong").textContent = labelAction(row.label);
    item.querySelector("span").textContent = `${row.count} student${row.count === 1 ? "" : "s"}`;
    container.appendChild(item);
  });
}

function renderMuddy(rows) {
  muddyList.innerHTML = "";
  if (!rows.length) {
    muddyList.innerHTML = `<article class="insight-item"><span>No muddy points yet.</span></article>`;
    return;
  }
  rows.slice(0, 10).forEach((row) => {
    const item = document.createElement("article");
    item.className = "insight-item";
    item.innerHTML = `<strong></strong><p></p><span></span>`;
    item.querySelector("strong").textContent = row.lecture_title || "Reflection";
    item.querySelector("p").textContent = row.text;
    item.querySelector("span").textContent = `Confidence ${row.confidence || "-"} / 5`;
    muddyList.appendChild(item);
  });
}

function renderTickets(rows) {
  ticketList.innerHTML = "";
  if (!rows.length) {
    ticketList.innerHTML = `<article class="insight-item"><span>No reflections saved yet.</span></article>`;
    return;
  }
  rows.slice(0, 12).forEach((ticket) => {
    const item = document.createElement("article");
    item.className = "insight-item";
    item.innerHTML = `<strong></strong><p></p><span></span>`;
    item.querySelector("strong").textContent = ticket.student_name || ticket.student_identifier || "Student";
    item.querySelector("p").textContent = ticket.one_thing || "";
    item.querySelector("span").textContent = `${ticket.lecture_title || ticket.lecture_id} · ${new Date(ticket.created_at).toLocaleString()}`;
    ticketList.appendChild(item);
  });
}

function emptySummary() {
  return {
    tickets: [],
    stats: { total: 0, average_confidence: 0, low_confidence: 0 },
    action_counts: [],
    muddy_points: []
  };
}

function labelAction(value) {
  const labels = {
    review_mission: "Review the mission",
    take_quiz: "Take or retake the quiz",
    ask_question: "Ask a question next class",
    explain_peer: "Explain to a classmate"
  };
  return labels[value] || value;
}

function setStatus(message, tone) {
  insightStatus.textContent = message;
  if (tone) insightStatus.dataset.tone = tone;
  else insightStatus.removeAttribute("data-tone");
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
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}.`);
  return body;
}

function readableDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
