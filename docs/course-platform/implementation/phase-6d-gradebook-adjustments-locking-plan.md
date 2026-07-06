# TC2007B Authenticated Platform Phase 6D Gradebook Adjustments And Locking Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let instructors make reasoned manual score adjustments and lock finalized official score records.

**Architecture:** The existing gradebook summary Edge Function gains teacher-only actions for score adjustment and score locking. Adjustments require a reason, preserve the previous score, update the official score, and audit the change. Locked scores are not adjusted by the teacher action or automatic sync.

**Tech Stack:** Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Adjustment And Lock Verifier

**Files:**
- Create: `tools/verify-auth-gradebook-adjustments.js`

- [x] **Step 1: Require trusted action markers**

Check for adjustment, lock, reason, history, and audit markers.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-gradebook-adjustments.js
```

Expected before implementation:

```text
Authenticated gradebook adjustments verification failed:
```

## Task 2: Add Trusted Adjustment Actions

**Files:**
- Modify: `supabase/functions/course-gradebook-summary/index.ts`

- [x] **Step 1: Add `adjust_score`**

Require score id, new final score, and reason. Insert `grade_adjustments` and update `gradebook_scores`.

- [x] **Step 2: Add `lock_score`**

Set score status to `locked`, set `locked_at`, and write audit history.

- [x] **Step 3: Preserve locked rows**

Reject manual adjustments for locked scores.

## Task 3: Add Teacher UI Controls

**Files:**
- Modify: `assets/course-materials/information-security/app/gradebook-api.js`
- Modify: `assets/course-materials/information-security/app/gradebook.html`
- Modify: `assets/course-materials/information-security/app/gradebook.js`

- [x] **Step 1: Select score rows**

- [x] **Step 2: Apply adjustment with required reason**

- [x] **Step 3: Lock selected score**

## Task 4: Final Verification

- [x] **Step 1: Run adjustment verifier**

```powershell
node tools\verify-auth-gradebook-adjustments.js
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
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-adjustments.js
```
