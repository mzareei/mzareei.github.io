import { loadReleases, updateReleaseState } from "./release-api.js";
import { contextFilters, contextLabel, matchesTeacherContext, teacherContextFromUrl } from "./teacher-context.js";

const els = {
  refresh: document.getElementById("refreshReleasesBtn"),
  update: document.getElementById("updateReleaseBtn"),
  rows: document.getElementById("releaseRows"),
  state: document.getElementById("releaseStateSelect"),
  reason: document.getElementById("releaseReasonInput"),
  selected: document.getElementById("selectedRelease"),
  status: document.getElementById("releaseStatus")
};

let selectedReleaseId = "";
let allowedTransitions = {};
let releaseRows = [];
let canUpdateReleases = false;
const selectedTeacherContext = teacherContextFromUrl();

els.refresh.addEventListener("click", refresh);
els.update.addEventListener("click", updateSelectedRelease);

refresh();

async function refresh() {
  await run("Loading releases...", async () => {
    const result = await loadReleases(contextFilters(selectedTeacherContext));
    releaseRows = result.releases || [];
    allowedTransitions = result.allowedTransitions || {};
    canUpdateReleases = Array.isArray(result.actions) && result.actions.includes("update_state");
    renderReleases();
    const note = canUpdateReleases ? "" : " Update controls are available only to instructors.";
    setStatus(`Loaded ${filteredReleaseRows().length} release${filteredReleaseRows().length === 1 ? "" : "s"}. ${contextLabel(selectedTeacherContext)}${note}`, "good");
  });
}

async function updateSelectedRelease() {
  if (!canUpdateReleases) {
    setStatus("Update controls are available only to instructors.", "warn");
    return;
  }
  if (!selectedReleaseId) {
    setStatus("Select a release first.", "warn");
    return;
  }
  const nextState = els.state.value;
  if (!nextState) {
    setStatus("Choose the next state.", "warn");
    return;
  }
  await run("Updating release...", async () => {
    await updateReleaseState({
      releaseId: selectedReleaseId,
      nextState,
      reason: els.reason.value
    });
    els.reason.value = "";
    await refresh();
    setStatus("Release updated.", "good");
  });
}

function renderReleases() {
  els.rows.innerHTML = "";
  const visibleRows = filteredReleaseRows();
  if (!visibleRows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No releases found.";
    row.append(cell);
    els.rows.append(row);
    selectRelease("");
    return;
  }

  visibleRows.forEach((release) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.releaseId = release.release_id;
    row.innerHTML = `
      <td>${escapeHtml(release.title)}</td>
      <td>${escapeHtml(labelize(release.content_type))}</td>
      <td>${escapeHtml(release.section_code || "All sections")}</td>
      <td>${escapeHtml(release.class_session_title || "No session")}</td>
      <td><strong>${escapeHtml(labelize(release.state))}</strong></td>
      <td>${escapeHtml(formatDate(release.opens_at))}</td>
      <td>${escapeHtml(formatDate(release.closes_at))}</td>
    `;
    row.addEventListener("click", () => selectRelease(release.release_id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectRelease(release.release_id);
    });
    els.rows.append(row);
  });

  const sessionRelease = selectedTeacherContext.sessionId
    ? visibleRows.find((release) => release.class_session_id === selectedTeacherContext.sessionId)
    : null;
  if (sessionRelease) {
    selectRelease(sessionRelease.release_id);
  } else if (!visibleRows.some((release) => release.release_id === selectedReleaseId)) {
    selectRelease(visibleRows[0].release_id);
  } else {
    selectRelease(selectedReleaseId);
  }
}

function filteredReleaseRows() {
  return releaseRows.filter((release) => matchesTeacherContext(release, selectedTeacherContext));
}

function selectRelease(releaseId) {
  selectedReleaseId = releaseId;
  const release = releaseRows.find((row) => row.release_id === releaseId);
  els.selected.textContent = release ? `${release.title} (${labelize(release.state)})` : "No release selected";
  Array.from(els.rows.querySelectorAll("tr")).forEach((row) => {
    row.classList.toggle("selected", row.dataset.releaseId === releaseId);
  });
  renderStateOptions(release);
}

function renderStateOptions(release) {
  els.state.innerHTML = "";
  const options = canUpdateReleases && release ? allowedTransitions[release.state] || [] : [];
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = canUpdateReleases
    ? options.length ? "Choose next state" : "No transition available"
    : "Update controls are available only to instructors";
  els.state.append(empty);
  options.forEach((state) => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = labelize(state);
    els.state.append(option);
  });
  els.state.disabled = !canUpdateReleases || !options.length;
  els.reason.disabled = !canUpdateReleases;
  els.update.disabled = !canUpdateReleases || !options.length;
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to update releases.", "danger");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.state.disabled = isBusy || !canUpdateReleases;
  els.reason.disabled = isBusy || !canUpdateReleases;
  els.update.disabled = isBusy || !canUpdateReleases || !els.state.value;
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

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
