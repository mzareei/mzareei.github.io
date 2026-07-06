import { continueSession, extendActivityWindow, loadSessions, updateActivityState, updateSessionState } from "./session-api.js";
import { contextFilters, contextLabel, matchesTeacherContext, teacherContextFromUrl } from "./teacher-context.js";

const els = {
  refresh: document.getElementById("refreshSessionsBtn"),
  update: document.getElementById("updateSessionBtn"),
  continue: document.getElementById("continueSessionBtn"),
  rows: document.getElementById("sessionRows"),
  state: document.getElementById("sessionStateSelect"),
  reason: document.getElementById("sessionReasonInput"),
  selected: document.getElementById("selectedSession"),
  status: document.getElementById("sessionStatus"),
  title: document.getElementById("continuationTitleInput"),
  date: document.getElementById("continuationDateInput"),
  notes: document.getElementById("continuationNotesInput"),
  releaseCarryList: document.getElementById("releaseCarryList"),
  liveActivitySelect: document.getElementById("liveActivitySelect"),
  activityStateSelect: document.getElementById("activityStateSelect"),
  updateActivityState: document.getElementById("updateActivityStateBtn"),
  extendActivityMinutes: document.getElementById("extendActivityMinutesInput"),
  extendActivityWindow: document.getElementById("extendActivityWindowBtn"),
  selectedActivityInstance: document.getElementById("selectedActivityInstance"),
  activityQrCanvas: document.getElementById("activityQrCanvas"),
  activityJoinLink: document.getElementById("activityJoinLink"),
  copyActivityLink: document.getElementById("copyActivityLinkBtn")
};

let selectedSessionId = "";
let allowedTransitions = {};
let allowedActivityTransitions = {};
let sessionRows = [];
const selectedTeacherContext = teacherContextFromUrl();

els.refresh.addEventListener("click", refresh);
els.update.addEventListener("click", updateSelectedSession);
els.continue.addEventListener("click", continueSelectedSession);
els.liveActivitySelect.addEventListener("change", () => {
  updateActivityQr();
  renderActivityControls(selectedSession());
});
els.updateActivityState.addEventListener("click", updateSelectedActivityState);
els.extendActivityWindow.addEventListener("click", extendSelectedActivityWindow);
els.copyActivityLink.addEventListener("click", copyActivityLink);

refresh();

async function refresh() {
  await run("Loading class sessions...", async () => {
    const result = await loadSessions(contextFilters(selectedTeacherContext));
    sessionRows = result.sessions || [];
    allowedTransitions = result.allowedSessionTransitions || {};
    allowedActivityTransitions = result.allowedActivityTransitions || {};
    renderSessions();
    setStatus(`Loaded ${filteredSessionRows().length} session${filteredSessionRows().length === 1 ? "" : "s"}. ${contextLabel(selectedTeacherContext)}`, "good");
  });
}

async function updateSelectedSession() {
  if (!selectedSessionId) {
    setStatus("Select a class session first.", "warn");
    return;
  }
  const nextState = els.state.value;
  if (!nextState) {
    setStatus("Choose the next session state.", "warn");
    return;
  }
  await run("Updating class session...", async () => {
    await updateSessionState({
      sessionId: selectedSessionId,
      nextState,
      reason: els.reason.value
    });
    els.reason.value = "";
    await refresh();
    setStatus("Class session updated.", "good");
  });
}

async function continueSelectedSession() {
  const session = selectedSession();
  if (!session) {
    setStatus("Select a paused or closed session first.", "warn");
    return;
  }
  if (!["paused", "closed"].includes(session.state)) {
    setStatus("Only paused or closed sessions can be continued.", "warn");
    return;
  }
  const movedReleaseIds = Array.from(els.releaseCarryList.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value);

  await run("Creating continuation session...", async () => {
    const result = await continueSession({
      sourceSessionId: selectedSessionId,
      plannedDate: els.date.value,
      title: els.title.value,
      teacherNotes: els.notes.value,
      movedReleaseIds
    });
    els.title.value = "";
    els.date.value = "";
    els.notes.value = "";
    selectedSessionId = result.session?.id || "";
    await refresh();
    setStatus(`Continuation created. Moved ${result.moved_release_ids?.length || 0} release${result.moved_release_ids?.length === 1 ? "" : "s"}.`, "good");
  });
}

