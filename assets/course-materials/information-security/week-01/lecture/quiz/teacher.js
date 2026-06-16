import { attemptMetrics, createSession, isConfigured, normalizeCode, sessionSummary, studentLinkFor } from "./quiz-api.js";

const form = document.getElementById("sessionForm");
const sessionCode = document.getElementById("sessionCode");
const questionCount = document.getElementById("questionCount");
const durationMinutes = document.getElementById("durationMinutes");
const teacherPin = document.getElementById("teacherPin");
const status = document.getElementById("sessionStatus");
const modeText = document.getElementById("modeText");
const sessionCodeDisplay = document.getElementById("sessionCodeDisplay");
const studentLink = document.getElementById("studentLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const participantStat = document.getElementById("participantStat");
const averageGradeStat = document.getElementById("averageGradeStat");
const averageAScoreStat = document.getElementById("averageAScoreStat");
const tableBody = document.querySelector("#resultsTable tbody");
const emptyResults = document.getElementById("emptyResults");
const qrCanvas = document.getElementById("qrCanvas");
const qrBox = document.getElementById("qrBox");

let activeCode = "";
let lastSummary = null;
let autoRefreshTimer = null;

modeText.textContent = isConfigured()
  ? "Connected to Supabase."
  : "Demo mode on this browser until Supabase keys are added.";

sessionCode.addEventListener("input", () => {
  sessionCode.value = normalizeCode(sessionCode.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Starting session...", "");
  form.querySelector("button").disabled = true;

  try {
    const session = await createSession({
      session_code: sessionCode.value,
      lecture_id: window.QUIZ_CONFIG?.lectureId,
      title: "Week 1 Lecture 1 Quiz",
      question_count: Number(questionCount.value),
      duration_minutes: Number(durationMinutes.value),
      teacher_pin: teacherPin.value
    });
    activeCode = session.session_code;
    sessionCode.value = activeCode;
    updateLink(activeCode);
    setStatus("Session ready.", "good");
    ensureAutoRefresh();
    await refreshSummary();
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    form.querySelector("button").disabled = false;
  }
});

refreshBtn.addEventListener("click", refreshSummary);
ensureAutoRefresh();

copyLinkBtn.addEventListener("click", async () => {
  if (!activeCode) return;
  try {
    await navigator.clipboard.writeText(studentLinkFor(activeCode));
    setStatus("Link copied.", "good");
  } catch (error) {
    setStatus("Copy failed.", "warn");
  }
});

exportBtn.addEventListener("click", () => {
  if (!lastSummary) return;
  const rows = [
    ["rank", "name", "student_identifier", "score", "total", "grade_percent", "a_score", "speed_bonus", "elapsed_seconds", "started_at", "submitted_at"],
    ...lastSummary.attempts.map((attempt) => [
      attempt.rank || "",
      attempt.student_name || "",
      attempt.student_identifier || "",
      attempt.score ?? "",
      attempt.total ?? "",
      attempt.grade_percent ?? "",
      attempt.a_score ?? "",
      attempt.speed_bonus ?? "",
      attempt.elapsed_seconds ?? "",
      attempt.started_at || "",
      attempt.submitted_at || ""
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activeCode || "quiz"}-results.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

async function refreshSummary() {
  activeCode = normalizeCode(sessionCode.value || activeCode);
  if (!activeCode) {
    setStatus("Start or enter a session code.", "warn");
    return;
  }

  try {
    const summary = await sessionSummary({
      session_code: activeCode,
      teacher_pin: teacherPin.value
    });
    lastSummary = normalizeSummary(summary);
    updateLink(activeCode);
    renderSummary(lastSummary);
    setStatus(`Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, "good");
  } catch (error) {
    setStatus(error.message, "danger");
  }
}

function updateLink(code) {
  const link = studentLinkFor(code);
  sessionCodeDisplay.textContent = code;
  studentLink.textContent = link;

  if (window.QRious) {
    new window.QRious({
      element: qrCanvas,
      value: link,
      size: 220,
      level: "M"
    });
  } else {
    qrBox.innerHTML = "";
    const image = document.createElement("img");
    image.alt = "Student QR code";
    image.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
    qrBox.appendChild(image);
  }
}

function renderSummary(summary) {
  const attempts = summary.attempts || [];
  const stats = summary.stats || {};

  participantStat.textContent = String(stats.started || attempts.length || 0);
  averageGradeStat.textContent = `${Math.round(Number(stats.average_grade_percent || 0))}%`;
  averageAScoreStat.textContent = formatNumber(stats.average_a_score || 0);

  tableBody.innerHTML = "";
  attempts.forEach((attempt) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    `;
    const cells = tr.querySelectorAll("td");
    cells[0].textContent = attempt.rank ? `#${attempt.rank}` : "-";
    cells[1].textContent = attempt.student_name || "";
    cells[2].textContent = attempt.student_identifier || "";
    cells[3].textContent = attempt.submitted_at
      ? `${attempt.score}/${attempt.total} (${Math.round(Number(attempt.grade_percent || 0))}%)`
      : "-";
    cells[4].textContent = attempt.submitted_at ? formatNumber(attempt.a_score) : "-";
    cells[5].textContent = attempt.submitted_at ? formatDuration(attempt.elapsed_seconds) : "-";
    cells[6].textContent = attempt.submitted_at ? "Submitted" : "In progress";
    tableBody.appendChild(tr);
  });
  emptyResults.classList.toggle("hidden", attempts.length > 0);
}

function normalizeSummary(summary) {
  const session = summary.session || {};
  const attempts = (summary.attempts || [])
    .map((attempt) => ({
      ...attemptMetrics(attempt, session),
      ...attempt
    }))
    .sort(compareAttempts)
    .map((attempt, index) => ({
      ...attempt,
      rank: attempt.submitted_at ? index + 1 : null
    }));
  const submitted = attempts.filter((attempt) => attempt.submitted_at);
  const averageGrade = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.grade_percent || 0), 0) / submitted.length
    : 0;
  const averageAScore = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.a_score || 0), 0) / submitted.length
    : 0;

  return {
    ...summary,
    attempts,
    stats: {
      ...(summary.stats || {}),
      started: attempts.length,
      submitted: submitted.length,
      average_grade_percent: round1(summary.stats?.average_grade_percent ?? averageGrade),
      average_a_score: round1(summary.stats?.average_a_score ?? averageAScore)
    }
  };
}

function ensureAutoRefresh() {
  if (autoRefreshTimer) return;
  autoRefreshTimer = window.setInterval(() => {
    if (!normalizeCode(sessionCode.value || activeCode)) return;
    if (isConfigured() && !teacherPin.value) return;
    refreshSummary();
  }, 10000);
}

function setStatus(message, tone) {
  status.textContent = message;
  if (tone) status.dataset.tone = tone;
  else status.removeAttribute("data-tone");
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function compareAttempts(a, b) {
  const aSubmitted = a.submitted_at ? 1 : 0;
  const bSubmitted = b.submitted_at ? 1 : 0;
  if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
  const aScore = Number(a.a_score ?? -1);
  const bScore = Number(b.a_score ?? -1);
  if (aScore !== bScore) return bScore - aScore;
  const aGrade = Number(a.grade_percent ?? -1);
  const bGrade = Number(b.grade_percent ?? -1);
  if (aGrade !== bGrade) return bGrade - aGrade;
  const aElapsed = Number(a.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  const bElapsed = Number(b.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  if (aElapsed !== bElapsed) return aElapsed - bElapsed;
  return String(a.started_at).localeCompare(String(b.started_at));
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
