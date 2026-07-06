import { loadAuditEvents } from "./audit-api.js";

const els = {
  refresh: document.getElementById("refreshAuditBtn"),
  status: document.getElementById("auditStatus"),
  count: document.getElementById("auditEventCount"),
  targetTypeFilter: document.getElementById("targetTypeFilter"),
  actionFilter: document.getElementById("actionFilter"),
  limit: document.getElementById("auditLimitInput"),
  auditRows: document.getElementById("auditRows")
};

els.refresh.addEventListener("click", refresh);
els.targetTypeFilter.addEventListener("change", refresh);
els.actionFilter.addEventListener("change", refresh);

refresh();

async function refresh() {
  await run("Loading audit events...", async () => {
    const filters = getFilters();
    const result = await loadAuditEvents(filters);
    renderFilters(result, filters);
    renderAuditRows(result.audit_events || []);
    setStatus(`Loaded ${(result.audit_events || []).length} audit event${(result.audit_events || []).length === 1 ? "" : "s"}.`, "good");
  });
}

function getFilters() {
  return {
    targetType: els.targetTypeFilter.value || "",
    auditAction: els.actionFilter.value || "",
    limit: els.limit.value || 100
  };
}

function renderFilters(result, filters) {
  renderSelect(els.targetTypeFilter, result.target_types || [], "All target types", filters.targetType);
  renderSelect(els.actionFilter, result.action_names || [], "All actions", filters.auditAction);
}

function renderSelect(select, values, allLabel, selectedValue) {
  const normalized = Array.from(new Set(values.filter(Boolean))).sort();
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  select.append(all);
  normalized.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelize(value);
    option.selected = value === selectedValue;
    select.append(option);
  });
}

function renderAuditRows(rows) {
  els.count.textContent = String(rows.length);
  els.auditRows.innerHTML = "";
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No audit events match these filters.";
    row.append(cell);
    els.auditRows.append(row);
    return;
  }

  rows.forEach((event) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDate(event.created_at))}</td>
      <td>${escapeHtml(event.actor_name || "System")}<br><small>${escapeHtml(event.actor_email || event.actor_profile_id || "")}</small></td>
      <td><strong>${escapeHtml(labelize(event.action))}</strong></td>
      <td>${escapeHtml(labelize(event.target_type))}<br><small>${escapeHtml(event.target_id || "")}</small></td>
      <td><small>${escapeHtml(formatMetadata(event.metadata))}</small></td>
    `;
    els.auditRows.append(row);
  });
}

async function run(message, action) {
  els.refresh.disabled = true;
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to load audit events.", "danger");
  } finally {
    els.refresh.disabled = false;
  }
}

function setStatus(message, tone) {
  els.status.textContent = message;
  els.status.dataset.tone = tone || "";
}

function formatMetadata(metadata) {
  const text = JSON.stringify(metadata || {});
  return text.length > 260 ? `${text.slice(0, 260)}...` : text;
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
