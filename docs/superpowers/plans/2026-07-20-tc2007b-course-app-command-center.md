# TC2007B Course App Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the signed-in TC2007B home page's metadata-first card grid with the approved role-aware Instructor Command Center while preserving the current signed-out flow, protected data boundary, routes, and Supabase contracts.

**Architecture:** Keep the existing static HTML, shared CSS, and ES-module JavaScript architecture. Restructure only the signed-in branch in `index.html`, add explicit instructor/student presentation state in `app.js`, and render navigation, account context, the selected session, released items, and contextual actions from the existing authenticated response. Add a focused marker-based verifier alongside the existing app-shell and teacher-context verifiers; do not add dependencies or change backend response schemas.

**Tech Stack:** Static HTML5, vanilla CSS, browser ES modules, Supabase JS v2, Node.js repository verifiers.

## Global Constraints

- The public GitHub Pages course site remains the public front door; authenticated Supabase APIs remain the security boundary.
- Do not change authentication, authorization, roster gating, release rules, grading behavior, Edge Functions, database migrations, or API response schemas.
- Retain Inter and JetBrains Mono and the existing `app.css` light/dark token contract.
- Use only the existing blue, teal, neutral, and semantic status tokens; add no framework, component library, icon dependency, decorative gradient, glass effect, or unrelated color.
- Preserve all IDs used by the current scripts and verifiers, including `signedInPanel`, `identitySummary`, `roleList`, `sectionList`, `releasedItems`, `studentActions`, `teacherActions`, `teacherContextPanel`, `courseContextSelect`, `sectionContextSelect`, `sessionContextSelect`, and `teacherContextLinks`.
- Preserve the signed-out passwordless email/OTP flow without visual or behavioral regression.
- Instructor-only UI must render only for `platform_owner`, `instructor`, or `teaching_assistant`; `Review Audit Log` remains limited to `platform_owner` and `instructor`.
- Do not invent attendance percentages, response rates, class-health scores, scheduled-item counts, affiliations, version numbers, or other fields absent from the authenticated response.
- Controls remain at least 44px high; state is communicated with text in addition to color; focus rings and `prefers-reduced-motion` remain functional.
- This plan implements the signed-in home only. Applying the shell to other management routes is explicitly out of scope.

## File Structure

- Create `tools/verify-auth-command-center.js`: focused regression contract for the new role-aware shell, selected-session rendering, accessible disclosures, responsive markers, and documentation entry.
- Modify `tools/verify-auth-app-shell.js`: retain the existing auth-shell checks and add only the new top-level signed-in structure markers.
- Modify `assets/course-materials/information-security/app/index.html`: replace the signed-in dashboard markup while preserving the signed-out panel and script-critical IDs.
- Modify `assets/course-materials/information-security/app/app.js`: derive role capabilities, render the instructor navigation and selected-session workspace, retain student-only composition, and control account/mobile disclosures.
- Modify `assets/course-materials/information-security/app/app.css`: add the command-center layout, navigation, workspace, responsive states, disclosures, and reuse the current tokens.
- Modify `supabase/README.md`: add the focused verifier to the local verification checklist.
- Modify `docs/course-platform/implementation/current-implementation-status.md`: record the role-aware Command Center and its verifier.

---

### Task 1: Add the Role-Aware Signed-In Structure

**Files:**
- Modify: `tools/verify-auth-app-shell.js:24-40`
- Modify: `assets/course-materials/information-security/app/index.html:60-129`
- Modify: `assets/course-materials/information-security/app/app.js:3-24`
- Modify: `assets/course-materials/information-security/app/app.js:141-153`
- Modify: `assets/course-materials/information-security/app/app.js:189-219`

**Interfaces:**
- Consumes: the existing `context.memberships`, `context.sections`, `renderReleasedItems`, `renderStudentActions`, `renderTeacherContextSwitchers`, and `renderTeacherActions` behavior.
- Produces: DOM containers `studentDashboard`, `teacherDashboard`, `teacherNavigation`, `accountPanel`, and `currentSessionPanel`; `roleCapabilities(context) -> { hasStudentRole: boolean, canTeach: boolean, canAudit: boolean }` for later tasks.

- [ ] **Step 1: Extend the existing app-shell verifier with the new structural contract**

Add these markers to `requiredMarkup` in `tools/verify-auth-app-shell.js` immediately after `id="signedInPanel"`:

```js
    'id="studentDashboard"',
    'id="teacherDashboard"',
    'id="teacherNavigation"',
    'id="accountPanel"',
    'id="currentSessionPanel"',
    'aria-label="Instructor navigation"',
```

- [ ] **Step 2: Run the verifier to confirm RED**

Run:

```powershell
node tools\verify-auth-app-shell.js
```

Expected: FAIL with at least `App shell markup missing: id="teacherDashboard"`.

- [ ] **Step 3: Replace only the signed-in panel with the command-center structure**

