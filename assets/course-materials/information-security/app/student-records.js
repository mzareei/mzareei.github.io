import { loadStudentList, loadStudentRecord } from "./student-records-api.js";

const els = {
  refresh: document.getElementById("refreshStudentRecordsBtn"),
  select: document.getElementById("studentSelect"),
  status: document.getElementById("studentRecordStatus"),
  title: document.getElementById("studentRecordTitle"),
  average: document.getElementById("studentRecordAverage"),
  summary: document.getElementById("studentRecordSummary"),
  scores: document.getElementById("studentScoreRows"),
  attempts: document.getElementById("studentAttemptRows"),
  exitTickets: document.getElementById("studentExitTicketRows"),
  portfolio: document.getElementById("studentPortfolioRows")
};

let students = [];

els.refresh.addEventListener("click", refresh);
els.select.addEventListener("change", loadSelectedRecord);

refresh();

async function refresh() {
  await run("Loading student list...", async () => {
    const result = await loadStudentList();
    students = result.students || [];
    renderStudentSelect();
    await loadSelectedRecord();
  });
}

async function loadSelectedRecord() {
  const profileId = els.select.value;
  if (!profileId) {
    renderEmptyRecord();
    setStatus("Select a student to load a record.", "warn");
    return;
  }

  await run("Loading student record...", async () => {
    const record = await loadStudentRecord(profileId);
    renderRecord(record);
    setStatus("Student record loaded.", "good");
  });
}

function renderStudentSelect() {
  const selected = els.select.value;
  els.select.innerHTML = "";
  if (!students.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No students found";
    els.select.append(option);
    return;
  }
  students.forEach((student) => {
    const option = document.createElement("option");
    option.value = student.profile_id;
    option.textContent = `${student.full_name} · ${student.student_identifier || student.institutional_email} · ${(student.section_codes || []).join(", ")}`;
    option.selected = student.profile_id === selected;
    els.select.append(option);
  });
}

function renderRecord(record) {
  const profile = record.profile || {};
  const summary = record.summary || {};
  els.title.textContent = `${profile.full_name || "Student"} · ${profile.student_identifier || profile.institutional_email || ""}`;
  els.average.textContent = `${Number(summary.average_final || 0)}%`;
  renderSummary(summary);
  renderScores(record.scores || []);
  renderAttempts(record.attempts || []);
  renderExitTickets(record.exit_tickets || []);
  renderPortfolio(record.portfolio_entries || []);
}

function renderSummary(summary) {
  els.summary.innerHTML = "";
  [
    ["Average final", `${Number(summary.average_final || 0)}%`],
    ["Official scores", summary.score_count || 0],
    ["Submitted attempts", summary.submitted_attempts || 0],
    ["Exit tickets", summary.exit_ticket_count || 0],
    ["Portfolio entries", summary.portfolio_entry_count || 0]
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    els.summary.append(card);
  });
}

function renderScores(rows) {
  renderTable(els.scores, rows, 7, (score) => [
    score.item_title,
    score.category_name,
    formatNumber(score.score_raw),
    formatPercent(score.score_percent),
    formatPercent(score.score_final),
    labelize(score.status),
    formatDate(score.updated_at)
  ]);
}

function renderAttempts(rows) {
  renderTable(els.attempts, rows, 5, (attempt) => [
    attempt.activity_title,
    attempt.attempt_number,
    labelize(attempt.status),
    formatPercent(attempt.score_final),
    formatDate(attempt.submitted_at)
  ]);
}

function renderExitTickets(rows) {
  renderTable(els.exitTickets, rows, 5, (ticket) => [
    ticket.confidence ? `${ticket.confidence} / 5` : "",
    ticket.one_thing || "",
    ticket.muddy_point || "",
    ticket.next_action || "",
    formatDate(ticket.created_at)
  ]);
}

function renderPortfolio(rows) {
  renderTable(els.portfolio, rows, 4, (entry) => [
    labelize(entry.entry_type),
    labelize(entry.visibility),
    summarizeEntry(entry.entry_json),
    formatDate(entry.updated_at || entry.created_at)
  ]);
}

function renderTable(target, rows, colSpan, formatter) {
  target.innerHTML = "";
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colSpan;
    cell.textContent = "No records yet.";
    row.append(cell);
    target.append(row);
    return;
  }
  rows.forEach((source) => {
    const row = document.createElement("tr");
    formatter(source).forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "");
      row.append(cell);
    });
    target.append(row);
  });
}

function renderEmptyRecord() {
  els.title.textContent = "No student selected";
  els.average.textContent = "--";
  els.summary.innerHTML = "";
  [els.scores, els.attempts, els.exitTickets, els.portfolio].forEach((target) => {
    target.innerHTML = "";
  });
}

async function run(message, action) {
  els.refresh.disabled = true;
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to load student records.", "danger");
  } finally {
    els.refresh.disabled = false;
  }
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function summarizeEntry(value) {
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .slice(0, 3)
    .map(([key, entryValue]) => `${labelize(key)}: ${String(entryValue).slice(0, 80)}`)
    .join(" · ");
}

function formatNumber(value) {
  return value === null || value === undefined ? "" : Number(value).toLocaleString();
}

function formatPercent(value) {
  return value === null || value === undefined ? "" : `${Number(value).toLocaleString()}%`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function labelize(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
