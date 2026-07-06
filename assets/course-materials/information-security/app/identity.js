import { confirmIdentity, loadIdentityConfirmation, reportIdentityIssue } from "./identity-api.js";

const els = {
  refresh: document.getElementById("refreshIdentityBtn"),
  confirm: document.getElementById("confirmIdentityBtn"),
  report: document.getElementById("reportIdentityIssueBtn"),
  status: document.getElementById("identityStatus"),
  state: document.getElementById("identityState"),
  identityProfileSummary: document.getElementById("identityProfileSummary"),
  identitySectionRows: document.getElementById("identitySectionRows"),
  identityIssueNoteInput: document.getElementById("identityIssueNoteInput")
};

els.refresh.addEventListener("click", refresh);
els.confirm.addEventListener("click", confirmCurrentIdentity);
els.report.addEventListener("click", reportCurrentIssue);

refresh();

async function refresh() {
  await run("Loading identity...", async () => {
    const result = await loadIdentityConfirmation();
    renderIdentity(result);
    setStatus("Identity loaded.", "good");
  });
}

async function confirmCurrentIdentity() {
  await run("Confirming identity...", async () => {
    const result = await confirmIdentity();
    renderIdentity(result);
    setStatus("Identity confirmed.", "good");
  });
}

async function reportCurrentIssue() {
  const note = els.identityIssueNoteInput.value.trim();
  if (note.length < 5) {
    setStatus("Add a short note explaining what is wrong.", "warn");
    return;
  }
  await run("Reporting identity issue...", async () => {
    const result = await reportIdentityIssue(note);
    renderIdentity(result);
    setStatus("Identity issue reported. Your teacher can correct the roster record.", "warn");
  });
}

function renderIdentity(result) {
  const profile = result.profile || {};
  const confirmation = result.confirmation || {};
  const sections = result.sections || [];
  els.state.textContent = labelize(confirmation.status || "pending");
  els.identityIssueNoteInput.value = confirmation.status === "reported_issue" ? confirmation.issue_note || "" : "";
  renderProfile(profile, confirmation);
  renderSections(sections);
}

function renderProfile(profile, confirmation) {
  els.identityProfileSummary.innerHTML = "";
  [
    ["Name", profile.full_name || ""],
    ["Preferred name", profile.preferred_name || ""],
    ["Institutional email", profile.institutional_email || ""],
    ["Student ID", profile.student_identifier || "Not assigned"],
    ["Status", labelize(confirmation.status || "pending")],
    ["Confirmed at", formatDate(confirmation.confirmed_at)]
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong>`;
    els.identityProfileSummary.append(card);
  });
}

function renderSections(sections) {
  els.identitySectionRows.innerHTML = "";
  if (!sections.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No active student section found.";
    row.append(cell);
    els.identitySectionRows.append(row);
    return;
  }
  sections.forEach((section) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(section.section_code)}</strong></td>
      <td>${escapeHtml(section.section_name)}</td>
      <td>${escapeHtml(section.meeting_pattern || "")}</td>
      <td>${escapeHtml(labelize(section.status))}</td>
    `;
    els.identitySectionRows.append(row);
  });
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to confirm identity.", "danger");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.confirm.disabled = isBusy;
  els.report.disabled = isBusy;
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
