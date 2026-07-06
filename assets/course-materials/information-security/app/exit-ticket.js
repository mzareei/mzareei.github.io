import { loadMyExitTickets, submitExitTicket } from "./exit-ticket-api.js";

const els = {
  section: document.getElementById("exitSectionSelect"),
  session: document.getElementById("exitSessionSelect"),
  confidence: document.getElementById("exitConfidenceInput"),
  confidenceLabel: document.getElementById("exitConfidenceLabel"),
  oneThing: document.getElementById("exitOneThingInput"),
  muddyPoint: document.getElementById("exitMuddyPointInput"),
  nextAction: document.getElementById("exitNextActionSelect"),
  submit: document.getElementById("submitExitTicketBtn"),
  refresh: document.getElementById("refreshExitTicketsBtn"),
  rows: document.getElementById("exitTicketRows"),
  status: document.getElementById("exitTicketStatus")
};

let currentContext = {
  sections: [],
  class_sessions: [],
  tickets: []
};

els.confidence.addEventListener("input", () => {
  els.confidenceLabel.textContent = els.confidence.value;
});
els.section.addEventListener("change", renderSessionOptions);
els.submit.addEventListener("click", submitCurrentTicket);
els.refresh.addEventListener("click", refresh);

refresh();

async function refresh() {
  await run("Loading exit ticket context...", async () => {
    currentContext = await loadMyExitTickets();
    renderSectionOptions();
    renderSessionOptions();
    renderTickets(currentContext.tickets || []);
    setStatus("Exit ticket context loaded.", "good");
  });
}

async function submitCurrentTicket() {
  await run("Submitting exit ticket...", async () => {
    await submitExitTicket({
      section_id: els.section.value,
      class_session_id: els.session.value,
      confidence: Number(els.confidence.value),
      one_thing: els.oneThing.value,
      muddy_point: els.muddyPoint.value,
      next_action: els.nextAction.value
    });
    els.oneThing.value = "";
    els.muddyPoint.value = "";
    await refresh();
    setStatus("Exit ticket saved.", "good");
  });
}

function renderSectionOptions() {
  const previous = els.section.value;
  els.section.innerHTML = "";
  (currentContext.sections || []).forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = `${section.section_code}: ${section.section_name}`;
    option.selected = previous ? option.value === previous : false;
    els.section.append(option);
  });
}

function renderSessionOptions() {
  const selectedSection = els.section.value;
  els.session.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "No specific session";
  els.session.append(empty);
  (currentContext.class_sessions || [])
    .filter((session) => !selectedSection || session.section_id === selectedSection)
    .forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = `${session.planned_date || ""} · ${session.title} (${labelize(session.state)})`;
      els.session.append(option);
    });
}

function renderTickets(tickets) {
  els.rows.innerHTML = "";
  if (!tickets.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No exit tickets yet.";
    row.append(cell);
    els.rows.append(row);
    return;
  }
  tickets.forEach((ticket) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDate(ticket.created_at))}</td>
      <td>${escapeHtml(ticket.confidence)}/5</td>
      <td>${escapeHtml(ticket.one_thing)}</td>
      <td>${escapeHtml(ticket.muddy_point)}</td>
      <td>${escapeHtml(labelize(ticket.next_action))}</td>
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
    setStatus(error.message || "Unable to save exit ticket.", "danger");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  els.submit.disabled = isBusy;
  els.refresh.disabled = isBusy;
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
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
