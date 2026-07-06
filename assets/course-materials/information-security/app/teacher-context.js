export function teacherContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    courseId: clean(params.get("course")),
    sectionId: clean(params.get("section")),
    sessionId: clean(params.get("session"))
  };
}

export function contextQuery(context) {
  const params = new URLSearchParams();
  if (context.courseId) params.set("course", context.courseId);
  if (context.sectionId) params.set("section", context.sectionId);
  if (context.sessionId) params.set("session", context.sessionId);
  return params.toString();
}

export function contextFilters(context) {
  return {
    sectionId: context.sectionId || "",
    sessionId: context.sessionId || ""
  };
}

export function matchesTeacherContext(row, context) {
  const sectionMatches = !context.sectionId || !row.section_id || String(row.section_id || "") === context.sectionId;
  const sessionMatches = !context.sessionId || String(row.session_id || row.class_session_id || "") === context.sessionId;
  return sectionMatches && sessionMatches;
}

export function contextLabel(context) {
  const parts = [];
  if (context.sectionId) parts.push("selected section");
  if (context.sessionId) parts.push("selected session");
  return parts.length ? `Filtered to ${parts.join(" and ")}.` : "Showing all available teacher context.";
}

function clean(value) {
  return String(value || "").trim();
}