async function updateSelectedActivityState() {
  const activity = selectedActivityRelease();
  if (!activity?.activity_instance_id) {
    setStatus("Choose an activity first.", "warn");
    return;
  }
  const nextState = els.activityStateSelect.value;
  if (!nextState) {
    setStatus("Choose the next activity state.", "warn");
    return;
  }
  await run("Updating activity state...", async () => {
    await updateActivityState({
      activityInstanceId: activity.activity_instance_id,
      nextState
    });
    await refresh();
    setStatus("Activity state updated.", "good");
  });
}

async function extendSelectedActivityWindow() {
  const activity = selectedActivityRelease();
  if (!activity?.activity_instance_id) {
    setStatus("Choose an activity first.", "warn");
    return;
  }
  await run("Extending activity window...", async () => {
    await extendActivityWindow({
      activityInstanceId: activity.activity_instance_id,
      minutes: els.extendActivityMinutes.value
    });
    await refresh();
    setStatus("Activity window extended.", "good");
  });
}

function renderSessions() {
  els.rows.innerHTML = "";
  const visibleRows = filteredSessionRows();
  if (!visibleRows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No class sessions found.";
    row.append(cell);
    els.rows.append(row);
    selectSession("");
    return;
  }

  visibleRows.forEach((session) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.sessionId = session.session_id;
    row.innerHTML = `
      <td>${escapeHtml(session.section_code || "Section")}</td>
      <td>${escapeHtml(session.title)}<br><small>#${escapeHtml(session.sequence_number)}</small></td>
      <td>${escapeHtml(session.planned_date || "")}</td>
      <td><strong>${escapeHtml(labelize(session.state))}</strong></td>
      <td>${escapeHtml(session.continued_from_session_title || (session.continuation_count ? `${session.continuation_count} continuation(s)` : ""))}</td>
      <td>${escapeHtml(String((session.releases || []).length))}</td>
    `;
    row.addEventListener("click", () => selectSession(session.session_id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectSession(session.session_id);
    });
    els.rows.append(row);
  });

  if (selectedTeacherContext.sessionId && visibleRows.some((session) => session.session_id === selectedTeacherContext.sessionId)) {
    selectSession(selectedTeacherContext.sessionId);
  } else if (!visibleRows.some((session) => session.session_id === selectedSessionId)) {
    selectSession(visibleRows[0].session_id);
  } else {
    selectSession(selectedSessionId);
  }
}

function filteredSessionRows() {
  return sessionRows.filter((session) => matchesTeacherContext(session, selectedTeacherContext));
}

function selectSession(sessionId) {
  selectedSessionId = sessionId;
  const session = selectedSession();
  const continued = session?.continued_from_session_id ? ` · Continues ${session.continued_from_session_title || "earlier session"}` : "";
  els.selected.textContent = session ? `${session.section_code} · ${session.title} (${labelize(session.state)})${continued}` : "No session selected";
  Array.from(els.rows.querySelectorAll("tr")).forEach((row) => {
    row.classList.toggle("selected", row.dataset.sessionId === sessionId);
  });
  renderStateOptions(session);
  renderCarryReleases(session);
  renderActivityLauncher(session);
}

function renderStateOptions(session) {
  els.state.innerHTML = "";
  const options = session ? allowedTransitions[session.state] || [] : [];
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = options.length ? "Choose next state" : "No transition available";
  els.state.append(empty);
  options.forEach((state) => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = labelize(state);
    els.state.append(option);
  });
  els.update.disabled = !options.length;
}

