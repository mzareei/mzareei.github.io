import { loadLearningInsights } from "./insights-api.js";
import { teacherContextFromUrl } from "./teacher-context.js";

const els = {
  refresh: document.getElementById("refreshInsightsBtn"),
  status: document.getElementById("insightStatus"),
  signalCount: document.getElementById("insightSignalCount"),
  recommendations: document.getElementById("recommendationRows"),
  sectionSummaryRows: document.getElementById("sectionSummaryRows"),
  topicSummaryRows: document.getElementById("topicSummaryRows"),
  activitySummaryRows: document.getElementById("activitySummaryRows"),
  studentSummaryRows: document.getElementById("studentSummaryRows"),
  exitTicketTrendRows: document.getElementById("exitTicketTrendRows")
};

const selectedTeacherContext = teacherContextFromUrl();

els.refresh.addEventListener("click", refresh);

refresh();

async function refresh() {
  await run("Loading learning insights...", async () => {
    const insights = await loadLearningInsights(initialContextFilters());
    renderInsights(insights);
    setStatus("Learning insights loaded.", "good");
  });
}

function initialContextFilters() {
  return {
    sectionId: selectedTeacherContext.sectionId
  };
}

function renderInsights(insights) {
  const recommendations = insights.recommendations || [];
  els.signalCount.textContent = String(recommendations.length);
  renderCards(els.recommendations, recommendations);
  renderSectionSummaries(insights.section_summaries || []);
  renderTopicSummaries(insights.topic_summaries || []);
  renderActivitySummaries(insights.activity_summaries || []);
  renderStudentSummaries(insights.student_summaries || []);
  renderExitTicketTrends(insights.exit_ticket_trends || []);
}

function renderCards(target, rows) {
  target.innerHTML = "";
  if (!rows.length) {
    target.append(card("No urgent signal", "Run a live activity or exit ticket to create fresh teaching data."));
    return;
  }
  rows.forEach((row) => target.append(card(row.title, row.body)));
}

function renderSectionSummaries(rows) {
  renderTable(els.sectionSummaryRows, rows, 4, (row) => [
    `${row.section_code}: ${row.section_name}`,
    row.score_count,
    percent(row.average_final),
    row.needs_review
  ]);
}

function renderTopicSummaries(rows) {
  renderTable(els.topicSummaryRows, rows, 2, (row) => [
    labelize(row.topic),
    row.missed_count
  ]);
}

function renderActivitySummaries(rows) {
  renderTable(els.activitySummaryRows, rows, 5, (row) => [
    row.title,
    row.category_name,
    row.score_count,
    percent(row.average_final),
    row.needs_review
  ]);
}

function renderStudentSummaries(rows) {
  renderTable(els.studentSummaryRows, rows.slice(0, 30), 5, (row) => [
    `${row.student_name || row.institutional_email}<br><small>${escapeHtml(row.student_identifier || row.institutional_email || "")}</small>`,
    row.section_code,
    row.score_count,
    percent(row.average_final),
    row.needs_review
  ], true);
}

function renderExitTicketTrends(rows) {
  renderTable(els.exitTicketTrendRows, rows, 5, (row) => [
    row.lecture_title,
    row.ticket_count,
    `${row.average_confidence} / 5`,
    row.low_confidence,
    row.latest_muddy_point || ""
  ]);
}

function renderTable(target, rows, colSpan, formatter, allowHtml = false) {
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
      if (allowHtml) cell.innerHTML = String(value || "");
      else cell.textContent = String(value ?? "");
      row.append(cell);
    });
    target.append(row);
  });
}

function card(title, body) {
  const item = document.createElement("article");
  item.className = "progress-card";
  item.innerHTML = `<strong></strong><span></span>`;
  item.querySelector("strong").textContent = title || "Signal";
  item.querySelector("span").textContent = body || "";
  return item;
}

async function run(message, action) {
  els.refresh.disabled = true;
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to load insights.", "danger");
  } finally {
    els.refresh.disabled = false;
  }
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function percent(value) {
  return `${Number(value || 0).toLocaleString()}%`;
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
