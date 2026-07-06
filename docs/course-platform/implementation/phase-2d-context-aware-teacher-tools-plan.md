# TC2007B Authenticated Platform Phase 2D Context-Aware Teacher Tools Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make teacher tools honor the course, section, and session context selected from the authenticated Course App dashboard.

**Architecture:** Dashboard links already carry `course`, `section`, and `session` query parameters. A shared browser helper now parses those parameters, teacher tools use them to filter or preselect rows, and the learning-insights Edge Function accepts a section filter while preserving instructor and teaching-assistant authorization.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Edge Functions, Node.js verification.

---

## Task 1: Add Context-Aware Teacher Tool Verifier

**Files:**
- Create: `tools/verify-auth-teacher-context-tools.js`

- [x] **Step 1: Require context markers**

Check for the shared `teacher-context.js` helper, destination-page integrations, API filter payloads, learning-insights section filtering, README command, and implementation status.

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-auth-teacher-context-tools.js
```

Expected before implementation:

```text
Authenticated context-aware teacher tools verification failed:
```

## Task 2: Add Shared Teacher Context Helper

**Files:**
- Create: `assets/course-materials/information-security/app/teacher-context.js`

- [x] **Step 1: Parse dashboard query parameters**

Read `course`, `section`, and `session` with `URLSearchParams`.

- [x] **Step 2: Provide matching helpers**

Expose helpers for context filters, query strings, row matching, and short status labels.

## Task 3: Wire Session And Release Consoles

**Files:**
- Modify: `assets/course-materials/information-security/app/sessions.js`
- Modify: `assets/course-materials/information-security/app/session-api.js`
- Modify: `assets/course-materials/information-security/app/releases.js`
- Modify: `assets/course-materials/information-security/app/release-api.js`
- Modify: `supabase/functions/course-release-management/index.ts`

- [x] **Step 1: Filter sessions by selected context**

Use `teacherContextFromUrl`, `contextFilters`, and `matchesTeacherContext` to show the selected section/session first.

- [x] **Step 2: Filter releases by selected context**

Return raw release `section_id` and `class_session_id`, then filter and preselect matching release rows.

## Task 4: Wire Gradebook And Insights

**Files:**
- Modify: `assets/course-materials/information-security/app/gradebook.js`
- Modify: `assets/course-materials/information-security/app/insights.js`
- Modify: `assets/course-materials/information-security/app/insights-api.js`
- Modify: `supabase/functions/course-learning-insights/index.ts`

- [x] **Step 1: Initialize gradebook filters from selected section**

Use the selected section as the default gradebook filter while still allowing manual filter changes.

- [x] **Step 2: Filter learning insights by selected section**

Send the selected section to the Edge Function and enforce the existing instructor/teaching-assistant scope on the server.

## Task 5: Documentation And Verification

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Document the verifier**

Add the context-aware teacher tools verifier to the local verification checklist.

- [x] **Step 2: Run focused verifier**

```powershell
node tools\verify-auth-teacher-context-tools.js
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
node tools\verify-auth-teacher-context-tools.js
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
