import { adjustGradebookScore, downloadGradebookCsv, loadGradebookSummary, lockGradebookScore, saveGradebookCategory, setGradebookScoreStatus } from "./gradebook-api.js";
import { teacherContextFromUrl } from "./teacher-context.js";

const els = {
  refresh: document.getElementById("refreshGradebookBtn"),
  exportCsv: document.getElementById("exportCsvBtn"),
  rows: document.getElementById("gradebookRows"),
  status: document.getElementById("gradebookStatus"),
  summary: document.getElementById("gradebookSummary"),
  category: document.getElementById("categoryFilter"),
  section: document.getElementById("sectionFilter"),
  item: document.getElementById("itemFilter"),
  selectedScore: document.getElementById("selectedScore"),
  adjustedScore: document.getElementById("adjustedScoreInput"),
  adjustmentReasonInput: document.getElementById("adjustmentReasonInput"),
  applyAdjustment: document.getElementById("applyAdjustmentBtn"),
  lockScore: document.getElementById("lockScoreBtn"),
  categoryNameInput: document.getElementById("categoryNameInput"),
  categoryWeightInput: document.getElementById("categoryWeightInput"),
  categoryDropLowestInput: document.getElementById("categoryDropLowestInput"),
  categoryStatusSelect: document.getElementById("categoryStatusSelect"),
  saveCategory: document.getElementById("saveCategoryBtn"),
  newCategory: document.getElementById("newCategoryBtn"),
  manualStatusItemSelect: document.getElementById("manualStatusItemSelect"),
  manualStatusStudentSelect: document.getElementById("manualStatusStudentSelect"),
  manualStatusSelect: document.getElementById("manualStatusSelect"),
  manualStatusScoreInput: document.getElementById("manualStatusScoreInput"),
  manualStatusReasonInput: document.getElementById("manualStatusReasonInput"),
  applyStatus: document.getElementById("applyStatusBtn")
};

let selectedScoreId = "";
let currentSummary = {
  categories: [],
  items: [],
  sections: [],
  students: [],
  scores: [],
  actions: [],
  weighted_summary: {
    category_summaries: []
  }
};
const selectedTeacherContext = teacherContextFromUrl();

els.refresh.addEventListener("click", refresh);
els.exportCsv.addEventListener("click", exportCsv);
els.applyAdjustment.addEventListener("click", applyAdjustment);
els.lockScore.addEventListener("click", lockSelectedScore);
els.saveCategory.addEventListener("click", saveCategorySettings);
els.newCategory.addEventListener("click", () => {
  els.category.value = "";
  clearCategorySettings();
});
els.applyStatus.addEventListener("click", applyStatusRecord);
els.section.addEventListener("change", renderManualStatusControls);
els.manualStatusSelect.addEventListener("change", updateManualStatusScoreDefaults);
[els.category, els.section, els.item].forEach((filter) => {
  filter.addEventListener("change", refresh);
});

refresh();

async function refresh(overrideFilters = {}) {
  await run("Loading gradebook...", async () => {
    const previousFilters = initialContextFilters({ ...getFilters(), ...overrideFilters });
    currentSummary = await loadGradebookSummary(previousFilters);
    renderFilters(previousFilters);
    renderCategorySettings();
    renderManualStatusControls();
    renderSummary();
    renderRows(currentSummary.scores || []);
    selectScore(selectedScoreId);
    setStatus(`Loaded ${(currentSummary.scores || []).length} score record${(currentSummary.scores || []).length === 1 ? "" : "s"}.`, "good");
  });
}

async function exportCsv() {
  await run("Preparing CSV...", async () => {
    await downloadGradebookCsv(getFilters());
    setStatus("CSV export prepared.", "good");
  });
}

