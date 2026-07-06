# TC2007B Authenticated Platform Phase 6I Gradebook Status Records Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let instructors create official `missing` or `excused` gradebook records for rostered students when no activity attempt exists or when a teacher-approved exception applies.

**Architecture:** The existing trusted `course-gradebook-summary` Edge Function gains an instructor-only `set_score_status` action. It validates the gradebook item, student profile, and section, creates or updates the unique `(gradebook_item_id, profile_id)` score record, and writes audit evidence. The teacher Gradebook page gains a small manual status panel using the existing gradebook catalog.

**Tech Stack:** Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Status-Record Verifier

**Files:**
- Create: `tools/verify-auth-gradebook-status-records.js`

- [x] **Step 1: Require manual status workflow**

Check for the backend action, roster-student catalog, UI controls, browser API helper, status note, and README verifier entry.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-gradebook-status-records.js
```

Expected before implementation:

```text
Authenticated gradebook status records verification failed:
```

## Task 2: Add Trusted Gradebook Status Action

**Files:**
- Modify: `supabase/functions/course-gradebook-summary/index.ts`

- [x] **Step 1: List rostered students in gradebook catalog**

Return active rostered students for the scoped sections so instructors can choose a student even before a score exists.

- [x] **Step 2: Create or update official status score**

Support `set_score_status` for `posted`, `missing`, and `excused` records. Missing defaults to zero, excused keeps score fields empty, and posted requires a numeric final score.

- [x] **Step 3: Audit the status change**

Write `gradebook_score_status_set` to `audit_log`.

## Task 3: Add Teacher UI Controls

**Files:**
- Modify: `assets/course-materials/information-security/app/gradebook-api.js`
- Modify: `assets/course-materials/information-security/app/gradebook.html`
- Modify: `assets/course-materials/information-security/app/gradebook.js`

- [x] **Step 1: Add API helper**

Expose `setGradebookScoreStatus`.

- [x] **Step 2: Add manual status panel**

Let instructors select activity, student, status, optional score, and reason.

## Task 4: Final Verification

- [x] **Step 1: Run status verifier**

```powershell
node tools\verify-auth-gradebook-status-records.js
```

- [x] **Step 2: Run platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-gradebook-status-records.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-export-evidence.js
```