Keep `signedOutPanel`, `appStatus`, external scripts, and all existing form IDs unchanged. Replace the current `signedInPanel` section with this markup:

```html
  <section class="signed-in-shell" id="signedInPanel" hidden>
    <header class="app-command-header">
      <button class="app-button secondary nav-toggle" id="teacherNavToggle" type="button"
        aria-controls="teacherNavigation" aria-expanded="false" hidden>
        Menu
      </button>
      <div class="app-command-brand">
        <span class="eyebrow">TC2007B · Authenticated course app</span>
        <h2>Course App</h2>
      </div>
      <div class="account-control">
        <button class="app-button secondary account-trigger" id="accountMenuButton" type="button"
          aria-controls="accountPanel" aria-expanded="false">
          Account
        </button>
        <div class="account-panel" id="accountPanel" hidden>
          <div class="identity-summary" id="identitySummary"></div>
          <div class="account-context-grid">
            <div>
              <span class="eyebrow">Roles</span>
              <ul class="context-list compact-list" id="roleList"></ul>
            </div>
            <div>
              <span class="eyebrow">Enrollment</span>
              <ul class="context-list compact-list" id="sectionList"></ul>
            </div>
          </div>
          <div class="button-row account-actions">
            <button class="app-button secondary" id="refreshContextBtn" type="button">Refresh</button>
            <button class="app-button secondary" id="signOutBtn" type="button">Sign out</button>
          </div>
        </div>
      </div>
    </header>

    <div class="student-dashboard" id="studentDashboard" hidden>
      <section class="mission-card app-panel">
        <span class="eyebrow">Your course</span>
        <h2>Released materials</h2>
        <ul class="context-list released-list" id="releasedItems"></ul>
      </section>
      <section class="mission-card app-panel">
        <span class="eyebrow">Student</span>
        <h2>Actions</h2>
        <ul class="context-list" id="studentActions"></ul>
      </section>
    </div>

    <div class="teacher-dashboard" id="teacherDashboard" hidden>
      <aside class="teacher-navigation" id="teacherNavigation" aria-label="Instructor navigation">
        <a class="teacher-nav-home" href="index.html" aria-current="page">Overview</a>
        <ul class="teacher-nav-list" id="teacherActions"></ul>
      </aside>

      <div class="teacher-workspace">
        <section class="teacher-context-panel" id="teacherContextPanel" hidden>
          <div class="section-head compact-head">
            <div>
              <span class="eyebrow">Teaching context</span>
              <h2>Current class</h2>
            </div>
          </div>
          <div class="teacher-context-grid">
            <label>Course<select id="courseContextSelect"></select></label>
            <label>Section<select id="sectionContextSelect"></select></label>
            <label>Session<select id="sessionContextSelect"></select></label>
          </div>
        </section>

        <section class="current-session-panel" id="currentSessionPanel" aria-labelledby="currentSessionTitle">
          <div class="current-session-copy">
            <span class="eyebrow">Current session</span>
            <div class="session-title-row">
              <h2 id="currentSessionTitle">Choose a class session</h2>
              <span class="session-status" id="currentSessionStatus">Unavailable</span>
            </div>
            <p class="lead" id="currentSessionMeta">Select a section and session to focus instructor tools.</p>
          </div>
          <ul class="context-list teacher-context-links" id="teacherContextLinks"></ul>
        </section>

        <div class="teacher-support-grid">
          <section class="mission-card app-panel released-panel">
            <div class="section-head compact-head">
              <div>
                <span class="eyebrow">Released</span>
                <h2>Materials</h2>
              </div>
              <a href="releases.html">Manage releases</a>
            </div>
            <ul class="context-list released-list" id="teacherReleasedItems"></ul>
          </section>
          <section class="mission-card app-panel review-panel">
            <span class="eyebrow">Review</span>
            <h2>Selected context</h2>
            <ul class="context-list" id="teacherReviewLinks"></ul>
          </section>
        </div>
      </div>
    </div>
  </section>
```

The student and teacher released-material containers must be separate because IDs must remain unique. Keep the existing `releasedItems` ID on the student branch; `teacherReleasedItems` is the new instructor target.

- [ ] **Step 4: Add the new DOM references and minimal role gating**

Add these properties to `els` in `app.js`:

```js
  studentDashboard: document.getElementById("studentDashboard"),
  teacherDashboard: document.getElementById("teacherDashboard"),
  teacherNavigation: document.getElementById("teacherNavigation"),
  accountPanel: document.getElementById("accountPanel"),
  currentSessionPanel: document.getElementById("currentSessionPanel"),
  teacherReleasedItems: document.getElementById("teacherReleasedItems"),
  teacherReviewLinks: document.getElementById("teacherReviewLinks"),
```

Add this helper before `renderContext`:

