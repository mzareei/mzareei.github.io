# Shared UI primitives

Framework: vanilla HTML, CSS, and ES modules. There is no component library; reusable behavior is expressed through shared modules and CSS class contracts.

## `assets\course-materials\information-security\app\app-theme.js`

ThemeToggle: shared light/dark theme control injected on every app route.

```js
/* =============================================================================
   Shared light/dark theme controller for the TC2007B course app.
   - Applies the saved theme to <html data-theme> before first paint (no flash).
   - If the user never chose, the OS preference drives it (see app.css @media).
   - Injects one accessible toggle button, reused on every app page.
   Stored under an app-specific key so it never collides with the main site
   ("theme") or the lecture decks ("tc-theme").
============================================================================= */
(function () {
  var STORAGE_KEY = "tc2007b.app-theme";
  var root = document.documentElement;

  function stored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch (_e) {
      return null;
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function effectiveTheme() {
    var choice = stored();
    if (choice) return choice;
    return systemPrefersDark() ? "dark" : "light";
  }

  // Apply immediately (runs in <head>, before body paints).
  var initial = stored();
  if (initial) root.setAttribute("data-theme", initial);

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_e) {
      /* storage may be unavailable; theme still applies for this page */
    }
    syncButton();
  }

  var button = null;

  function syncButton() {
    if (!button) return;
    var isDark = effectiveTheme() === "dark";
    var next = isDark ? "light" : "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", "Switch to " + next + " theme");
    button.querySelector(".app-theme-toggle__icon").textContent = isDark ? "☀️" : "\u{1F319}";
    button.querySelector(".app-theme-toggle__label").textContent = isDark ? "Light" : "Dark";
  }

  function build() {
    button = document.createElement("button");
    button.type = "button";
    button.className = "app-theme-toggle";
    button.innerHTML =
      '<span class="app-theme-toggle__icon" aria-hidden="true"></span>' +
      '<span class="app-theme-toggle__label"></span>';
    button.addEventListener("click", function () {
      apply(effectiveTheme() === "dark" ? "light" : "dark");
    });
    document.body.appendChild(button);
    syncButton();
  }

  // Keep the icon honest when the OS flips and the user hasn't chosen.
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () { if (!stored()) syncButton(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
```

## `assets\course-materials\information-security\app\teacher-context.js`

TeacherContext: shared course, section, and session context resolver used by instructor tools.

```js
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
```
