import { loadContentLibrary, saveContentItem } from "./content-library-api.js";

const els = {
  refresh: document.getElementById("refreshContentLibraryBtn"),
  newItem: document.getElementById("newContentItemBtn"),
  save: document.getElementById("saveContentItemBtn"),
  status: document.getElementById("contentLibraryStatus"),
  count: document.getElementById("contentItemCount"),
  selected: document.getElementById("selectedContentItem"),
  rows: document.getElementById("contentItemRows"),
  title: document.getElementById("contentTitleInput"),
  slug: document.getElementById("contentSlugInput"),
  type: document.getElementById("contentTypeSelect"),
  summary: document.getElementById("contentSummaryInput"),
  sourceKind: document.getElementById("contentSourceKindSelect"),
  sourceRef: document.getElementById("contentSourceRefInput"),
  sensitive: document.getElementById("contentSensitiveInput"),
  points: document.getElementById("contentDefaultPointsInput"),
  createDraft: document.getElementById("createDraftReleaseInput"),
  draftSection: document.getElementById("draftReleaseSectionInput"),
  draftSession: document.getElementById("draftReleaseSessionInput"),
  attempts: document.getElementById("draftReleaseAttemptsInput")
};

let contentItems = [];
let sections = [];
let sessions = [];
let selectedContentItemId = "";
let slugWasEdited = false;

els.refresh.addEventListener("click", refresh);
els.newItem.addEventListener("click", clearForm);
els.save.addEventListener("click", saveSelectedContentItem);
els.slug.addEventListener("input", () => {
  slugWasEdited = true;
});
els.title.addEventListener("input", () => {
  if (!selectedContentItemId && !slugWasEdited) els.slug.value = slugify(els.title.value);
});
els.draftSection.addEventListener("change", renderDraftSessions);

refresh();

async function refresh() {
  await run("Loading content library...", async () => {
    const result = await loadContentLibrary();
    contentItems = result.content_items || [];
    sections = result.sections || [];
    sessions = result.sessions || [];
    renderScopeControls();
    renderContentItems();
    if (selectedContentItemId) selectContentItem(selectedContentItemId);
    setStatus(`Loaded ${contentItems.length} content item${contentItems.length === 1 ? "" : "s"}.`, "good");
  });
}

async function saveSelectedContentItem() {
  const title = els.title.value.trim();
  const slug = slugify(els.slug.value);
  const source_ref = els.sourceRef.value.trim();
  if (!title || !slug || !source_ref) {
    setStatus("Title, slug, and source reference are required.", "warn");
    return;
  }

  await run("Saving content item...", async () => {
    const result = await saveContentItem({
      contentItem: {
        id: selectedContentItemId,
        content_type: els.type.value,
        slug,
        title,
        summary: els.summary.value.trim(),
        source_kind: els.sourceKind.value,
        source_ref,
        contains_sensitive_content: els.sensitive.checked,
        default_points: Number(els.points.value || 0)
      },
      release: {
        create_draft_release: els.createDraft.checked,
        section_id: els.draftSection.value,
        class_session_id: els.draftSession.value,
        allowed_attempts: Number(els.attempts.value || 1)
      }
    });
    contentItems = result.content_items || [];
    sections = result.sections || sections;
    sessions = result.sessions || sessions;
    renderScopeControls();
    renderContentItems();
    selectedContentItemId = result.content_item?.id || selectedContentItemId;
    selectContentItem(selectedContentItemId);
    setStatus(result.draft_release ? "Content item saved with a draft release." : "Content item saved.", "good");
  });
}

function renderScopeControls() {
  renderOptions(els.draftSection, sections, "id", (section) => {
    return `${section.section_code || "Section"}${section.section_name ? ` · ${section.section_name}` : ""}`;
  }, "All sections");
  renderDraftSessions();
}

function renderDraftSessions() {
  const sectionId = els.draftSection.value;
  const visibleSessions = sessions.filter((session) => !sectionId || session.section_id === sectionId);
  renderOptions(els.draftSession, visibleSessions, "id", (session) => {
    return `${session.planned_date || "No date"} · ${session.title || "Class session"} · ${labelize(session.state)}`;
  }, "No session");
}

function renderOptions(target, rows, valueKey, formatter, emptyText) {
  const previous = target.value;
  target.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = emptyText;
  target.append(empty);
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row[valueKey] || "";
    option.textContent = formatter(row);
    target.append(option);
  });
  if (Array.from(target.options).some((option) => option.value === previous)) {
    target.value = previous;
  }
}

function renderContentItems() {
  els.count.textContent = String(contentItems.length);
  els.rows.innerHTML = "";
  if (!contentItems.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No content items created yet.";
    row.append(cell);
    els.rows.append(row);
    return;
  }

  contentItems.forEach((item) => {
    const counts = item.release_counts || {};
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.contentItemId = item.id;
    row.innerHTML = `
      <td><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.slug)}</small></td>
      <td>${escapeHtml(labelize(item.content_type))}</td>
      <td>${escapeHtml(labelize(item.source_kind))}<br><small>${escapeHtml(item.source_ref)}</small></td>
      <td>${item.contains_sensitive_content ? "Yes" : "No"}</td>
      <td>${escapeHtml(counts.draft || 0)} draft · ${escapeHtml(counts.total || 0)} total</td>
      <td>${escapeHtml(formatDate(item.updated_at))}</td>
    `;
    row.addEventListener("click", () => selectContentItem(item.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectContentItem(item.id);
    });
    els.rows.append(row);
  });
}

function selectContentItem(contentItemId) {
  const item = contentItems.find((row) => row.id === contentItemId);
  selectedContentItemId = item ? contentItemId : "";
  if (!item) {
    clearForm();
    return;
  }
  slugWasEdited = true;
  els.selected.textContent = item.title || "Content item";
  els.title.value = item.title || "";
  els.slug.value = item.slug || "";
  els.type.value = item.content_type || "resource";
  els.summary.value = item.summary || "";
  els.sourceKind.value = item.source_kind || "static_path";
  els.sourceRef.value = item.source_ref || "";
  els.sensitive.checked = Boolean(item.contains_sensitive_content);
  els.points.value = item.default_points ?? 0;
  els.createDraft.checked = false;
  els.attempts.value = 1;
  Array.from(els.rows.querySelectorAll("tr")).forEach((row) => {
    row.classList.toggle("selected", row.dataset.contentItemId === selectedContentItemId);
  });
}

function clearForm() {
  selectedContentItemId = "";
  slugWasEdited = false;
  els.selected.textContent = "New content item";
  els.title.value = "";
  els.slug.value = "";
  els.type.value = "lecture";
  els.summary.value = "";
  els.sourceKind.value = "static_path";
  els.sourceRef.value = "";
  els.sensitive.checked = false;
  els.points.value = 0;
  els.createDraft.checked = false;
  els.draftSection.value = "";
  renderDraftSessions();
  els.draftSession.value = "";
  els.attempts.value = 1;
  Array.from(els.rows.querySelectorAll("tr")).forEach((row) => {
    row.classList.remove("selected");
  });
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to manage the content library.", "danger");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  els.newItem.disabled = isBusy;
  els.save.disabled = isBusy;
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
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
