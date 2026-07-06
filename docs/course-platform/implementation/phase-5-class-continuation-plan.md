# TC2007B Authenticated Platform Phase 5 Class Pause And Continuation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the teacher pause an unfinished class and continue it in the next meeting without manually recreating sessions or releases, while making paused and continued work visible to students.

**Architecture:** A trusted `course-session-management` Edge Function owns session state changes and continuation creation. The teacher Session Console calls that function from the authenticated app. Student context includes paused and continued session metadata so the dashboard can explain what is happening.

**Tech Stack:** Supabase Edge Function, existing authenticated app HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Session Continuation Verifier

**Files:**
- Create: `tools/verify-auth-session-continuation.js`

- [x] **Step 1: Confirm RED**

Run:

```powershell
node tools\verify-auth-session-continuation.js
```

Expected before implementation:

```text
Authenticated session continuation verification failed:
```

## Task 2: Add Trusted Session Actions

**Files:**
- Create: `supabase/functions/course-session-management/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Add trusted session actions**

Add instructor-only `list_sessions`, `update_session_state`, and `continue_session` actions.

- [x] **Step 2: Preserve continuation links and moved releases**

Create continuation sessions with `continued_from_session_id`, move selected `content_releases`, and write `release_events` rows for moved releases.

## Task 3: Add Teacher And Student UI

**Files:**
- Create: `assets/course-materials/information-security/app/sessions.html`
- Create: `assets/course-materials/information-security/app/session-api.js`
- Create: `assets/course-materials/information-security/app/sessions.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `supabase/functions/course-auth-context/index.ts`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add teacher Session Console**

Show sessions, state transitions, continuation controls, and release carry-forward checkboxes.

- [x] **Step 2: Surface paused and continued work to students**

Include paused releases and continued session metadata in student context and dashboard text.

## Task 4: Final Verification

- [x] **Step 1: Run session continuation verifier**

```powershell
node tools\verify-auth-session-continuation.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
