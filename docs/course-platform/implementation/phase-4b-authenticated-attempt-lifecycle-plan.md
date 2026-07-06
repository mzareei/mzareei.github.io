# TC2007B Authenticated Platform Phase 4B Attempt Lifecycle Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the trusted attempt lifecycle function that lets signed-in students start and submit activity attempts against the authenticated activity tables.

**Architecture:** The browser calls a Supabase Edge Function with the signed-in user's bearer token. The function validates the user profile, checks section enrollment, verifies the activity is open, selects questions server-side, returns options without correctness data, grades submitted responses server-side, stores responses, and updates `student_attempts`.

**Tech Stack:** Supabase Edge Functions, Supabase Postgres, static browser JavaScript helper, Node.js verification script.

---

## Task 1: Add Attempt Lifecycle Verifier

**Files:**
- Create: `tools/verify-auth-attempt-lifecycle.js`

- [x] **Step 1: Define expected files and markers**

The verifier must require:

```text
supabase/functions/course-activity-attempt/index.ts
assets/course-materials/information-security/app/activity-api.js
```

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-attempt-lifecycle.js
```

Expected before implementation:

```text
Authenticated attempt lifecycle verification failed:
```

## Task 2: Add Trusted Attempt Function

**Files:**
- Create: `supabase/functions/course-activity-attempt/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Require signed-in bearer token**

Return `401` without a valid `Authorization` header.

- [x] **Step 2: Resolve profile and section enrollment**

Load `profiles`, `section_enrollments`, and `activity_instances`; return `403` when the signed-in user is not enrolled in the activity section.

- [x] **Step 3: Start attempt**

Create or return a `student_attempts` row and return selected questions and options without `is_correct`.

- [x] **Step 4: Submit attempt**

Write `student_responses`, grade using `question_options.is_correct` server-side, and update `score_raw`, `score_percent`, and `score_final`.

## Task 3: Add Browser Activity API Helper

**Files:**
- Create: `assets/course-materials/information-security/app/activity-api.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add start helper**

Call `course-activity-attempt` with `action: "start_attempt"`.

- [x] **Step 2: Add submit helper**

Call `course-activity-attempt` with `action: "submit_attempt"`.

- [x] **Step 3: Keep browser response clean**

The helper must not contain answer keys or correctness logic.

## Task 4: Final Verification

- [x] **Step 1: Run attempt verifier**

```powershell
node tools\verify-auth-attempt-lifecycle.js
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
```
