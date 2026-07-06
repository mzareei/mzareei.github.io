# TC2007B Authenticated Platform Phase 3C Scheduled Release Access Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let scheduled releases open automatically when their `opens_at` time arrives, while keeping future scheduled releases unavailable to students.

**Architecture:** Student-facing Edge Functions query `content_releases` with `scheduled` included in the visible state set. A shared local rule in each function treats scheduled releases as open only when `opens_at <= now`. Browser-facing responses return the effective state as `released` after the open time while preserving `release_state` for audit/debug context.

**Tech Stack:** Supabase Edge Functions, static authenticated app JavaScript, Node.js verification.

---

## Task 1: Add Scheduled Access Verifier

**Files:**
- Create: `tools/verify-auth-scheduled-release-access.js`

- [x] **Step 1: Require scheduled-release markers**

Check that dashboard context, direct content access, activity attempts, and student progress all include `scheduled`, enforce `opens_at`, and document the local verifier.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-scheduled-release-access.js
```

Expected before implementation:

```text
Scheduled release access verification failed:
```

## Task 2: Implement Scheduled Access Rule

**Files:**
- Modify: `supabase/functions/course-auth-context/index.ts`
- Modify: `supabase/functions/course-content-access/index.ts`
- Modify: `supabase/functions/course-activity-attempt/index.ts`
- Modify: `supabase/functions/course-student-progress/index.ts`

- [x] **Step 1: Include `scheduled` in student-visible release state checks**

- [x] **Step 2: Block scheduled releases before `opens_at`**

- [x] **Step 3: Return an effective `released` state after the schedule opens**

## Task 3: Update Documentation

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Add the scheduled-release verifier to the local checklist**

- [x] **Step 2: Record the implemented behavior in course-platform status**

## Task 4: Final Verification

- [x] **Step 1: Run scheduled release verifier**

```powershell
node tools\verify-auth-scheduled-release-access.js
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
