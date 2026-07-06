# TC2007B Authenticated Platform Phase 4E Speed Bonus Policy Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the optional speed signal real in authenticated quiz scoring while keeping official grades centered on correctness.

**Architecture:** The trusted `course-activity-attempt` Edge Function calculates a small speed bonus after server-side grading. The bonus is capped, scaled by correctness and remaining time, stored in `student_attempts.speed_bonus`, and folded into `score_final` with a hard cap of 100. Browser code only displays returned score fields.

**Tech Stack:** Supabase Edge Function, authenticated activity UI, gradebook UI, Node.js verification.

---

## Task 1: Add Speed Bonus Policy Verifier

**Files:**
- Create: `tools/verify-auth-speed-bonus-policy.js`

- [x] **Step 1: Require policy markers**

Check for capped bonus helpers, final-score calculation, official gradebook sync using `score_final`, activity-player score display, gradebook clarification, status notes, and README verifier command.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-speed-bonus-policy.js
```

Expected before implementation:

```text
Authenticated speed bonus policy verification failed:
```

## Task 2: Add Trusted Speed Bonus Scoring

**Files:**
- Modify: `supabase/functions/course-activity-attempt/index.ts`

- [x] **Step 1: Calculate a capped bonus from correctness and remaining time**

The maximum bonus is small and cannot reward speed without correctness.

- [x] **Step 2: Store official final score**

Write `speed_bonus` and capped `score_final` to `student_attempts`.

- [x] **Step 3: Sync final score to gradebook**

Use `graded.score_final` when creating or updating `gradebook_scores`.

## Task 3: Add Score Display Notes

**Files:**
- Modify: `assets/course-materials/information-security/app/activity-player.js`
- Modify: `assets/course-materials/information-security/app/gradebook.js`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`
- Modify: `supabase/README.md`

- [x] **Step 1: Show student score fields**

Display correctness percent, speed bonus, and final score after submission.

- [x] **Step 2: Clarify teacher gradebook policy**

Note that final scores can include the small speed bonus.

## Task 4: Final Verification

- [x] **Step 1: Run speed bonus verifier**

```powershell
node tools\verify-auth-speed-bonus-policy.js
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
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-speed-bonus-policy.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-quiz-compatibility.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