async function applyAdjustment() {
  if (!selectedScoreId) {
    setStatus("Select a score first.", "warn");
    return;
  }
  const reason = els.adjustmentReasonInput.value.trim();
  const newScoreFinal = els.adjustedScore.value;
  if (!reason || reason.length < 5) {
    setStatus("Enter a reason before adjusting a score.", "warn");
    return;
  }
  await run("Applying adjustment...", async () => {
    await adjustGradebookScore({ scoreId: selectedScoreId, newScoreFinal, reason });
    els.adjustmentReasonInput.value = "";
    await refresh();
    setStatus("Score adjusted.", "good");
  });
}

async function lockSelectedScore() {
  if (!selectedScoreId) {
    setStatus("Select a score first.", "warn");
    return;
  }
  const reason = els.adjustmentReasonInput.value.trim() || "Finalized by instructor";
  await run("Locking score...", async () => {
    await lockGradebookScore({ scoreId: selectedScoreId, reason });
    await refresh();
    setStatus("Score locked.", "good");
  });
}

async function saveCategorySettings() {
  const name = els.categoryNameInput.value.trim();
  if (!name) {
    setStatus("Enter a category name before saving.", "warn");
    return;
  }

  await run("Saving gradebook category...", async () => {
    const result = await saveGradebookCategory({
      categoryId: els.category.value || "",
      name,
      weightPercent: els.categoryWeightInput.value,
      dropLowestCount: els.categoryDropLowestInput.value,
      status: els.categoryStatusSelect.value
    });
    await refresh({ category_id: result.category?.id || "" });
    setStatus("Gradebook category saved.", "good");
  });
}

async function applyStatusRecord() {
  const reason = els.manualStatusReasonInput.value.trim();
  if (!els.manualStatusItemSelect.value || !els.manualStatusStudentSelect.value) {
    setStatus("Choose an activity and student before applying a status.", "warn");
    return;
  }
  if (!reason || reason.length < 5) {
    setStatus("Enter a reason before applying a status.", "warn");
    return;
  }
  const student = (currentSummary.students || []).find((row) => row.profile_id === els.manualStatusStudentSelect.value);
  if (!student?.section_id) {
    setStatus("The selected student needs an active section.", "warn");
    return;
  }

  await run("Applying status record...", async () => {
    await setGradebookScoreStatus({
      gradebookItemId: els.manualStatusItemSelect.value,
      profileId: els.manualStatusStudentSelect.value,
      sectionId: student.section_id,
      scoreStatus: els.manualStatusSelect.value,
      scoreFinal: els.manualStatusScoreInput.value,
      reason
    });
    els.manualStatusReasonInput.value = "";
    await refresh();
    setStatus("Gradebook status record applied.", "good");
  });
}

function renderFilters(previousFilters) {
  renderSelect(els.section, currentSummary.sections || [], {
    value: "id",
    label: (section) => `${section.section_code}: ${section.section_name}`,
    allLabel: "All sections",
    selected: previousFilters.section_id
  });
  renderSelect(els.category, currentSummary.categories || [], {
    value: "id",
    label: (category) => category.name,
    allLabel: "All categories",
    selected: previousFilters.category_id
  });
  renderSelect(els.item, currentSummary.items || [], {
    value: "id",
    label: (item) => item.title,
    allLabel: "All activities",
    selected: previousFilters.gradebook_item_id
  });
}

function renderCategorySettings() {
  const category = (currentSummary.categories || []).find((row) => row.id === els.category.value);
  const canManageCategories = (currentSummary.actions || []).includes("save_category");
  if (!category) {
    clearCategorySettings();
    setCategorySettingsDisabled(!canManageCategories);
    return;
  }
  els.categoryNameInput.value = category.name || "";
  els.categoryWeightInput.value = category.weight_percent ?? 0;
  els.categoryDropLowestInput.value = category.drop_lowest_count ?? 0;
  els.categoryStatusSelect.value = category.status || "active";
  setCategorySettingsDisabled(!canManageCategories);
}

function clearCategorySettings() {
  els.categoryNameInput.value = "";
  els.categoryWeightInput.value = "";
  els.categoryDropLowestInput.value = 0;
  els.categoryStatusSelect.value = "active";
  const canManageCategories = (currentSummary.actions || []).includes("save_category");
  setCategorySettingsDisabled(!canManageCategories);
}

