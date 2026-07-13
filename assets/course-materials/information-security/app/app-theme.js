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
