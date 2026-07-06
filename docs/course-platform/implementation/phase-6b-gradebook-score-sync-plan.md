# TC2007B Authenticated Platform Phase 6B Gradebook Score Sync Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect trusted activity submissions to official gradebook score rows.

**Architecture:** The authenticated attempt Edge Function remains the only writer for student attempt grading. After grading and saving an attempt, it finds the published gradebook item linked to the activity template and creates or updates the student's official score. Locked gradebook scores are not overwritten. Each automatic score sync writes an audit log entry.

**Tech Stack:** Supabase Edge Function TypeScript, Supabase SQL seed, Node.js verification.

---

## Task 1: Add Gradebook Sync Verifier

**Files:**
- Create: `tools/verify-auth-gradebook-sync.js`

- [x] **Step 1: Require trusted score-sync markers**

Check that `course-activity-attempt` writes `gradebook_scores`, uses `gradebook_items`, respects locked rows, and writes an `audit_log` entry.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-gradebook-sync.js
```

Expected before implementation:

```text
Authenticated gradebook sync verification failed:
```

## Task 2: Sync Submitted Attempts To Gradebook

**Files:**
- Modify: `supabase/functions/course-activity-attempt/index.ts`

- [x] **Step 1: Find linked gradebook item**

Use the submitted activity instance's `activity_template_id`.

- [x] **Step 2: Insert or update official score**

Write `gradebook_scores` with `source_attempt_id`, `score_raw`, `score_percent`, and `score_final`.

- [x] **Step 3: Preserve locked scores**

If an official score is already locked, do not overwrite it.

- [x] **Step 4: Audit automatic sync**

Insert a `score_synced` entry into `audit_log`.

## Task 3: Seed Demo Gradebook Item

**Files:**
- Modify: `supabase/seed/tc2007b_auth_activity_demo.sql`
- Modify: `supabase/README.md`

- [x] **Step 1: Add a practice gradebook category**

- [x] **Step 2: Add a published gradebook item linked to the demo activity template**

- [x] **Step 3: Add verifier to README**

## Task 4: Final Verification

- [x] **Step 1: Run gradebook sync verifier**

```powershell
node tools\verify-auth-gradebook-sync.js
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
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
```
