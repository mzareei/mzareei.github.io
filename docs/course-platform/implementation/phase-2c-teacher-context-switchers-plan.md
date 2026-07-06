# TC2007B Authenticated Platform Phase 2C Teacher Context Switchers Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add teacher context switchers to the authenticated Course App so instructors can choose the active course, section, and class session before opening teacher tools.

**Architecture:** The `course-auth-context` Edge Function already validates the signed-in user and returns safe course context. It now adds `teacher_sessions` for instructor/platform-owner users and section-scoped teaching assistants. The Course App renders a teacher-only context panel with course, section, and session selectors, stores the current selection in browser local storage, and appends that context to teacher tool links.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Edge Functions, Node.js verification.

---

## Task 1: Add Teacher Context Switcher Verifier

**Files:**
- Create: `tools/verify-auth-teacher-context-switchers.js`

- [x] **Step 1: Require switcher markers**

Check for Course App markup, JavaScript render helpers, CSS classes, `teacher_sessions` from the auth context function, README command, and implementation status.

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-auth-teacher-context-switchers.js
```

Expected before implementation:

```text
Authenticated teacher context switcher verification failed:
```

## Task 2: Return Teacher Session Context

**Files:**
- Modify: `supabase/functions/course-auth-context/index.ts`

- [x] **Step 1: Detect teacher context**

Treat `platform_owner`, `instructor`, and `teaching_assistant` roles as teacher-context roles.

- [x] **Step 2: Scope sessions safely**

Return all course sessions for instructors/platform owners, but only assigned-section sessions for teaching assistants.

- [x] **Step 3: Avoid sensitive data**

Return class session summaries only: section, title, planned date, state, and continuation context.

## Task 3: Render Teacher Switchers

**Files:**
- Modify: `assets/course-materials/information-security/app/index.html`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/app/app.css`

- [x] **Step 1: Add teacher-only panel**

Add course, section, and session selectors to the signed-in dashboard.

- [x] **Step 2: Store current teacher context**

Persist the selected course, section, and session in local storage for repeated classroom use.

- [x] **Step 3: Add context-aware teacher links**

Append the selected context to session, release, insights, and gradebook links.

## Task 4: Documentation And Verification

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Document the verifier**

Add the teacher-context verifier to the local verification checklist.

- [x] **Step 2: Run focused verifier**

```powershell
node tools\verify-auth-teacher-context-switchers.js
```

- [x] **Step 3: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-institutional-email-guard.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-release-maintenance.js
node tools\verify-auth-teacher-context-switchers.js
node tools\verify-auth-roster-management.js
node tools\verify-auth-role-permissions.js
node tools\verify-auth-ta-release-guard.js
node tools\verify-auth-content-access.js
node tools\verify-auth-scheduled-release-access.js
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-speed-bonus-policy.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-quiz-compatibility.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-export-evidence.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-records.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
