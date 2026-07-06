# TC2007B Authenticated Platform Phase 1F Roster Corrections Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let instructors correct roster profile details and merge duplicate profiles instead of creating new identities when a roster or email issue appears.

**Architecture:** The existing `course-roster-management` Edge Function remains instructor-only. It now supports `correct_roster_profile` for profile field repairs and `merge_roster_profile` for moving profile-owned evidence rows into a target profile, deactivating source roster links, marking the source as merged, and writing `audit_log` records.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Edge Functions, Node.js verification.

---

## Task 1: Add Roster Correction Verifier

**Files:**
- Create: `tools/verify-auth-roster-corrections.js`

- [x] **Step 1: Require correction and merge markers**

Check for trusted correction/merge actions, audit logging, roster page controls, API helpers, README command, and implementation status.

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-auth-roster-corrections.js
```

Expected before implementation:

```text
Authenticated roster correction verification failed:
```

## Task 2: Add Trusted Roster Repair Actions

**Files:**
- Modify: `supabase/functions/course-roster-management/index.ts`

- [x] **Step 1: Add profile correction action**

Add `correct_roster_profile`, validate profile membership in the course, update email/name/student ID/status, and write `profile_corrected` to `audit_log`.

- [x] **Step 2: Add profile merge action**

Add `merge_roster_profile`, validate source and target profiles in the course, copy course memberships and section enrollments to the target, move profile-owned evidence rows, mark the source as merged, and write `profile_merged` to `audit_log`.

## Task 3: Add Roster UI Controls

**Files:**
- Modify: `assets/course-materials/information-security/app/roster.html`
- Modify: `assets/course-materials/information-security/app/roster.js`
- Modify: `assets/course-materials/information-security/app/roster-api.js`

- [x] **Step 1: Add correction panel**

Add selected profile, email, name, student ID, status, and reason controls.

- [x] **Step 2: Add merge panel**

Add source profile ID, target profile ID, and merge action controls.

- [x] **Step 3: Wire row selection and actions**

Clicking a roster row fills the correction form and source profile ID; correction and merge buttons call the trusted API helpers.

## Task 4: Documentation And Verification

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Document the verifier**

Add the roster correction verifier to the local verification checklist.

- [x] **Step 2: Run focused verifier**

```powershell
node tools\verify-auth-roster-corrections.js
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
node tools\verify-auth-roster-corrections.js
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
