import { loadContentAccess } from "./content-api.js";

const els = {
  title: document.getElementById("contentTitle"),
  summary: document.getElementById("contentSummary"),
  state: document.getElementById("contentState"),
  status: document.getElementById("contentStatus"),
  launch: document.getElementById("contentLaunch")
};

const params = new URLSearchParams(window.location.search);
const releaseId = params.get("release") || params.get("release_id");

init();

async function init() {
  if (!releaseId) {
    renderDenied("Access denied: missing release id.");
    return;
  }

  try {
    setStatus("Checking access...", "");
    const result = await loadContentAccess(releaseId);
    renderContent(result);
  } catch (error) {
    renderDenied(error.message || "Access denied.");
  }
}

function renderContent(result) {
  const content = result.content || {};
  const release = result.release || {};
  els.title.textContent = content.title || "Released Content";
  els.summary.textContent = content.summary || "This material is released for your course section.";
  els.state.textContent = labelize(release.state || "released");
  els.launch.href = safeLaunchUrl(content.source_ref || "./");
  els.launch.hidden = false;
  setStatus("Access granted. You can open this released material.", "good");
}

function renderDenied(message) {
  els.title.textContent = "Access Denied";
  els.summary.textContent = "This material is not currently released for your signed-in course section.";
  els.state.textContent = "Denied";
  els.launch.hidden = true;
  setStatus(message, "danger");
}

function safeLaunchUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "./";
  return text;
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
