# TC2007B Authenticated Platform Phase 1D TA Release Guard Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align teaching-assistant release permissions with the course spec: TAs may view assigned section releases, but only instructors and platform owners may change release states.

**Architecture:** The `course-release-management` Edge Function still accepts teaching assistants for section-scoped release listing. Mutating `update_state` requests now pass through an instructor-only guard, and the browser Release Console disables update controls when the function returns list-only actions.

**Tech Stack:** Supabase Edge Function, static authenticated app JavaScript, Node.js verification.

---

## Task 1: Add TA Release Guard Verifier

**Files:**
- Create: `tools/verify-auth-ta-release-guard.js`

- [x] **Step 1: Require TA mutation guard markers**

Check that the release function returns role-aware actions, rejects TA state changes, and the browser console respects list-only mode.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-ta-release-guard.js
```

Expected before implementation:

```text
Authenticated TA release guard verification failed:
```

## Task 2: Guard Release Mutations

**Files:**
- Modify: `supabase/functions/course-release-management/index.ts`
- Modify: `assets/course-materials/information-security/app/releases.js`

- [x] **Step 1: Return `update_state` only for instructors/platform owners**

- [x] **Step 2: Reject TA `update_state` requests server-side**

- [x] **Step 3: Disable browser update controls for list-only users**

## Task 3: Update Documentation

**Files:**
- Modify: `docs/course-platform/implementation/current-implementation-status.md`
- Modify: `docs/course-platform/implementation/phase-1c-role-permissions-plan.md`
- Modify: `supabase/README.md`

- [x] **Step 1: Remove contradictory TA release-management wording**

- [x] **Step 2: Add the TA release guard verifier to local verification docs**

## Task 4: Final Verification

- [x] **Step 1: Run TA release guard verifier**

```powershell
node tools\verify-auth-ta-release-guard.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
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
