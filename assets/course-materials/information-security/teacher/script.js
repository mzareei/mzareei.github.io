import { isConfigured, lectures, reflectionSummary } from "../exit-ticket/reflection-api.js";

const lectureId = document.getElementById("lectureId");
const teacherPin = document.getElementById("teacherPin");
const loadBtn = document.getElementById("loadBtn");
const insightStatus = document.getElementById("insightStatus");
const ticketStat = document.getElementById("ticketStat");
const avgConfidence = document.getElementById("avgConfidence");
const lowConfidence = document.getElementById("lowConfidence");
const actionList = document.getElementById("actionList");
const muddyList = document.getElementById("muddyList");
const ticketList = document.getElementById("ticketList");

populateLectures();

loadBtn.addEventListener("click", loadInsights);
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