```js
function roleCapabilities(context) {
  const memberships = context.memberships || [];
  return {
    hasStudentRole: (context.sections || []).some((section) => section.role === "student"),
    canTeach: memberships.some((membership) => {
      return ["platform_owner", "instructor", "teaching_assistant"].includes(membership.role);
    }),
    canAudit: memberships.some((membership) => {
      return ["platform_owner", "instructor"].includes(membership.role);
    })
  };
}
```

In `renderSignedOut`, add:

```js
  els.studentDashboard.hidden = true;
  els.teacherDashboard.hidden = true;
  els.teacherReleasedItems.innerHTML = "";
  els.teacherReviewLinks.innerHTML = "";
```

In `renderContext`, replace the inline `canTeach` calculation with:

```js
  const capabilities = roleCapabilities(context);
  els.teacherDashboard.hidden = !capabilities.canTeach;
  els.studentDashboard.hidden = capabilities.canTeach || !capabilities.hasStudentRole;
  renderTeacherContextSwitchers(context, capabilities.canTeach);
  renderTeacherActions(context, capabilities.canTeach);
```

This deliberately gives the instructor composition priority when an account has both instructor and student associations; pure students retain the student dashboard and never receive instructor controls.

- [ ] **Step 5: Run focused structural regressions**

Run:

```powershell
node tools\verify-auth-app-shell.js
node tools\verify-auth-teacher-context-switchers.js
node --check assets\course-materials\information-security\app\app.js
```

Expected: all three commands exit 0; the first two print their `verification passed` messages and `node --check` prints nothing.

- [ ] **Step 6: Commit the structural slice**

```powershell
git add tools/verify-auth-app-shell.js assets/course-materials/information-security/app/index.html assets/course-materials/information-security/app/app.js
git commit -m "feat: add role-aware course dashboard structure"
```

---

### Task 2: Render Grouped Instructor Navigation

**Files:**
- Create: `tools/verify-auth-command-center.js`
- Modify: `assets/course-materials/information-security/app/app.js:282-326`

**Interfaces:**
- Consumes: `roleCapabilities(context)`, `selectedTeacherContext()`, and `withTeacherContext(href, context)`.
- Produces: `teacherNavigationGroups(canAudit) -> Array<{ label: string, items: Array<{ label: string, href: string, contextual: boolean }> }>` and `renderTeacherNavigation(canTeach, canAudit)`.

- [ ] **Step 1: Create the focused verifier**

Create `tools/verify-auth-command-center.js` with this complete content:

```js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function requireMarkers(relativePath, label, markers) {
  const source = read(relativePath);
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${label} missing: ${marker}`);
  }
}

requireMarkers("assets/course-materials/information-security/app/index.html", "Command Center markup", [
  'id="studentDashboard"',
  'id="teacherDashboard"',
  'id="teacherNavigation"',
  'id="currentSessionPanel"',
  'id="teacherReleasedItems"',
  'id="teacherReviewLinks"'
]);

requireMarkers("assets/course-materials/information-security/app/app.js", "Command Center script", [
  "roleCapabilities",
  "teacherNavigationGroups",
  "renderTeacherNavigation",
  'label: "Teach"',
  'label: "Review"',
  'label: "Manage"',
  'label: "Review Audit Log"',
  "capabilities.canAudit"
]);

if (failures.length) {
  console.error("Authenticated Command Center verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Authenticated Command Center verification passed.");
console.log("- role-aware shell and instructor navigation checked");
```

- [ ] **Step 2: Run the new verifier to confirm RED**

Run:

```powershell
node tools\verify-auth-command-center.js
```

Expected: FAIL with `Command Center script missing: teacherNavigationGroups`.

- [ ] **Step 3: Replace the old inline-styled teacher action renderer**

Replace `renderTeacherActions` with these functions:

```js
function teacherNavigationGroups(canAudit) {
  const groups = [
    {
      label: "Teach",
      items: [
        { label: "Class Sessions", href: "sessions.html", contextual: true },
        { label: "Release Controls", href: "releases.html", contextual: true },
        { label: "Participation", href: "participation.html", contextual: false }
      ]
    },
    {
      label: "Review",
      items: [
        { label: "Gradebook", href: "gradebook.html", contextual: true },
        { label: "Student Records", href: "student-records.html", contextual: false },
        { label: "Learning Insights", href: "insights.html", contextual: true }
      ]
    },
    {
      label: "Manage",
      items: [
        { label: "Course Sections", href: "sections.html", contextual: false },
        { label: "Course Roster", href: "roster.html", contextual: false },
        { label: "Content Library", href: "content-library.html", contextual: false }
      ]
    }
  ];
  if (canAudit) {
    groups[1].items.push({ label: "Review Audit Log", href: "audit.html", contextual: false });
  }
  return groups;
}

function renderTeacherNavigation(canTeach, canAudit) {
  els.teacherActions.innerHTML = "";
  if (!canTeach) return;
  const context = selectedTeacherContext();
  teacherNavigationGroups(canAudit).forEach((group) => {
    const groupItem = document.createElement("li");
    groupItem.className = "teacher-nav-group";
    const heading = document.createElement("span");
    heading.className = "teacher-nav-label";
    heading.textContent = group.label;
    const list = document.createElement("ul");
    list.className = "teacher-nav-links";
    group.items.forEach((action) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = action.contextual ? withTeacherContext(action.href, context) : action.href;
      link.textContent = action.label;
      item.append(link);
      list.append(item);
    });
    groupItem.append(heading, list);
    els.teacherActions.append(groupItem);
  });
}
```

In `renderContext`, call:

```js
  renderTeacherNavigation(capabilities.canTeach, capabilities.canAudit);
