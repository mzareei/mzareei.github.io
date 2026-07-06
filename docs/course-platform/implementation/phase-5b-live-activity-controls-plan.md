# TC2007B Authenticated Platform Phase 5B Live Activity Controls Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the teacher start, pause, resume, close, and extend live activity instances from the authenticated Session Console.

**Architecture:** The `course-session-management` Edge Function owns trusted activity-state changes and extension of activity windows. The Session Console calls that function for the selected activity instance, while the existing student attempt function continues to enforce `activity_instances.state`, `starts_at`, `ends_at`, and `time_limit_seconds`.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Edge Functions, Node.js verification.

---

## Task 1: Add Live Activity Controls Verifier

**Files:**
- Create: `tools/verify-auth-live-activity-controls.js`

- [x] **Step 1: Require live-control markers**

Check for trusted activity transitions, `update_activity_state`, `extend_activity_window`, Session Console controls, API helpers, README command, and implementation status.

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-auth-live-activity-controls.js
```

Expected before implementation:

```text
Authenticated live activity controls verification failed:
```

## Task 2: Add Trusted Activity Actions

**Files:**
- Modify: `supabase/functions/course-session-management/index.ts`

- [x] **Step 1: Add allowed activity transitions**

Support `planned`, `open`, `live`, `paused`, `closed`, and `archived` transitions for `activity_instances`.

- [x] **Step 2: Update activity state**

Add `update_activity_state`, enforce instructor/TA section scope, set `starts_at` when an activity becomes live, set `ends_at` when it closes, and write `audit_log` with `activity_state_changed`.

- [x] **Step 3: Extend activity window**

Add `extend_activity_window`, extend `ends_at` by teacher-selected minutes, reject closed or archived activities, and write `audit_log` with `activity_window_extended`.

## Task 3: Add Session Console Controls

**Files:**
- Modify: `assets/course-materials/information-security/app/sessions.html`
- Modify: `assets/course-materials/information-security/app/sessions.js`
- Modify: `assets/course-materials/information-security/app/session-api.js`

- [x] **Step 1: Add controls to the live activity panel**

Add activity state selector, update button, extension minutes input, extension button, and selected activity status.

- [x] **Step 2: Wire browser API helpers**

Add `updateActivityState` and `extendActivityWindow` calls through the authenticated session-management function.

- [x] **Step 3: Render selected activity controls**

Show allowed next states, current activity state, close time, and time limit for the selected activity.

## Task 4: Documentation And Verification

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Document the verifier**

Add the live activity controls verifier to the local verification checklist.

- [x] **Step 2: Run focused verifier**

```powershell
node tools\verify-auth-live-activity-controls.js
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
node tools\verify-auth-live-activity-controls.js
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
