import { exportPortfolioEntries, loadPortfolioEntries, submitPortfolioEntry } from "./portfolio-api.js";

const els = {
  refresh: document.getElementById("refreshPortfolioBtn"),
  exportPortfolio: document.getElementById("exportPortfolioBtn"),
  submit: document.getElementById("submitPortfolioEntryBtn"),
  status: document.getElementById("portfolioStatus"),
  count: document.getElementById("portfolioEntryCount"),
  rows: document.getElementById("portfolioEntryRows"),
  title: document.getElementById("portfolioTitleInput"),
  type: document.getElementById("portfolioTypeSelect"),
  category: document.getElementById("portfolioCategorySelect"),
  content: document.getElementById("portfolioContentSelect"),
  evidence: document.getElementById("portfolioEvidenceInput")
};

let categories = [];
let contentItems = [];

els.refresh.addEventListener("click", refresh);
els.exportPortfolio.addEventListener("click", exportPortfolio);
els.submit.addEventListener("click", submitEntry);

refresh();

async function refresh() {
  await run("Loading portfolio entries...", async () => {
    const result = await loadPortfolioEntries();
    categories = result.categories || [];
    contentItems = result.content_items || [];
    renderSelects();
    renderEntries(result.entries || []);
    setStatus("Portfolio entries loaded.", "good");
  });
}

async function submitEntry() {
  const title = els.title.value.trim();
  const evidence = els.evidence.value.trim();
  if (!title || !evidence) {
    setStatus("Add a title and evidence before submitting.", "warn");
    return;
  }

  await run("Submitting portfolio evidence...", async () => {
    const result = await submitPortfolioEntry({
      entry_type: els.type.value,
      gradebook_category_id: els.category.value || "",
      content_item_id: els.content.value || "",
      visibility: "student_teacher",
      entry_json: {
        title,
        evidence,
        submitted_from: "authenticated_course_app"
      }
    });
    renderEntries(result.entries || []);
    els.title.value = "";
    els.evidence.value = "";
    setStatus("Portfolio evidence submitted.", "good");
  });
}

async function exportPortfolio() {
  await run("Preparing portfolio export...", async () => {
    const payload = await exportPortfolioEntries();
    downloadPortfolioExport(payload);
    setStatus("Portfolio export downloaded.", "good");
  });
}

function renderSelects() {
  renderSelect(els.category, categories, "No category", (category) => category.name);
  renderSelect(els.content, contentItems, "No related content", (item) => item.title);
}

function renderSelect(select, rows, emptyLabel, label) {
  const previous = select.value;
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyLabel;
  select.append(empty);
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = label(row);
    option.selected = row.id === previous;
    select.append(option);
  });
}

function renderEntries(entries) {
  els.count.textContent = String(entries.length);
  els.rows.innerHTML = "";
  if (!entries.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No portfolio entries saved yet.";
    row.append(cell);
    els.rows.append(row);
    return;
  }
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  entries.forEach((entry) => {
    const entry_json = entry.entry_json || {};
    const gradebook_category_id = entry.gradebook_category_id || "";
    const category = categoryById.get(gradebook_category_id) || {};
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(entry_json.title || "Untitled evidence")}<br><small>${escapeHtml(entry_json.evidence || "")}</small></td>
      <td>${escapeHtml(labelize(entry.entry_type))}</td>
      <td>${escapeHtml(category.name || "Uncategorized")}</td>
      <td>${escapeHtml(labelize(entry.visibility))}</td>
      <td>${escapeHtml(formatDate(entry.created_at))}</td>
    `;
    els.rows.append(row);
  });
}

async function run(message, action) {
  els.refresh.disabled = true;
  els.exportPortfolio.disabled = true;
  els.submit.disabled = true;
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to update portfolio.", "danger");
  } finally {
    els.refresh.disabled = false;
    els.exportPortfolio.disabled = false;
    els.submit.disabled = false;
  }
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

function downloadPortfolioExport(payload) {
  const dateLabel = new Date().toISOString().slice(0, 10);
  const filename = payload.filename || `tc2007b-portfolio-export-${dateLabel}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