```

Remove the old `renderTeacherActions(context, canTeach)` call. In `updateTeacherContextFromControls`, call `renderTeacherNavigation(true, roleCapabilities(currentContext || {}).canAudit)` after saving the new selection so contextual navigation links stay synchronized.

- [ ] **Step 4: Run the navigation verifier and existing role checks**

Run:

```powershell
node tools\verify-auth-command-center.js
node tools\verify-auth-role-permissions.js
node tools\verify-auth-teacher-context-switchers.js
```

Expected: all three print `verification passed` and exit 0.

- [ ] **Step 5: Commit grouped navigation**

```powershell
git add tools/verify-auth-command-center.js assets/course-materials/information-security/app/app.js
git commit -m "feat: group instructor command center navigation"
```

---

### Task 3: Render the Selected Session and Supported Contextual Actions

**Files:**
- Modify: `tools/verify-auth-command-center.js`
- Modify: `assets/course-materials/information-security/app/app.js:328-396`
- Modify: `assets/course-materials/information-security/app/app.css:before Responsive section`

**Interfaces:**
- Consumes: `currentContext.teacher_sessions`, `selectedTeacherContext()`, `withTeacherContext`, `labelize`, and the existing `renderReleasedItems` behavior.
- Produces: `selectedTeacherSession(context) -> object | null`, `renderCurrentSession(context)`, and `renderTeacherSupport(context)`.

- [ ] **Step 1: Extend the verifier for real selected-session rendering**

Append these markers to the Command Center script marker list:

```js
  "selectedTeacherSession",
  "renderCurrentSession",
  "renderTeacherSupport",
  "currentSessionTitle",
  "currentSessionStatus",
  "currentSessionMeta",
  'label: "Manage selected session"',
  'label: "Prepare selected releases"',
  'label: "View section insights"',
  'label: "Review section gradebook"'
```

Add these forbidden markers after the existing `requireMarkers` calls:

```js
const appSource = read("assets/course-materials/information-security/app/app.js");
for (const forbidden of ["attendanceRate", "responseRate", "classHealthScore", "scheduledItemCount"]) {
  if (appSource.includes(forbidden)) failures.push(`Command Center must not invent metric: ${forbidden}`);
}
```

- [ ] **Step 2: Run the verifier to confirm RED**

Run:

```powershell
node tools\verify-auth-command-center.js
```

Expected: FAIL with `Command Center script missing: selectedTeacherSession`.

- [ ] **Step 3: Add selected-session DOM references**

Add to `els`:

```js
  currentSessionTitle: document.getElementById("currentSessionTitle"),
  currentSessionStatus: document.getElementById("currentSessionStatus"),
  currentSessionMeta: document.getElementById("currentSessionMeta"),
```

- [ ] **Step 4: Add session and support renderers**

Add these functions after `selectedTeacherContext`:

```js
function selectedTeacherSession(context) {
  const selection = selectedTeacherContext();
  return (context.teacher_sessions || []).find((session) => {
    return session.session_id === selection.sessionId;
  }) || null;
}

function renderCurrentSession(context) {
  const session = selectedTeacherSession(context);
  if (!session) {
    els.currentSessionTitle.textContent = "Choose a class session";
    els.currentSessionStatus.textContent = "Unavailable";
    els.currentSessionStatus.dataset.tone = "";
    els.currentSessionMeta.textContent = "Select a section and session to focus instructor tools.";
    renderActionList(els.teacherContextLinks, [], "Choose a section and session to focus teacher tools.");
    return;
  }
  const section = [session.section_code, session.section_name].filter(Boolean).join(" · ");
  els.currentSessionTitle.textContent = session.title || "Class session";
  els.currentSessionStatus.textContent = labelize(session.state || "scheduled");
  els.currentSessionStatus.dataset.tone = session.state === "live"
    ? "good"
    : session.state === "paused"
      ? "warn"
      : "";
  els.currentSessionMeta.textContent = [session.planned_date, section].filter(Boolean).join(" · ");
  renderTeacherContextLinks();
}

