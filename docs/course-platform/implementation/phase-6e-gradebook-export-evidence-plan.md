# TC2007B Authenticated Platform Phase 6E Gradebook Export Evidence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gradebook CSV exports defensible as official grade evidence by including identity, section, activity, source attempt, submission state, scores, and timestamps.

**Architecture:** The trusted `course-gradebook-summary` Edge Function already owns gradebook review and CSV export. This slice joins official `gradebook_scores` to `student_attempts` when `source_attempt_id` is available, adds explicit attempt evidence fields, and avoids ambiguous CSV column names.

**Tech Stack:** Supabase Edge Function, Node.js verification.

---

## Task 1: Add Export Evidence Verifier

**Files:**
- Create: `tools/verify-auth-gradebook-export-evidence.js`

- [x] **Step 1: Require complete CSV evidence markers**

Check for source-attempt joins, attempt number, attempt status, submission timestamp, speed bonus, explicit grade status, README command, and status documentation.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-gradebook-export-evidence.js
```

Expected before implementation:

```text
Authenticated gradebook export evidence verification failed:
```

## Task 2: Add Source Attempt Evidence To Exports

**Files:**
- Modify: `supabase/functions/course-gradebook-summary/index.ts`

- [x] **Step 1: Load source attempts for exported gradebook scores**

- [x] **Step 2: Add attempt number, attempt status, submitted timestamp, and speed bonus to rows**

- [x] **Step 3: Use explicit `grade_status` instead of an ambiguous CSV `status` header**

## Task 3: Document Verification

**Files:**
- Modify: `docs/course-platform/implementation/current-implementation-status.md`
- Modify: `supabase/README.md`

- [x] **Step 1: Add export evidence status note**

- [x] **Step 2: Add verifier to standard local checks**

## Task 4: Final Verification

- [x] **Step 1: Run export evidence verifier**

```powershell
node tools\verify-auth-gradebook-export-evidence.js
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
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