function setCategorySettingsDisabled(isDisabled) {
  els.categoryNameInput.disabled = isDisabled;
  els.categoryWeightInput.disabled = isDisabled;
  els.categoryDropLowestInput.disabled = isDisabled;
  els.categoryStatusSelect.disabled = isDisabled;
  els.saveCategory.disabled = isDisabled;
  els.newCategory.disabled = isDisabled;
}

function renderSelect(select, rows, config) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = config.allLabel;
  select.append(all);
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row[config.value] || "";
    option.textContent = config.label(row);
    option.selected = option.value === config.selected;
    select.append(option);
  });
}

function renderManualStatusControls() {
  const canSetStatus = (currentSummary.actions || []).includes("set_score_status");
  renderSelect(els.manualStatusItemSelect, currentSummary.items || [], {
    value: "id",
    label: (item) => item.title,
    allLabel: "Choose activity",
    selected: els.manualStatusItemSelect.value
  });
  const selectedSectionId = els.section.value || selectedTeacherContext.sectionId || "";
  const students = (currentSummary.students || []).filter((student) => !selectedSectionId || student.section_id === selectedSectionId);
  renderSelect(els.manualStatusStudentSelect, students, {
    value: "profile_id",
    label: (student) => `${student.student_name || "Student"} · ${student.student_identifier || student.institutional_email || ""}`,
    allLabel: "Choose student",
    selected: els.manualStatusStudentSelect.value
  });
  els.manualStatusItemSelect.disabled = !canSetStatus;
  els.manualStatusStudentSelect.disabled = !canSetStatus;
  els.manualStatusSelect.disabled = !canSetStatus;
  els.manualStatusScoreInput.disabled = !canSetStatus || els.manualStatusSelect.value === "excused";
  els.manualStatusReasonInput.disabled = !canSetStatus;
  els.applyStatus.disabled = !canSetStatus;
  updateManualStatusScoreDefaults();
}

function updateManualStatusScoreDefaults() {
  if (els.manualStatusSelect.value === "excused") {
    els.manualStatusScoreInput.value = "";
    els.manualStatusScoreInput.disabled = true;
    return;
  }
  els.manualStatusScoreInput.disabled = !(currentSummary.actions || []).includes("set_score_status");
  if (els.manualStatusSelect.value === "missing" && !els.manualStatusScoreInput.value) {
    els.manualStatusScoreInput.value = 0;
  }
}

function renderSummary() {
  const scores = currentSummary.scores || [];
  const weighted_summary = currentSummary.weighted_summary || {};
  const posted = scores.filter((score) => score.status === "posted").length;
  const locked = scores.filter((score) => score.locked_at).length;
  const average = scores.length
    ? Math.round(scores.reduce((total, score) => total + Number(score.score_final || 0), 0) / scores.length * 10) / 10
    : 0;
  els.summary.innerHTML = "";
  [
    ["Scores", scores.length],
    ["Posted", posted],
    ["Locked", locked],
    ["Average final", `${average}%`],
    ["Weighted course", `${Number(weighted_summary.weighted_course_percent || 0).toLocaleString()}%`],
    ["Configured weight", `${Number(weighted_summary.configured_weight_percent || 0).toLocaleString()}%`],
    ["Policy", "Final score includes any small speed bonus"]
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    els.summary.append(card);
  });
  renderWeightedCategorySummary(weighted_summary.category_summaries || []);
}

function renderWeightedCategorySummary(category_summaries) {
  category_summaries.slice(0, 8).forEach((category) => {
    const card = document.createElement("article");
    card.className = "gradebook-stat";
    card.innerHTML = `
      <span>${escapeHtml(category.category_name || "Category")}</span>
      <strong>${escapeHtml(formatPercent(category.category_average_percent))}</strong>
      <small>${escapeHtml(formatPercent(category.category_weight_percent))} weight · Dropped scores ${escapeHtml(category.dropped_score_count || 0)}</small>
    `;
    els.summary.append(card);
  });
}

