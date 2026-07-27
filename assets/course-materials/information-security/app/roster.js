import { addPerson, applyRoster, correctRosterProfile, listRoster, mergeRosterProfile, previewRoster, revokeExternalAccess } from "./roster-api.js";
import { platformConfig } from "./auth-api.js";
import { loadCourseSections } from "./section-api.js";

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
  mergeProfile: document.getElementById("mergeRosterProfileBtn"),
  personEmail: document.getElementById("personEmailInput"),
  personName: document.getElementById("personNameInput"),
  personId: document.getElementById("personIdInput"),
  personSection: document.getElementById("personSectionSelect"),
  personRole: document.getElementById("personRoleSelect"),
  personExternalReasonField: document.getElementById("personExternalReasonField"),
  personExternalReason: document.getElementById("personExternalReasonInput"),
  addPerson: document.getElementById("addPersonBtn"),
  addPersonStatus: document.getElementById("addPersonStatus"),
  externalAccessRows: document.getElementById("externalAccessRows")
};

let lastPreview = null;
let currentRoster = [];
let selectedRosterProfile = null;
let externalAccessGrants = [];

els.preview.addEventListener("click", previewCurrentRoster);
els.apply.addEventListener("click", applyCurrentRoster);
els.refresh.addEventListener("click", refreshCurrentRoster);
els.saveCorrection.addEventListener("click", saveRosterCorrection);
els.mergeProfile.addEventListener("click", mergeSelectedRosterProfile);
els.addPerson.addEventListener("click", addSinglePerson);
els.personEmail.addEventListener("input", updateExternalReasonVisibility);

const configuredDomains = platformConfig().allowedInstitutionalDomains || [];
if (configuredDomains.length) {
  els.domains.value = configuredDomains.join(", ");
}

refreshCurrentRoster();
loadSectionOptions();
updateExternalReasonVisibility();

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
    externalAccessGrants = result.external_access || [];
    renderCurrentRoster(currentRoster);
    renderExternalAccess(externalAccessGrants);
    updateExternalReasonVisibility();
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

async function loadSectionOptions() {
  try {
    const result = await loadCourseSections();
    const sections = (result.sections || []).filter((section) => section.status !== "archived");
    els.personSection.innerHTML = "";
    if (!sections.length) {
      els.personSection.append(new Option("No sections yet - create one first", ""));
      return;
    }
    sections.forEach((section) => {
      els.personSection.append(new Option(`${section.section_code} - ${section.section_name}`, section.section_code));
    });
  } catch (error) {
    els.personSection.innerHTML = "";
    els.personSection.append(new Option("Sections unavailable", ""));
    setPersonStatus(error.message || "Unable to load sections.", "danger");
  }
}

// The reason field only appears for addresses that actually need an access grant, so the
// common institutional case stays a four-field form.
function updateExternalReasonVisibility() {
  const email = String(els.personEmail.value || "").trim().toLowerCase();
  const domains = allowedDomains();
  const known = externalAccessGrants.some((grant) => grant.email === email && grant.status === "active");
  const institutional = domains.some((domain) => email.endsWith(`@${domain}`));
  const needsReason = Boolean(email) && email.includes("@") && !institutional && !known;
  els.personExternalReasonField.hidden = !needsReason;
  return needsReason;
}

async function addSinglePerson() {
  const email = String(els.personEmail.value || "").trim().toLowerCase();
  const fullName = String(els.personName.value || "").trim();
  const sectionCode = els.personSection.value;
  if (!email || !fullName) {
    setPersonStatus("Enter an email address and a full name.", "warn");
    return;
  }
  if (!sectionCode) {
    setPersonStatus("Create a course section before adding people.", "warn");
    return;
  }

  await run("Adding person...", async () => {
    const result = await addPerson({
      institutionalEmail: email,
      fullName,
      studentIdentifier: els.personId.value,
      sectionCode,
      role: els.personRole.value,
      allowedDomains: allowedDomains(),
      externalAccessReason: els.personExternalReason.value
    });

    if (result.needs_external_access) {
      els.personExternalReasonField.hidden = false;
      els.personExternalReason.focus();
      setPersonStatus("This address is outside the approved domains. Add a reason to approve it, then add the person again.", "warn");
      return;
    }
    if (!result.added) {
      setPersonStatus(result.reason || "The person could not be added.", "danger");
      return;
    }

    const roleLabel = labelize(result.person?.role || els.personRole.value);
    const grantNote = result.external_access_grant ? " External access was granted and recorded." : "";
    setPersonStatus(`${fullName} added as ${roleLabel} in section ${sectionCode}.${grantNote}`, "good");
    els.personEmail.value = "";
    els.personName.value = "";
    els.personId.value = "";
    els.personExternalReason.value = "";
    updateExternalReasonVisibility();
    await refreshCurrentRoster(false);
  }, setPersonStatus);
}

async function revokeGrant(email) {
  const reason = window.prompt(`Reason for revoking access for ${email}?`);
  if (reason === null) return;
  await run("Revoking access...", async () => {
    await revokeExternalAccess({ email, reason });
    await refreshCurrentRoster(false);
    setPersonStatus(`Access revoked for ${email}.`, "good");
  }, setPersonStatus);
}

function renderExternalAccess(grants) {
  els.externalAccessRows.innerHTML = "";
  if (!grants.length) {
    appendEmptyRow(els.externalAccessRows, 5, "No addresses approved outside the institutional domains.");
    return;
  }
  grants.forEach((grant) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(grant.email)}</td>
      <td>${escapeHtml(labelize(grant.status))}</td>
      <td>${escapeHtml(grant.reason)}</td>
      <td>${escapeHtml(formatDate(grant.granted_at))}</td>
      <td></td>
    `;
    if (grant.status === "active") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "app-button secondary";
      button.textContent = "Revoke";
      button.addEventListener("click", () => revokeGrant(grant.email));
      tr.lastElementChild.append(button);
    }
    els.externalAccessRows.append(tr);
  });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function setPersonStatus(message, tone) {
  els.addPersonStatus.textContent = message;
  els.addPersonStatus.dataset.tone = tone || "";
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

async function run(message, action, report = setStatus) {
  setBusy(true);
  if (message) report(message, "");
  try {
    await action();
  } catch (error) {
    report(error.message || "Unable to manage roster.", "danger");
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
  els.addPerson.disabled = isBusy;
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
