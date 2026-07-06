# TC2007B Authenticated Platform Phase 4 Activity Storage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the authenticated activity, question-bank, attempt, response, and score-storage tables needed to move grade-bearing work from typed student IDs to signed-in profiles.

**Architecture:** Keep existing `quiz_*` pilot tables intact while adding the target Phase 4 schema from the platform spec. New tables are RLS-enabled and direct browser access is revoked until trusted Edge Functions enforce profile, release, attempt-limit, and grading rules.

**Tech Stack:** Supabase Postgres migrations, Node.js verification scripts, existing Supabase Edge Function pattern.

---

## Task 1: Add Activity Schema Verifier

**Files:**
- Create: `tools/verify-auth-activity-schema.js`

- [x] **Step 1: Define required tables**

The verifier must require:

```text
activity_templates
activity_instances
question_banks
questions
question_options
student_attempts
student_responses
```

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-activity-schema.js
```

Expected before migration:

```text
Authenticated activity schema verification failed:
```

## Task 2: Add Phase 4 Migration

**Files:**
- Create: `supabase/migrations/0005_authenticated_activity_storage.sql`

- [x] **Step 1: Create activity template and instance tables**

Include `activity_templates` and `activity_instances` linked to `content_items`, `course_sections`, and `class_sessions`.

- [x] **Step 2: Create question-bank tables**

Include `question_banks`, `questions`, and `question_options`.

- [x] **Step 3: Create signed-in attempt tables**

Include `student_attempts` and `student_responses`, linked to `profiles`, `course_sections`, and `activity_instances`.

- [x] **Step 4: Add constraints, indexes, RLS, and revokes**

Each table must enable RLS and revoke direct `anon` and `authenticated` access.

## Task 3: Update Documentation

**Files:**
- Modify: `supabase/README.md`

- [x] **Step 1: Add migration to deploy order**

Mention `migrations/0005_authenticated_activity_storage.sql`.

- [x] **Step 2: Add verifier command**

Add:

```powershell
node tools/verify-auth-activity-schema.js
```

## Task 4: Final Verification

- [x] **Step 1: Run activity schema verifier**

```powershell
node tools\verify-auth-activity-schema.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-activity-schema.js
```