function renderTeacherSupport(context) {
  renderReleasedItemsInto(els.teacherReleasedItems, context.releases || []);
  const selection = selectedTeacherContext();
  renderActionList(els.teacherReviewLinks, [
    { label: "View section insights", href: withTeacherContext("insights.html", selection) },
    { label: "Review section gradebook", href: withTeacherContext("gradebook.html", selection) }
  ], "Choose a section to focus review tools.");
}
```

Refactor `renderReleasedItems(rows)` so its body delegates to a reusable target-specific function without changing labels or protected URLs:

```js
function renderReleasedItems(rows) {
  renderReleasedItemsInto(els.releasedItems, rows);
}

function renderReleasedItemsInto(target, rows) {
  target.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No released items for your section yet.";
    target.append(empty);
    return;
  }
  rows.forEach((item) => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    if (item.content_type === "activity" && item.activity_instance_id) {
      link.href = `activity.html?activity=${encodeURIComponent(item.activity_instance_id)}`;
    } else {
      link.href = `content.html?release=${encodeURIComponent(item.release_id || "")}`;
    }
    link.textContent = releasedItemLabel(item);
    listItem.append(link);
    target.append(listItem);
  });
}
```

At the end of the teacher branch in `renderContext`, call:

```js
  if (capabilities.canTeach) {
    renderCurrentSession(context);
    renderTeacherSupport(context);
  }
```

At the end of `updateTeacherContextFromControls`, call:

```js
  renderCurrentSession(currentContext || {});
  renderTeacherSupport(currentContext || {});
```

- [ ] **Step 5: Keep the contextual action contract exact**

Retain `renderTeacherContextLinks` with exactly these four supported actions:

```js
function renderTeacherContextLinks() {
  const context = selectedTeacherContext();
  const links = [
    { label: "Manage selected session", href: withTeacherContext("sessions.html", context) },
    { label: "Prepare selected releases", href: withTeacherContext("releases.html", context) },
    { label: "View section insights", href: withTeacherContext("insights.html", context) },
    { label: "Review section gradebook", href: withTeacherContext("gradebook.html", context) }
  ];
  renderActionList(els.teacherContextLinks, links, "Choose a section and session to focus teacher tools.");
}
```

- [ ] **Step 6: Run selected-session and content-access regressions**

Before running the regressions, extend `setBusy` with an explicit non-destructive Loading state:

```js
  els.signedInPanel.setAttribute("aria-busy", String(isBusy && !els.signedInPanel.hidden));
  [els.courseContextSelect, els.sectionContextSelect, els.sessionContextSelect].forEach((control) => {
    control.disabled = isBusy || control.options.length === 0;
  });
```

Do not clear `currentContext`, current-session text, released items, or contextual links when a refresh begins. The existing `run` catch path must continue to report an error through `appStatus` while leaving previously rendered authenticated content readable.

Add this rule to the command-center CSS block:

```css
.signed-in-shell[aria-busy="true"] .teacher-workspace { cursor: progress; }
```

For the Empty state, keep the exact no-session and no-release messages from `renderCurrentSession` and `renderReleasedItemsInto`; do not render blank containers.

Run:

```powershell
node tools\verify-auth-command-center.js
node tools\verify-auth-teacher-context-switchers.js
node tools\verify-auth-teacher-context-tools.js
node tools\verify-auth-content-access.js
node --check assets\course-materials\information-security\app\app.js
```

Expected: all verifiers print `verification passed`; syntax check exits 0 without output.

- [ ] **Step 7: Commit the selected-session workspace**

```powershell
git add tools/verify-auth-command-center.js assets/course-materials/information-security/app/app.js assets/course-materials/information-security/app/app.css
git commit -m "feat: render selected teaching session workspace"
```

---

### Task 4: Add the Command Center Visual Layout

**Files:**
- Modify: `tools/verify-auth-command-center.js`
- Modify: `assets/course-materials/information-security/app/app.css:752-852`

**Interfaces:**
- Consumes: the Task 1 DOM class names and the existing color, radius, shadow, typography, focus, status, and motion tokens.
- Produces: desktop command-center shell, grouped navigation, context bar, current-session workspace, compact support cards, and account panel styling.

- [ ] **Step 1: Extend the verifier with required CSS contracts**

Add a CSS `requireMarkers` call:

```js
requireMarkers("assets/course-materials/information-security/app/app.css", "Command Center styles", [
  ".signed-in-shell",
  ".app-command-header",
  ".teacher-dashboard",
  ".teacher-navigation",
  ".teacher-workspace",
  ".current-session-panel",
  ".teacher-support-grid",
  ".account-panel"
]);
```

- [ ] **Step 2: Run the verifier to confirm RED**

Run:

```powershell
node tools\verify-auth-command-center.js
```

Expected: FAIL with `Command Center styles missing: .signed-in-shell`.

- [ ] **Step 3: Add desktop layout styles using existing tokens**

Insert this block before the existing Responsive section in `app.css`:

```css
/* ---------------------------------------------------- Instructor command center */
.signed-in-shell {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  box-shadow: var(--shadow);
  overflow: clip;
}

