# TC2007B Authenticated Platform Phase 7G Review Coach Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in students a dedicated Review Coach page that turns their official progress data into clear next-practice guidance.

**Architecture:** The page reuses the trusted `course-student-progress` Edge Function through `progress-api.js`. The browser renders weak-topic signals, recommended practice, and released activities from the already-scoped student progress payload. It does not query Supabase tables directly and does not expose answer keys or selected-option records.

**Tech Stack:** Static HTML/CSS/JavaScript, existing Supabase Edge Function, Node.js verification.

---

## Task 1: Add Review Coach Verifier

**Files:**
- Create: `tools/verify-auth-review-coach.js`

- [x] **Step 1: Require authenticated Review Coach surface**

Check for the Review Coach page, UI script, existing progress API dependency, dashboard link, status note, and README verifier entry.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-review-coach.js
```

Expected before implementation:

```text
Authenticated Review Coach verification failed:
```

## Task 2: Add Authenticated Review Coach UI

**Files:**
- Create: `assets/course-materials/information-security/app/review-coach.html`
- Create: `assets/course-materials/information-security/app/review-coach.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/app/progress.html`

- [x] **Step 1: Render progress-based coaching**

Show a student-safe summary, weak-topic list, recommendations, and released practice links from `loadStudentProgress()`.

- [x] **Step 2: Link from student dashboard**

Add Review Coach to authenticated student actions and cross-link it from My Progress.

## Task 3: Final Verification

- [x] **Step 1: Run Review Coach verifier**

```powershell
node tools\verify-auth-review-coach.js
```

- [x] **Step 2: Run platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-review-coach.js
```
