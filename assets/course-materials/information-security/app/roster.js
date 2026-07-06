import { applyRoster, correctRosterProfile, listRoster, mergeRosterProfile, previewRoster } from "./roster-api.js";
import { platformConfig } from "./auth-api.js";

const els = {
  csv: document.getElementById("rosterCsvInput"),
  domains: document.getElementById("allowedDomainsInput"),
  source: document.getElementById("sourceFilenameInput"),
  preview: document.getElementById("previewRosterBtn"),
  apply: document.getElementById("applyRosterBtn"),
  refresh: document.getElementById("refreshRosterBtn"),
  status: document.getElementById("rosterStatus"),
  summary: document.getElementById("rosterSummary"),
  rosterRows: document.getElementById("rosterRows"),
  currentRows: document.getElementById("currentRosterRows"),
  selectedRosterProfile: document.getElementById("selectedRosterProfile"),
  correctionEmail: document.getElementById("correctionEmailInput"),
  correctionName: document.getElementById("correctionNameInput"),
  correctionStudentId: document.getElementById("correctionStudentIdInput"),
  correctionStatus: document.getElementById("correctionStatusSelect"),
  correctionReasonInput: document.getElementById("correctionReasonInput"),
  saveCorrection: document.getElementById("saveRosterCorrectionBtn"),
  mergeSourceProfile: document.getElementById("mergeSourceProfileInput"),
  mergeTargetProfile: document.getElementById("mergeTargetProfileInput"),
  mergeProfile: document.getElementById("mergeRosterProfileBtn")
};

let lastPreview = null;
let currentRoster = [];
let selectedRosterProfile = null;

els.preview.addEventListener("click", previewCurrentRoster);
els.apply.addEventListener("click", applyCurrentRoster);
els.refresh.addEventListener("click", refreshCurrentRoster);
els.saveCorrection.addEventListener("click", saveRosterCorrection);
els.mergeProfile.addEventListener("click", mergeSelectedRosterProfile);

const configuredDomains = platformConfig().allowedInstitutionalDomains || [];
if (configuredDomains.length) {
  els.domains.value = configuredDomains.join(", ");
}

refreshCurrentRoster();

async function previewCurrentRoster() {
  await run("Validating roster rows...", async () => {
    const rows = parseRosterCsv(els.csv.value);
    const allowed_domains = allowedDomains();
    lastPreview = await previewRoster({
      rows,
      allowedDomains: allowed_domains
    });
    renderPreview(lastPreview);
    setStatus(`${lastPreview.accepted_count} accepted, ${lastPreview.rejected_count} rejected.`, lastPreview.rejected_count ? "warn" : "good");
  });
}

async function applyCurrentRoster() {
  await run("Applying accepted roster rows...", async () => {
    const rows = parseRosterCsv(els.csv.value);
    const allowed_domains = allowedDomains();
    const result = await applyRoster({
      rows,
      allowedDomains: allowed_domains,
      sourceFilename: els.source.value
    });
    lastPreview = result;
    renderPreview(result);
    await refreshCurrentRoster(false);
    setStatus(`Roster import saved: ${result.accepted_count} accepted, ${result.rejected_count} rejected.`, result.rejected_count ? "warn" : "good");
  });
}

async function refreshCurrentRoster(showMessage = true) {
  await run(showMessage ? "Loading current roster..." : "", async () => {
    const result = await listRoster();
    currentRoster = result.roster || [];
    renderCurrentRoster(currentRoster);
    if (showMessage) setStatus(`Loaded ${result.roster?.length || 0} roster record${result.roster?.length === 1 ? "" : "s"}.`, "good");
  });
}

async function saveRosterCorrection() {
  if (!selectedRosterProfile?.profile_id) {
    setStatus("Select a roster profile first.", "warn");
    return;
  }
  await run("Saving roster correction...", async () => {
    await correctRosterProfile({
      profileId: selectedRosterProfile.profile_id,
      institutionalEmail: els.correctionEmail.value,
      fullName: els.correctionName.value,
      studentIdentifier: els.correctionStudentId.value,
      status: els.correctionStatus.value,
      reason: els.correctionReasonInput.value
    });
    await refreshCurrentRoster(false);
    setStatus("Roster profile corrected.", "good");
  });
}

async function mergeSelectedRosterProfile() {
  const sourceProfileId = els.mergeSourceProfile.value.trim();
  const targetProfileId = els.mergeTargetProfile.value.trim();
  if (!sourceProfileId || !targetProfileId) {
    setStatus("Select a source profile and paste a target profile ID.", "warn");
    return;
  }
  await run("Merging roster profile...", async () => {
    await mergeRosterProfile({
      sourceProfileId,
      targetProfileId,
      reason: els.correctionReasonInput.value
    });
    els.mergeTargetProfile.value = "";
    await refreshCurrentRoster(false);
    setStatus("Roster profile merged into target identity.", "good");
  });
}

function parseRosterCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((cell) => normalizeHeader(cell));
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row = { row_number: index + 2 };
    header.forEach((key, columnIndex) => {
      if (key) row[key] = cells[columnIndex] || "";
    });
    return {
      row_number: row.row_number,
      institutional_email: row.institutional_email || row.email || "",
      full_name: row.full_name || row.name || "",
      student_identifier: row.student_identifier || row.student_id || row.matricula || "",
      section_code: row.section_code || row.section || "",
      role: row.role || "student"
    };
  });
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function allowedDomains() {
  return els.domains.value
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

function renderPreview(result) {
  renderSummary(result);
  els.rosterRows.innerHTML = "";
  const rows = [
    ...(result.accepted_rows || []).map((row) => ({ ...row, status: "Accepted" })),
    ...(result.rejected_rows || []).map((row) => ({ ...row, status: row.reason || "Rejected" }))
  ];
  if (!rows.length) {
    appendEmptyRow(els.rosterRows, 6, "No preview rows yet.");
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.row_number)}</td>
      <td>${escapeHtml(row.institutional_email)}</td>
      <td>${escapeHtml(row.full_name)}</td>
      <td>${escapeHtml(row.section_code)}</td>
      <td>${escapeHtml(labelize(row.role))}</td>
      <td>${escapeHtml(row.status)}</td>
    `;
    els.rosterRows.append(tr);
  });
}

function renderSummary(result) {
  els.summary.innerHTML = "";
  [
    ["Rows", result.row_count || 0],
    ["Accepted", result.accepted_count || 0],
    ["Rejected", result.rejected_count || 0]
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "gradebook-stat";
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    els.summary.append(card);
  });
}

function renderCurrentRoster(rows) {
  els.currentRows.innerHTML = "";
  if (!rows.length) {
    appendEmptyRow(els.currentRows, 5, "No roster records found.");
    return;
  }
  rows.forEach((row) => {
    const sections = (row.sections || []).map((section) => `${section.section_code} (${labelize(section.role)})`).join(", ");
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.dataset.profileId = row.profile_id;
    tr.innerHTML = `
      <td>${escapeHtml(row.full_name)}<br><small>${escapeHtml(row.student_identifier)}</small><br><small>${escapeHtml(row.profile_id)}</small></td>
      <td>${escapeHtml(row.institutional_email)}</td>
      <td>${escapeHtml(sections)}</td>
      <td>${escapeHtml(labelize(row.course_role))}</td>
      <td>${row.claimed ? "Yes" : "Not yet"}</td>
    `;
    tr.addEventListener("click", () => selectRosterProfile(row.profile_id));
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectRosterProfile(row.profile_id);
    });
    els.currentRows.append(tr);
  });
  if (selectedRosterProfile?.profile_id) selectRosterProfile(selectedRosterProfile.profile_id);
}

function selectRosterProfile(profileId) {
  selectedRosterProfile = currentRoster.find((row) => row.profile_id === profileId) || null;
  if (!selectedRosterProfile) {
    els.selectedRosterProfile.textContent = "No roster profile selected";
    els.correctionEmail.value = "";
    els.correctionName.value = "";
    els.correctionStudentId.value = "";
    els.correctionStatus.value = "invited";
    els.mergeSourceProfile.value = "";
  } else {
    els.selectedRosterProfile.textContent = `${selectedRosterProfile.full_name || selectedRosterProfile.institutional_email} · ${selectedRosterProfile.profile_id}`;
    els.correctionEmail.value = selectedRosterProfile.institutional_email || "";
    els.correctionName.value = selectedRosterProfile.full_name || "";
    els.correctionStudentId.value = selectedRosterProfile.student_identifier || "";
    els.correctionStatus.value = selectedRosterProfile.profile_status || "invited";
    els.mergeSourceProfile.value = selectedRosterProfile.profile_id || "";
  }
  Array.from(els.currentRows.querySelectorAll("tr")).forEach((row) => {
    row.classList.toggle("selected", row.dataset.profileId === profileId);
  });
}

async function run(message, action) {
  setBusy(true);
  if (message) setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to manage roster.", "danger");
  } finally {
    setBusy(false);
  }
}

function appendEmptyRow(target, colSpan, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  cell.textContent = message;
  row.append(cell);
  target.append(row);
}

function setBusy(isBusy) {
  els.preview.disabled = isBusy;
  els.apply.disabled = isBusy;
  els.refresh.disabled = isBusy;
  els.saveCorrection.disabled = isBusy;
  els.mergeProfile.disabled = isBusy;
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
