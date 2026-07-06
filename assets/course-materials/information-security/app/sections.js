import { loadCourseSections, saveCourseSection } from "./section-api.js";

const els = {
  refresh: document.getElementById("refreshSectionsBtn"),
  newSection: document.getElementById("newSectionBtn"),
  saveSection: document.getElementById("saveSectionBtn"),
  status: document.getElementById("sectionStatus"),
  count: document.getElementById("sectionCount"),
  selectedSection: document.getElementById("selectedSection"),
  sectionRows: document.getElementById("sectionRows"),
  code: document.getElementById("sectionCodeInput"),
  name: document.getElementById("sectionNameInput"),
  meeting: document.getElementById("sectionMeetingPatternInput"),
  campus: document.getElementById("sectionCampusInput"),
  sectionStatusSelect: document.getElementById("sectionStatusSelect")
};

let sections = [];
let selectedSectionId = "";

els.refresh.addEventListener("click", refresh);
els.newSection.addEventListener("click", clearSectionForm);
els.saveSection.addEventListener("click", saveSection);

refresh();

async function refresh() {
  await run("Loading course sections...", async () => {
    const result = await loadCourseSections();
    sections = result.sections || [];
    renderSections();
    if (selectedSectionId) selectSection(selectedSectionId);
    setStatus(`Loaded ${sections.length} section${sections.length === 1 ? "" : "s"}.`, "good");
  });
}

async function saveSection() {
  const sectionCode = els.code.value.trim();
  const sectionName = els.name.value.trim();
  if (!sectionCode || !sectionName) {
    setStatus("Section code and section name are required.", "warn");
    return;
  }

  await run("Saving section...", async () => {
    const result = await saveCourseSection({
      sectionId: selectedSectionId,
      sectionCode,
      sectionName,
      meetingPattern: els.meeting.value.trim(),
      campus: els.campus.value.trim(),
      status: els.sectionStatusSelect.value
    });
    sections = result.sections || [];
    selectedSectionId = result.section?.id || "";
    renderSections();
    selectSection(selectedSectionId);
    setStatus("Section saved.", "good");
  });
}

function renderSections() {
  els.count.textContent = String(sections.length);
  els.sectionRows.innerHTML = "";
  if (!sections.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No sections created yet.";
    row.append(cell);
    els.sectionRows.append(row);
    return;
  }

  sections.forEach((section) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.sectionId = section.id;
    row.innerHTML = `
      <td><strong>${escapeHtml(section.section_code)}</strong></td>
      <td>${escapeHtml(section.section_name)}</td>
      <td>${escapeHtml(section.meeting_pattern || "")}</td>
      <td>${escapeHtml(section.campus || "")}</td>
      <td>${escapeHtml(labelize(section.status))}</td>
      <td>${escapeHtml(formatDate(section.updated_at))}</td>
    `;
    row.addEventListener("click", () => selectSection(section.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectSection(section.id);
    });
    els.sectionRows.append(row);
  });
}

function selectSection(sectionId) {
  const section = sections.find((row) => row.id === sectionId);
  selectedSectionId = section ? sectionId : "";
  if (!section) {
    clearSectionForm();
    return;
  }
  els.selectedSection.textContent = `${section.section_code}: ${section.section_name}`;
  els.code.value = section.section_code || "";
  els.name.value = section.section_name || "";
  els.meeting.value = section.meeting_pattern || "";
  els.campus.value = section.campus || "";
  els.sectionStatusSelect.value = section.status || "active";
  Array.from(els.sectionRows.querySelectorAll("tr")).forEach((row) => {
    row.classList.toggle("selected", row.dataset.sectionId === selectedSectionId);
  });
}

function clearSectionForm() {
  selectedSectionId = "";
  els.selectedSection.textContent = "New section";
  els.code.value = "";
  els.name.value = "";
  els.meeting.value = "";
  els.campus.value = "";
  els.sectionStatusSelect.value = "active";
  Array.from(els.sectionRows.querySelectorAll("tr")).forEach((row) => {
    row.classList.remove("selected");
  });
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to manage course sections.", "danger");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.newSection.disabled = isBusy;
  els.saveSection.disabled = isBusy;
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
