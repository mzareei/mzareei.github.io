# Shared layouts

The app uses repeated static HTML rather than a templating/component layer. `index.html` is the canonical signed-out/signed-in dashboard shell; management routes repeat the `mission-shell`, `mission-top`, `mission-card`, and `status-line` contracts from it.

## `assets\course-materials\information-security\app\index.html`

Canonical Course App shell with authentication, learner context, released materials, teaching context, and teacher actions.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>TC2007B · Course App</title>
<meta name="description" content="Authenticated TC2007B course app for released materials, activities, and student progress.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="app.css">
<script src="app-theme.js"></script>
</head>
<body>
<main class="mission-shell app-shell">
  <header class="mission-top">
    <a href="/teaching/information-security/" class="back-link">Course</a>
    <div>
      <span class="eyebrow">TC2007B · Authenticated course app</span>
      <h1>Course App</h1>
      <p class="lead">Sign in with your institutional email to see released materials, live activities, and your course context.</p>
    </div>
  </header>

  <section class="mission-card app-panel auth-panel" id="signedOutPanel">
    <span class="eyebrow">Institutional access</span>
    <h2>Sign in</h2>
    <p class="lead auth-intro">We use passwordless sign-in. Enter your approved institutional email and we will send a secure link.</p>

    <ol class="auth-steps">
      <li class="auth-step">
        <span class="auth-step__num" aria-hidden="true">1</span>
        <div class="auth-step__body">
          <div class="field-stack">
            <label>
              Institutional email
              <input id="emailInput" type="email" autocomplete="email" placeholder="name@tec.mx">
            </label>
            <button class="app-button" id="sendCodeBtn" type="button">Send sign-in email</button>
          </div>
        </div>
      </li>
      <li class="auth-step">
        <span class="auth-step__num" aria-hidden="true">2</span>
        <div class="auth-step__body">
          <p class="auth-hint">Open the link in your inbox on this device. If your email shows a six digit code instead, enter it here.</p>
          <div class="field-stack">
            <label>
              Optional one-time code
              <input id="otpInput" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="6 digit code, if shown">
            </label>
            <button class="app-button secondary" id="verifyCodeBtn" type="button">Verify code</button>
          </div>
        </div>
      </li>
    </ol>
  </section>

  <section class="mission-card app-panel" id="signedInPanel" hidden>
    <div class="signed-in-bar">
      <div>
        <span class="eyebrow">Signed in</span>
        <h2>Your course</h2>
      </div>
      <div class="button-row">
        <button class="app-button secondary" id="refreshContextBtn" type="button">Refresh</button>
        <button class="app-button secondary" id="signOutBtn" type="button">Sign out</button>
      </div>
    </div>

    <div class="dashboard-grid">
      <article class="context-card">
        <span class="eyebrow">Identity</span>
        <h2>Profile</h2>
        <div class="identity-summary" id="identitySummary"></div>
      </article>
      <article class="context-card">
        <span class="eyebrow">Course</span>
        <h2>Roles</h2>
        <ul class="context-list" id="roleList"></ul>
      </article>
      <article class="context-card">
        <span class="eyebrow">Section</span>
        <h2>Enrollment</h2>
        <ul class="context-list" id="sectionList"></ul>
      </article>
      <article class="context-card highlight-card">
        <span class="eyebrow">Released</span>
        <h2>Materials</h2>
        <ul class="context-list" id="releasedItems"></ul>
      </article>
      <article class="context-card">
        <span class="eyebrow">Student</span>
        <h2>Actions</h2>
        <ul class="context-list" id="studentActions"></ul>
      </article>
    </div>

    <div class="console-zone">
      <span class="eyebrow">Teaching console</span>
      <div class="dashboard-grid">
        <article class="context-card teacher-context-panel" id="teacherContextPanel" hidden>
          <span class="eyebrow">Teacher</span>
          <h2>Teaching context</h2>
          <div class="teacher-context-grid">
            <label>
              Course
              <select id="courseContextSelect"></select>
            </label>
            <label>
              Section
              <select id="sectionContextSelect"></select>
            </label>
            <label>
              Session
              <select id="sessionContextSelect"></select>
            </label>
          </div>
          <ul class="context-list teacher-context-links" id="teacherContextLinks"></ul>
        </article>
        <article class="context-card">
          <span class="eyebrow">Teacher</span>
          <h2>Actions</h2>
          <ul class="context-list" id="teacherActions"></ul>
        </article>
      </div>
    </div>
  </section>

  <p class="status-line" id="appStatus" aria-live="polite"></p>
</main>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../platform-config.js"></script>
<script type="module" src="app.js"></script>
</body>
</html>
```

## `assets\course-materials\information-security\app\app-theme.js`

Global theme-toggle layout element injected into document.body.

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
