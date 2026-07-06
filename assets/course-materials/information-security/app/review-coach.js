import { loadStudentProgress } from "./progress-api.js";

const els = {
  refresh: document.getElementById("refreshCoachBtn"),
  status: document.getElementById("coachStatus"),
  focusCount: document.getElementById("coachFocusCount"),
  coachSummary: document.getElementById("coachSummary"),
  weakTopicRows: document.getElementById("weakTopicRows"),
  coachRecommendationRows: document.getElementById("coachRecommendationRows"),
  coachPracticeRows: document.getElementById("coachPracticeRows")
};

els.refresh.addEventListener("click", refresh);

refresh();

async function refresh() {
  await run("Loading Review Coach...", async () => {
    const progress = await loadStudentProgress();
    renderCoach(progress);
    setStatus("Review Coach loaded from your signed-in course record.", "good");
  });
}

function renderCoach(progress) {
  const review_coach = progress.review_coach || {};
  const weak_topics = review_coach.weak_topics || [];
  const recommendations = review_coach.recommendations || progress.recommendations || [];
  const released_practice = progress.released_practice || [];
  const summary = progress.summary || {};
  const weighted = progress.weighted_summary || {};

  els.focusCount.textContent = weak_topics.length;
  renderSummary(summary, weighted, weak_topics, recommendations, released_practice);
  renderWeakTopics(weak_topics);
  renderRecommendations(recommendations);
  renderPractice(released_practice);
}

function renderSummary(summary, weighted, weak_topics, recommendations, released_practice) {
  els.coachSummary.innerHTML = "";
  [
    ["Weighted course", formatPercent(weighted.weighted_course_percent)],
    ["Submitted attempts", summary.submitted_attempts || 0],
    ["Official scores", summary.score_count || 0],
    ["Focus topics", weak_topics.length],
    ["Recommendations", recommendations.length],
    ["Released practice", released_practice.length]
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    els.coachSummary.append(card);
  });
}

function renderWeakTopics(weak_topics) {
  els.weakTopicRows.innerHTML = "";
  if (!weak_topics.length) {
    els.weakTopicRows.append(cardItem({
      title: "No weak-topic signals yet",
      body: "Complete a released activity so the coach can use your missed topics to guide review.",
      href: "activity.html"
    }));
    return;
  }

  weak_topics.forEach((topic) => {
    els.weakTopicRows.append(cardItem({
      title: labelize(topic.topic),
      body: `${topic.missed_count || 0} missed response${Number(topic.missed_count || 0) === 1 ? "" : "s"} connected to this topic.`,
      href: "progress.html"
    }));
  });
}

function renderRecommendations(recommendations) {
  els.coachRecommendationRows.innerHTML = "";
  if (!recommendations.length) {
    els.coachRecommendationRows.append(cardItem({
      title: "Start with released practice",
      body: "Your section's released activities will become coaching steps after you submit work.",
      href: "activity.html"
    }));
    return;
  }

  recommendations.forEach((recommendation) => {
    els.coachRecommendationRows.append(cardItem({
      title: recommendation.title || "Review next",
      body: [recommendation.body, recommendation.practice_title ? `Practice: ${recommendation.practice_title}.` : ""].filter(Boolean).join(" "),
      href: safePracticeHref(recommendation)
    }));
  });
}

function renderPractice(released_practice) {
  els.coachPracticeRows.innerHTML = "";
  if (!released_practice.length) {
    els.coachPracticeRows.append(cardItem({
      title: "No released practice yet",
      body: "When your teacher releases activities for your section, they will appear here.",
      href: "./"
    }));
    return;
  }

  released_practice.slice(0, 8).forEach((item) => {
    els.coachPracticeRows.append(cardItem({
      title: item.title || "Released practice",
      body: `${labelize(item.content_type)} · ${labelize(item.state || item.release_state)}`,
      href: safePracticeHref(item)
    }));
  });
}

function cardItem({ title, body, href }) {
  const item = document.createElement("a");
  item.className = "progress-card";
  item.href = href || "progress.html";
  item.innerHTML = `<strong></strong><span></span>`;
  item.querySelector("strong").textContent = title || "Review";
  item.querySelector("span").textContent = body || "";
  return item;
}

function safePracticeHref(item) {
  if (item.release_id) return `content.html?release=${encodeURIComponent(item.release_id)}`;
  return item.href || item.source_ref || "progress.html";
}

async function run(message, action) {
  els.refresh.disabled = true;
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to load Review Coach.", "danger");
  } finally {
    els.refresh.disabled = false;
  }
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function formatPercent(value) {
  return value === null || value === undefined ? "0%" : `${Number(value).toLocaleString()}%`;
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
