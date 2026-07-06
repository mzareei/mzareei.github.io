# TC2007B Authenticated Platform Phase 7A Student Progress And Review Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in students an official progress dashboard and review-coach recommendations based on stored course data.

**Architecture:** A new Edge Function validates the signed-in student, scopes all records to their own profile and enrolled sections, returns official gradebook scores, recent attempts, released practice items, and topic-based recommendations from missed responses. The browser page renders the returned data and never reads database tables directly.

**Tech Stack:** Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Student Progress Verifier

**Files:**
- Create: `tools/verify-auth-student-progress.js`

- [x] **Step 1: Require authenticated progress surface**

Check for the progress page, browser API helper, UI script, trusted progress function, config, dashboard link, and README entries.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-student-progress.js
```

Expected before implementation:

```text
Authenticated student progress verification failed:
```

## Task 2: Add Trusted Student Progress Function

**Files:**
- Create: `supabase/functions/course-student-progress/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Validate signed-in student identity**

- [x] **Step 2: Return self-scoped gradebook and attempt records**

- [x] **Step 3: Build review recommendations from missed topic tags and released content**

## Task 3: Add Authenticated Progress UI

**Files:**
- Create: `assets/course-materials/information-security/app/progress.html`
- Create: `assets/course-materials/information-security/app/progress-api.js`
- Create: `assets/course-materials/information-security/app/progress.js`
- Modify: `assets/course-materials/information-security/app/index.html`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/app/app.css`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add dashboard stats and official score rows**

- [x] **Step 2: Add review-coach recommendations and released practice rows**

- [x] **Step 3: Link progress from the authenticated Course App**

## Task 4: Final Verification

- [x] **Step 1: Run student progress verifier**

```powershell
node tools\verify-auth-student-progress.js
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
node tools\verify-auth-student-progress.js
```