function renderCarryReleases(session) {
  els.releaseCarryList.innerHTML = "";
  const releases = (session?.releases || []).filter((release) => release.carryable);
  if (!releases.length) {
    const empty = document.createElement("p");
    empty.className = "status-line";
    empty.textContent = "No carry-forward releases for this session.";
    els.releaseCarryList.append(empty);
    return;
  }
  releases.forEach((release) => {
    const label = document.createElement("label");
    label.className = "session-release-option";
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(release.release_id)}" checked>
      <span><strong>${escapeHtml(release.title)}</strong> ${escapeHtml(labelize(release.state))}</span>
    `;
    els.releaseCarryList.append(label);
  });
}

function renderActivityLauncher(session) {
  els.liveActivitySelect.innerHTML = "";
  const releases = (session?.releases || []).filter((release) => release.activity_instance_id);
  if (!releases.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No activity instance for this session";
    els.liveActivitySelect.append(option);
    els.copyActivityLink.disabled = true;
    renderActivityControls(session);
    els.activityJoinLink.textContent = "";
    clearQr();
    return;
  }

  releases.forEach((release) => {
    const option = document.createElement("option");
    option.value = release.activity_instance_id;
    option.textContent = `${release.title} · ${labelize(release.activity_state || "activity")}`;
    els.liveActivitySelect.append(option);
  });
  els.copyActivityLink.disabled = false;
  updateActivityQr();
  renderActivityControls(session);
}

function renderActivityControls(session) {
  const activity = selectedActivityRelease(session);
  els.activityStateSelect.innerHTML = "";
  if (!activity?.activity_instance_id) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No activity selected";
    els.activityStateSelect.append(option);
    els.selectedActivityInstance.textContent = "No activity selected";
    els.updateActivityState.disabled = true;
    els.extendActivityWindow.disabled = true;
    return;
  }

  const state = activity.activity_state || "planned";
  const options = allowedActivityTransitions[state] || [];
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = options.length ? "Choose next activity state" : "No activity transition available";
  els.activityStateSelect.append(empty);
  options.forEach((nextState) => {
    const option = document.createElement("option");
    option.value = nextState;
    option.textContent = labelize(nextState);
    els.activityStateSelect.append(option);
  });

  const endsAt = activity.activity_ends_at ? ` · closes ${formatDate(activity.activity_ends_at)}` : "";
  const limit = activity.time_limit_seconds ? ` · ${Math.round(Number(activity.time_limit_seconds) / 60)} min limit` : "";
  els.selectedActivityInstance.textContent = `${activity.title} · ${labelize(state)}${endsAt}${limit}`;
  els.updateActivityState.disabled = !options.length;
  els.extendActivityWindow.disabled = ["closed", "archived"].includes(state);
}

function updateActivityQr() {
  const activityInstanceId = els.liveActivitySelect.value;
  if (!activityInstanceId) {
    els.activityJoinLink.textContent = "";
    clearQr();
    return;
  }
  const relativeLink = `activity.html?activity=${encodeURIComponent(activityInstanceId)}`;
  const link = new URL(relativeLink, window.location.href).href;
  els.activityJoinLink.textContent = link;
  if (window.QRious) {
    new window.QRious({
      element: els.activityQrCanvas,
      value: link,
      size: 220,
      level: "M"
    });
  } else {
    clearQr();
  }
}

async function copyActivityLink() {
  const link = els.activityJoinLink.textContent;
  if (!link) {
    setStatus("Choose an activity first.", "warn");
    return;
  }
  await navigator.clipboard.writeText(link);
  setStatus("Student activity link copied.", "good");
}

function clearQr() {
  const context = els.activityQrCanvas.getContext("2d");
  context.clearRect(0, 0, els.activityQrCanvas.width, els.activityQrCanvas.height);
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to manage class sessions.", "danger");
  } finally {
    setBusy(false);
  }
}

function selectedSession() {
  return sessionRows.find((session) => session.session_id === selectedSessionId);
}

function selectedActivityRelease(session = selectedSession()) {
  const activityInstanceId = els.liveActivitySelect.value;
  return (session?.releases || []).find((release) => release.activity_instance_id === activityInstanceId) || null;
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.update.disabled = isBusy || !els.state.value;
  els.continue.disabled = isBusy;
  els.updateActivityState.disabled = isBusy || !els.activityStateSelect.value;
  els.extendActivityWindow.disabled = isBusy || !els.liveActivitySelect.value;
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
