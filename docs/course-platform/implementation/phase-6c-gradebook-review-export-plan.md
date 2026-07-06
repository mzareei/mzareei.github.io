# TC2007B Authenticated Platform Phase 6C Gradebook Review And Export Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give instructors a trusted gradebook review screen and CSV export path for official course scores.

**Architecture:** A new Edge Function verifies instructor membership, reads official gradebook score records, joins safe student/section/item/category metadata, includes adjustment counts, and can return either JSON for the teacher screen or CSV for download. The browser UI never reads gradebook tables directly.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Edge Function, Node.js verification.

---

## Task 1: Add Gradebook Review Verifier

**Files:**
- Create: `tools/verify-auth-gradebook-review.js`

- [x] **Step 1: Require teacher review surface**

Check for the gradebook page, browser API helper, UI script, and trusted summary function.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-gradebook-review.js
```

Expected before implementation:

```text
Authenticated gradebook review verification failed:
```

## Task 2: Add Trusted Summary And CSV Function

**Files:**
- Create: `supabase/functions/course-gradebook-summary/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Require instructor identity**

Validate the signed-in user and active course membership before returning grade records.

- [x] **Step 2: Return safe gradebook rows**

Return categories, items, sections, official scores, adjustment counts, and locked status.

- [x] **Step 3: Export CSV**

Support CSV output by section, activity/item, category, or full semester filters.

## Task 3: Add Teacher Gradebook UI

**Files:**
- Create: `assets/course-materials/information-security/app/gradebook.html`
- Create: `assets/course-materials/information-security/app/gradebook-api.js`
- Create: `assets/course-materials/information-security/app/gradebook.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add filters and table**

- [x] **Step 2: Add CSV download action**

- [x] **Step 3: Link from teacher actions**

## Task 4: Final Verification

- [x] **Step 1: Run gradebook review verifier**

```powershell
node tools\verify-auth-gradebook-review.js
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
```