.app-command-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 68px;
  padding: 0.75rem 1.15rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-1);
}
.app-command-brand h2 { margin: 0; }
.app-command-brand .eyebrow { margin-bottom: 0.15rem; }
.nav-toggle[hidden] { display: none; }

.account-control { position: relative; }
.account-panel {
  position: absolute;
  top: calc(100% + 0.6rem);
  right: 0;
  z-index: 40;
  width: min(420px, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-1);
  box-shadow: var(--shadow-lg);
}
.account-context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 0.9rem;
}
.account-actions { margin-top: 0.9rem; }
.compact-list li { padding: 0.55rem 0.65rem; font-size: 0.82rem; }

.teacher-dashboard {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 680px;
}
.teacher-dashboard[hidden],
.student-dashboard[hidden] { display: none; }

.teacher-navigation {
  padding: 1.15rem 0.9rem;
  border-right: 1px solid var(--border);
  background: var(--surface-2);
}
.teacher-nav-home,
.teacher-nav-links a {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}
.teacher-nav-home[aria-current="page"] {
  background: var(--primary-soft);
  color: var(--primary);
  box-shadow: inset 3px 0 0 var(--primary);
}
.teacher-nav-links a:hover {
  background: var(--surface-1);
  color: var(--primary);
  text-decoration: none;
}
.teacher-nav-list,
.teacher-nav-links { margin: 0; padding: 0; list-style: none; }
.teacher-nav-group { margin-top: 1rem; }
.teacher-nav-label {
  display: block;
  padding: 0 0.75rem 0.35rem;
  color: var(--text-subtle);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.teacher-workspace {
  display: grid;
  align-content: start;
  gap: 1.15rem;
  min-width: 0;
  padding: clamp(1rem, 2.4vw, 1.6rem);
  background: var(--surface);
}
.teacher-context-panel,
.current-session-panel {
  padding: 1.15rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
}
.teacher-context-panel { border-color: var(--primary-soft-border); background: var(--primary-soft); }
.compact-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.compact-head h2 { margin: 0; }

.current-session-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 0.55fr);
  gap: 1.25rem;
  box-shadow: var(--shadow);
}
.session-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.session-title-row h2 { margin: 0; }
.session-status {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.session-status[data-tone="good"] { border-color: var(--good); background: var(--good-soft); color: var(--good); }
.session-status[data-tone="warn"] { border-color: var(--warn); background: var(--warn-soft); color: var(--warn); }
.current-session-copy .lead { margin: 0.55rem 0 0; }
.teacher-context-links { align-content: start; }

.teacher-support-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.7fr);
  gap: 1.15rem;
}
.teacher-support-grid .app-panel { margin-top: 0; box-shadow: none; }
.released-list a { line-height: 1.45; }

.student-dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.6fr);
  gap: 1rem;
  padding: 1.15rem;
  background: var(--surface);
}
.student-dashboard .app-panel { margin-top: 0; }
```

- [ ] **Step 4: Run style and legacy-theme verification**

Run:

```powershell
node tools\verify-auth-command-center.js
node tools\verify-auth-app-shell.js
node tools\verify-course-platform.js
```

Expected: all three print `passed` and exit 0.

- [ ] **Step 5: Commit the desktop visual system**

```powershell
git add tools/verify-auth-command-center.js assets/course-materials/information-security/app/app.css
git commit -m "feat: style instructor command center workspace"
```

---

### Task 5: Add Accessible Account and Mobile Navigation Disclosures

**Files:**
- Modify: `tools/verify-auth-command-center.js`
- Modify: `assets/course-materials/information-security/app/app.js:31-86`
- Modify: `assets/course-materials/information-security/app/app.css:after command-center block`

**Interfaces:**
- Consumes: `accountMenuButton`, `accountPanel`, `teacherNavToggle`, and `teacherNavigation` from Task 1.
- Produces: `setDisclosure(trigger, panel, expanded)`, `closeCommandDisclosures()`, Escape handling, outside-click closing, and responsive navigation states.

- [ ] **Step 1: Extend the focused verifier for accessibility and responsive behavior**

Add these markup markers:

```js
  'id="teacherNavToggle"',
  'aria-controls="teacherNavigation"',
  'id="accountMenuButton"',
  'aria-controls="accountPanel"'
```

Add these script markers:

```js
  "setDisclosure",
  "closeCommandDisclosures",
  'event.key === "Escape"',
  'setAttribute("aria-expanded"',
  'classList.toggle("is-open"'
