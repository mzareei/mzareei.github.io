import { loadStudentProgress } from "./progress-api.js";

const els = {
  refresh: document.getElementById("refreshProgressBtn"),
  status: document.getElementById("progressStatus"),
  average: document.getElementById("progressAverage"),
  progressStats: document.getElementById("progressStats"),
  scoreRows: document.getElementById("scoreRows"),
  recommendationRows: document.getElementById("recommendationRows"),
  releasedPracticeRows: document.getElementById("releasedPracticeRows")
};

els.refresh.addEventListener("click", refresh);

refresh();

async function refresh() {
  await run("Loading your progress...", async () => {
    const progress = await loadStudentProgress();
    renderProgress(progress);
    setStatus("Progress loaded.", "good");
  });
}

function renderProgress(progress) {
  const summary = progress.summary || {};
  const weighted_summary = progress.weighted_summary || {};
  const review_coach = progress.review_coach || {};
  els.average.textContent = `${Number(weighted_summary.weighted_course_percent || summary.average_final || 0)}%`;
  renderStats(summary, review_coach, weighted_summary);
  renderScores(progress.scores || []);
  renderRecommendations(review_coach.recommendations || progress.recommendations || []);
  renderReleasedPractice(progress.released_practice || []);
}

function renderStats(summary, review_coach, weighted_summary) {
  els.progressStats.innerHTML = "";
  [
    ["Weighted course", `${Number(weighted_summary.weighted_course_percent || 0).toLocaleString()}%`],
    ["Configured weight", `${Number(weighted_summary.configured_weight_percent || 0).toLocaleString()}%`],
    ["Weighted categories", (weighted_summary.category_summaries || []).length],
    ["Official scores", summary.score_count || 0],
    ["Submitted attempts", summary.submitted_attempts || 0],
    ["Attempt records", summary.attempt_count || 0],
    ["Portfolio entries", summary.portfolio_entries || 0],
    ["Weak topics", (review_coach.weak_topics || []).length]
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    els.progressStats.append(card);
  });
  (weighted_summary.category_summaries || []).slice(0, 6).forEach((category) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `
      <span>${escapeHtml(category.category_name || "Category")}</span>
      <strong>${escapeHtml(formatPercent(category.category_average_percent))}</strong>
      <small>${escapeHtml(formatPercent(category.category_weight_percent))} weight · ${escapeHtml(category.kept_score_count || 0)} kept</small>
    `;
    els.progressStats.append(card);
  });
}

function renderScores(scores) {
  els.scoreRows.innerHTML = "";
  if (!scores.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No official score records yet.";
    row.append(cell);
    els.scoreRows.append(row);
    return;
  }
  scores.forEach((score) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(score.item_title)}</td>
      <td>${escapeHtml(score.category_name)}</td>
      <td>${escapeHtml(formatNumber(score.score_raw))}</td>
      <td>${escapeHtml(formatPercent(score.score_percent))}</td>
      <td><strong>${escapeHtml(formatPercent(score.score_final))}</strong></td>
      <td>${escapeHtml(labelize(score.status))}</td>
      <td>${escapeHtml(formatDate(score.updated_at))}</td>
    `;
    els.scoreRows.append(row);
  });
}

function renderRecommendations(recommendations) {
  els.recommendationRows.innerHTML = "";
  if (!recommendations.length) {
    els.recommendationRows.append(cardItem({
      title: "No weak-topic signals yet",
      body: "Submit an activity and this review coach will use your missed topics to suggest practice.",
      href: "../review-coach/"
    }));
    return;
  }
  recommendations.forEach((recommendation) => {
    els.recommendationRows.append(cardItem({
      title: recommendation.title,
      body: `${recommendation.body} ${recommendation.practice_title ? `Practice: ${recommendation.practice_title}.` : ""}`,
      href: recommendation.href || "../review-coach/"
    }));
  });
}

function renderReleasedPractice(items) {
  els.releasedPracticeRows.innerHTML = "";
  if (!items.length) {
    els.releasedPracticeRows.append(cardItem({
      title: "No released practice yet",
      body: "Released activities for your section will appear here.",
      href: "./"
    }));
    return;
  }
  items.slice(0, 8).forEach((item) => {
    els.releasedPracticeRows.append(cardItem({
      title: item.title,
      body: `${labelize(item.content_type)} · ${labelize(item.state)}`,
      href: item.source_ref || "./"
    }));
  });
}

function cardItem({ title, body, href }) {
  const item = document.createElement("a");
  item.className = "progress-card";
  item.href = href;
  item.innerHTML = `<strong></strong><span></span>`;
  item.querySelector("strong").textContent = title || "Practice";
  item.querySelector("span").textContent = body || "";
  return item;
}

async function run(message, action) {
  els.refresh.disabled = true;
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to load progress.", "danger");
  } finally {
    els.refresh.disabled = false;
  }
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
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
