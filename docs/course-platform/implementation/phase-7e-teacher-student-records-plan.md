# TC2007B Authenticated Platform Phase 7E Teacher Student Records Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give teachers a student-level record view across official scores, activity attempts, exit tickets, and portfolio evidence.

**Architecture:** A trusted `course-student-records` Edge Function validates teacher identity and section scope. Instructors can inspect students in assigned courses; teaching assistants are limited to assigned sections. The authenticated Course App gains a teacher page that lists students and renders a selected student's evidence.

**Tech Stack:** Supabase Edge Function, static authenticated app HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Student Records Verifier

**Files:**
- Create: `tools/verify-auth-student-records.js`

- [x] **Step 1: Require student-record surface markers**

Check for trusted function, browser API helper, page markup, UI rendering, dashboard link, platform config, Supabase config, README command, and implementation status note.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-student-records.js
```

Expected before implementation:

```text
Authenticated student records verification failed:
```

## Task 2: Add Trusted Student Records Function

**Files:**
- Create: `supabase/functions/course-student-records/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Validate teacher identity and section scope**

- [x] **Step 2: List rostered students for permitted sections**

- [x] **Step 3: Load one student's official scores, attempts, exit tickets, and portfolio entries**

## Task 3: Add Teacher Student Records UI

**Files:**
- Create: `assets/course-materials/information-security/app/student-records-api.js`
- Create: `assets/course-materials/information-security/app/student-records.html`
- Create: `assets/course-materials/information-security/app/student-records.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add student selector and summary**

- [x] **Step 2: Render official score, attempt, exit-ticket, and portfolio evidence tables**

- [x] **Step 3: Link from the teacher dashboard**

## Task 4: Final Verification

- [x] **Step 1: Run student records verifier**

```powershell
node tools\verify-auth-student-records.js
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
node tools\verify-auth-student-records.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