```

Add a CSS marker check for the responsive contracts:

```js
requireMarkers("assets/course-materials/information-security/app/app.css", "Command Center responsive styles", [
  "@media (max-width: 900px)",
  "@media (max-width: 760px)",
  ".teacher-navigation.is-open"
]);
```

- [ ] **Step 2: Run the verifier to confirm RED**

Run:

```powershell
node tools\verify-auth-command-center.js
```

Expected: FAIL with `Command Center script missing: setDisclosure`.

- [ ] **Step 3: Add disclosure references and interaction helpers**

Add to `els`:

```js
  teacherNavToggle: document.getElementById("teacherNavToggle"),
  accountMenuButton: document.getElementById("accountMenuButton"),
```

Add these helpers before `init()`:

```js
function setDisclosure(trigger, panel, expanded) {
  trigger.setAttribute("aria-expanded", String(expanded));
  if (panel === els.teacherNavigation) {
    panel.classList.toggle("is-open", expanded);
  } else {
    panel.hidden = !expanded;
  }
}

function closeCommandDisclosures() {
  setDisclosure(els.accountMenuButton, els.accountPanel, false);
  setDisclosure(els.teacherNavToggle, els.teacherNavigation, false);
}

els.accountMenuButton.addEventListener("click", () => {
  const expanded = els.accountMenuButton.getAttribute("aria-expanded") === "true";
  setDisclosure(els.accountMenuButton, els.accountPanel, !expanded);
});

els.teacherNavToggle.addEventListener("click", () => {
  const expanded = els.teacherNavToggle.getAttribute("aria-expanded") === "true";
  setDisclosure(els.teacherNavToggle, els.teacherNavigation, !expanded);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const accountWasOpen = els.accountMenuButton.getAttribute("aria-expanded") === "true";
    const navigationWasOpen = els.teacherNavToggle.getAttribute("aria-expanded") === "true";
    closeCommandDisclosures();
    if (navigationWasOpen) els.teacherNavToggle.focus();
    else if (accountWasOpen) els.accountMenuButton.focus();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest(".account-control")) {
    setDisclosure(els.accountMenuButton, els.accountPanel, false);
  }
});
```

At the start of `renderSignedOut` and `renderContext`, call `closeCommandDisclosures()` so role/session changes cannot leave stale overlays open.

- [ ] **Step 4: Add tablet and mobile styles**

Insert after the desktop command-center block:

```css
@media (max-width: 900px) {
  .nav-toggle:not([hidden]) { display: inline-flex; }
  .teacher-dashboard { grid-template-columns: 1fr; }
  .teacher-navigation {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    width: min(300px, 88vw);
    padding-top: 5rem;
    border-right: 1px solid var(--border-strong);
    box-shadow: var(--shadow-lg);
    transform: translateX(-105%);
    transition: transform var(--ease);
  }
  .teacher-navigation.is-open { transform: translateX(0); }
  .current-session-panel,
  .teacher-support-grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .app-command-header { align-items: flex-start; flex-wrap: wrap; }
  .app-command-brand { flex: 1 1 180px; }
  .teacher-workspace,
  .student-dashboard { padding: 0.85rem; }
  .student-dashboard,
  .account-context-grid { grid-template-columns: 1fr; }
  .teacher-context-grid { grid-template-columns: 1fr; }
  .current-session-panel { padding: 1rem; }
  .current-session-panel .context-list a,
  .account-actions .app-button { width: 100%; }
  .account-panel { position: fixed; top: 76px; right: 1rem; left: 1rem; width: auto; }
}
```

Inside the existing `@media (prefers-reduced-motion: reduce)` block, the global transition reset already covers the drawer; do not add separate motion logic.

- [ ] **Step 5: Show the mobile navigation trigger only for instructors**

In `renderContext`, immediately after setting dashboard visibility, add:

```js
  els.teacherNavToggle.hidden = !capabilities.canTeach;
```

In `renderSignedOut`, add:

```js
  els.teacherNavToggle.hidden = true;
```

- [ ] **Step 6: Run accessibility, role, and syntax regressions**

Run:

```powershell
node tools\verify-auth-command-center.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-role-permissions.js
node --check assets\course-materials\information-security\app\app.js
```

Expected: all verifiers print `verification passed`; syntax check exits 0 without output.

- [ ] **Step 7: Manually verify disclosure behavior**

At desktop and mobile widths, verify:

1. Account button toggles `aria-expanded` and the account panel.
2. Clicking outside closes the account panel.
3. Mobile Menu toggles `aria-expanded` and the navigation drawer.
4. Escape closes either disclosure and returns focus to the trigger that opened it.
5. A pure student never sees the instructor Menu button or navigation.

Expected: all five behaviors match and no overlay blocks the signed-out form.

- [ ] **Step 8: Commit accessible responsive interactions**

```powershell
git add tools/verify-auth-command-center.js assets/course-materials/information-security/app/app.js assets/course-materials/information-security/app/app.css
git commit -m "feat: add accessible command center disclosures"
```

---

### Task 6: Document, Verify, and Visually Review the Completed Home Page

**Files:**
- Modify: `tools/verify-auth-command-center.js`
- Modify: `supabase/README.md:near local verification commands`
- Modify: `docs/course-platform/implementation/current-implementation-status.md:near verification checklist`
- Reference: `docs/superpowers/specs/2026-07-20-tc2007b-course-app-command-center-design.md`

**Interfaces:**
- Consumes: all prior tasks and the approved Superdesign Command Center draft.
- Produces: documented verifier command, durable implementation status, complete automated evidence, and desktop/tablet/mobile visual evidence.

- [ ] **Step 1: Make documentation part of the verifier contract**

Before the final `if (failures.length)` block in `tools/verify-auth-command-center.js`, add:

```js
requireMarkers("supabase/README.md", "Supabase README", [
  "node tools/verify-auth-command-center.js",
  "Instructor Command Center"
]);

