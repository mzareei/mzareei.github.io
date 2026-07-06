import { loadParticipationContext, recordParticipationEvent } from "./participation-api.js";

const els = {
  refresh: document.getElementById("refreshParticipationBtn"),
  record: document.getElementById("recordParticipationBtn"),
  status: document.getElementById("participationStatus"),
  count: document.getElementById("participationCount"),
  section: document.getElementById("participationSectionInput"),
  session: document.getElementById("participationSessionInput"),
  student: document.getElementById("participationStudentInput"),
  type: document.getElementById("participationTypeSelect"),
  points: document.getElementById("participationPointsInput"),
  note: document.getElementById("participationNoteInput"),
  rows: document.getElementById("participationEventRows")
};

let sections = [];
let sessions = [];
let students = [];
let participationEvents = [];

els.refresh.addEventListener("click", refresh);
els.record.addEventListener("click", recordEvent);
els.section.addEventListener("change", () => {
  renderSessionOptions();
  renderStudentOptions();
  renderEvents();
});

refresh();

async function refresh() {
  await run("Loading participation context...", async () => {
    const result = await loadParticipationContext({ sectionId: els.section.value });
    sections = result.sections || [];
    sessions = result.sessions || [];
    students = result.students || [];
    participationEvents = result.participation_events || [];
    renderContext();
    setStatus("Participation context loaded.", "good");
  });
}

async function recordEvent() {
  if (!els.section.value || !els.student.value) {
    setStatus("Choose a section and student first.", "warn");
    return;
  }
  const points = Number(els.points.value || 0);
  if (!Number.isFinite(points) || points < 0) {
    setStatus("Points must be zero or greater.", "warn");
    return;
  }

  await run("Recording participation...", async () => {
    const result = await recordParticipationEvent({
      sectionId: els.section.value,
      classSessionId: els.session.value,
      profileId: els.student.value,
      event_type: els.type.value,
      points,
      note: els.note.value.trim()
    });
    sessions = result.sessions || sessions;
    students = result.students || students;
    participationEvents = result.participation_events || [];
    els.note.value = "";
    renderContext();
    setStatus("Participation event recorded.", "good");
  });
}

function renderContext() {
  renderSectionOptions();
  renderSessionOptions();
  renderStudentOptions();
  renderEvents();
}

function renderSectionOptions() {
  const previous = els.section.value;
  els.section.innerHTML = "";
  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id || "";
    option.textContent = `${section.section_code || "Section"}${section.section_name ? ` · ${section.section_name}` : ""}`;
    els.section.append(option);
  });
  if (Array.from(els.section.options).some((option) => option.value === previous)) {
    els.section.value = previous;
  }
}

function renderSessionOptions() {
  const previous = els.session.value;
  els.session.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "No session";
  els.session.append(empty);
  sessions
    .filter((session) => !els.section.value || session.section_id === els.section.value)
    .forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id || "";
      option.textContent = `${session.planned_date || "No date"} · ${session.title || "Class session"} · ${labelize(session.state)}`;
      els.session.append(option);
    });
  if (Array.from(els.session.options).some((option) => option.value === previous)) {
    els.session.value = previous;
  }
}

function renderStudentOptions() {
  const previous = els.student.value;
  els.student.innerHTML = "";
  const visibleStudents = students.filter((student) => !els.section.value || student.section_id === els.section.value);
  if (!visibleStudents.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No active students";
    els.student.append(option);
    return;
  }
  visibleStudents.forEach((student) => {
    const option = document.createElement("option");
    option.value = student.profile_id || "";
    option.textContent = `${student.full_name || "Student"} · ${student.student_identifier || student.institutional_email || ""}`;
    els.student.append(option);
  });
  if (Array.from(els.student.options).some((option) => option.value === previous)) {
    els.student.value = previous;
  }
}

function renderEvents() {
  const visibleEvents = participationEvents.filter((event) => !els.section.value || event.section_id === els.section.value);
  els.count.textContent = String(visibleEvents.length);
  els.rows.innerHTML = "";
  if (!visibleEvents.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No participation events recorded yet.";
    row.append(cell);
    els.rows.append(row);
    return;
  }
  visibleEvents.forEach((event) => {
    const metadata = event.metadata || {};
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(event.student_name || event.student_identifier || "Student")}</td>
      <td>${escapeHtml(labelize(event.event_type))}</td>
      <td>${escapeHtml(event.points ?? 0)}</td>
      <td>${escapeHtml(event.session_title || event.session_date || "No session")}</td>
      <td>${escapeHtml(metadata.note || "")}</td>
      <td>${escapeHtml(formatDate(event.created_at))}</td>
    `;
    els.rows.append(row);
  });
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to record participation.", "danger");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.record.disabled = isBusy;
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
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