function renderRows(scores) {
  els.rows.innerHTML = "";
  if (!scores.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.textContent = "No score records found.";
    row.append(cell);
    els.rows.append(row);
    return;
  }
  scores.forEach((score) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.scoreId = score.score_id;
    row.innerHTML = `
      <td>${escapeHtml(score.student_name)}<br><small>${escapeHtml(score.institutional_email)}</small></td>
      <td>${escapeHtml(score.section_code)}</td>
      <td>${escapeHtml(score.item_title)}</td>
      <td>${escapeHtml(score.category_name)}</td>
      <td>${escapeHtml(formatNumber(score.score_raw))}</td>
      <td>${escapeHtml(formatPercent(score.score_percent))}</td>
      <td>${escapeHtml(formatPercent(score.score_final))}</td>
      <td><strong>${escapeHtml(labelize(score.status))}</strong></td>
      <td>${escapeHtml(score.adjustment_count || 0)}${score.latest_adjustment_reason ? `<br><small>${escapeHtml(score.latest_adjustment_reason)}</small>` : ""}</td>
      <td>${escapeHtml(score.locked_at ? formatDate(score.locked_at) : "Open")}</td>
    `;
    row.addEventListener("click", () => selectScore(score.score_id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectScore(score.score_id);
    });
    els.rows.append(row);
  });
}

function selectScore(scoreId) {
  const scores = currentSummary.scores || [];
  const score = scores.find((row) => row.score_id === scoreId);
  selectedScoreId = score ? scoreId : "";
  els.selectedScore.textContent = score
    ? `${score.student_name || score.institutional_email} · ${score.item_title} · ${formatPercent(score.score_final)}`
    : "No score selected";
  els.adjustedScore.value = score && score.score_final !== null && score.score_final !== undefined ? score.score_final : "";
  Array.from(els.rows.querySelectorAll("tr")).forEach((row) => {
    row.classList.toggle("selected", row.dataset.scoreId === selectedScoreId);
  });
  const isLocked = Boolean(score?.locked_at || score?.status === "locked");
  els.applyAdjustment.disabled = !selectedScoreId || isLocked;
  els.lockScore.disabled = !selectedScoreId || isLocked;
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to load gradebook.", "danger");
  } finally {
    setBusy(false);
  }
}

function getFilters() {
  return {
    section_id: els.section.value || "",
    category_id: els.category.value || "",
    gradebook_item_id: els.item.value || ""
  };
}

function initialContextFilters(filters) {
  const selectedContextFilter = {
    section_id: selectedTeacherContext.sectionId
  };
  return {
    ...filters,
    section_id: filters.section_id || selectedContextFilter.section_id
  };
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.exportCsv.disabled = isBusy;
  const score = (currentSummary.scores || []).find((row) => row.score_id === selectedScoreId);
  const isLocked = Boolean(score?.locked_at || score?.status === "locked");
  els.applyAdjustment.disabled = isBusy || !selectedScoreId || isLocked;
  els.lockScore.disabled = isBusy || !selectedScoreId || isLocked;
  setCategorySettingsDisabled(isBusy || !(currentSummary.actions || []).includes("save_category"));
  const canSetStatus = (currentSummary.actions || []).includes("set_score_status");
  els.manualStatusItemSelect.disabled = isBusy || !canSetStatus;
  els.manualStatusStudentSelect.disabled = isBusy || !canSetStatus;
  els.manualStatusSelect.disabled = isBusy || !canSetStatus;
  els.manualStatusScoreInput.disabled = isBusy || !canSetStatus || els.manualStatusSelect.value === "excused";
  els.manualStatusReasonInput.disabled = isBusy || !canSetStatus;
  els.applyStatus.disabled = isBusy || !canSetStatus;
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function formatNumber(value) {
  return value === null || value === undefined ? "" : Number(value).toLocaleString();
}

function formatPercent(value) {
  return value === null || value === undefined ? "" : `${Number(value).toLocaleString()}%`;
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