requireMarkers(
  "docs/course-platform/implementation/current-implementation-status.md",
  "Implementation status",
  ["role-aware Instructor Command Center", "verify-auth-command-center.js"]
);
```

- [ ] **Step 2: Run the verifier to confirm RED**

Run:

```powershell
node tools\verify-auth-command-center.js
```

Expected: FAIL with documentation markers missing from `supabase/README.md` and `current-implementation-status.md`.

- [ ] **Step 3: Document the focused verifier**

Add this command beside the other local auth verifiers in `supabase/README.md`:

```powershell
node tools/verify-auth-command-center.js
```

Add this sentence immediately below that checklist:

```markdown
The Instructor Command Center verifier checks the role-aware signed-in home, grouped instructor navigation, selected-session workspace, supported contextual actions, responsive shell markers, and accessible disclosures.
```

- [ ] **Step 4: Record implementation status without expanding scope**

Add this item to the authenticated app-shell section of `current-implementation-status.md`:

```markdown
- The signed-in home uses a role-aware Instructor Command Center: instructors receive grouped Teach/Review/Manage navigation, persistent course/section/session context, a selected-session workspace, released materials, and supported review shortcuts; students retain a separate released-material and student-action composition. Evidence: `node tools/verify-auth-command-center.js`.
```

- [ ] **Step 5: Run focused and platform verification**

Run these commands exactly:

```powershell
node tools\verify-auth-command-center.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-teacher-context-switchers.js
node tools\verify-auth-teacher-context-tools.js
node tools\verify-auth-role-permissions.js
node tools\verify-auth-content-access.js
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
```

Expected: every command prints its `passed` message and exits 0.

- [ ] **Step 6: Perform live visual and interaction checks**

Using the deployed page or a local HTTP preview, capture and inspect these states in both light and dark themes:

1. Desktop instructor, 1440px wide, selected live session with released items.
2. Tablet instructor, 900px wide, navigation closed and open.
3. Mobile instructor, 390px wide, stacked selectors and full-width actions.
4. Pure student, instructor navigation absent.
5. Signed-out email/OTP state.
6. Instructor with no available sessions.
7. Instructor with no released items.
8. Authenticated context request failure while previously loaded content remains readable.

Compare state 1 with the approved draft at `https://p.superdesign.dev/draft/8c4fd3ed-fdc2-4ca4-9675-3b7e7de58566`, but use real returned data and existing app behavior as the source of truth.

Expected: the current course/section/session and next actions are visible without scrolling at 1440px; no instructor control appears for a pure student; no horizontal page scrolling occurs at 390px; both themes retain visible focus and readable contrast.

- [ ] **Step 7: Review the final diff for forbidden scope expansion**

Run:

```powershell
git diff --check
git diff --stat
git status --short
```

Expected: no whitespace errors; changed production files are limited to `index.html`, `app.js`, and `app.css`; verifier and documentation files are the only other changes; no Supabase function, migration, platform configuration, management-route HTML, or dependency file is modified.

- [ ] **Step 8: Commit documentation and final verification contract**

```powershell
git add tools/verify-auth-command-center.js supabase/README.md docs/course-platform/implementation/current-implementation-status.md
git commit -m "docs: record command center verification"
```

## Completion Checklist

- [ ] The current course, section, session, state, and next actions are visible without scrolling at a typical desktop viewport.
- [ ] Profile, role, and enrollment metadata live in the compact account treatment.
- [ ] Teach, Review, and Manage navigation is grouped and role-gated.
- [ ] The selected-session workspace uses only existing response data and supported actions.
- [ ] Released content and activity URLs retain their authenticated routes.
- [ ] Pure students never receive instructor navigation or controls.
- [ ] Signed-out email/OTP, cooldown, refresh, sign-out, theme, and status behavior still work.
- [ ] Desktop, tablet, and mobile layouts pass light/dark visual review.
- [ ] All eight final verification commands pass.
- [ ] No backend schema, function, permission, or API contract changed.
