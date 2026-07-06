# TC2007B Authenticated Platform Phase 4D Legacy Quiz Compatibility Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a safe compatibility path from the original `quiz_*` pilot question banks into the authenticated activity model without importing unauthenticated student attempts as official grades.

**Architecture:** A trusted `course-quiz-compatibility` Edge Function lets instructors list legacy quiz lectures and migrate one lecture bank into `content_items`, `question_banks`, `questions`, `question_options`, `activity_templates`, and optional section-scoped `activity_instances`. The operation is idempotent by question prompt inside the target bank.

**Tech Stack:** Supabase Edge Function, Markdown operations runbook, Node.js verification.

---

## Task 1: Add Compatibility Verifier

**Files:**
- Create: `tools/verify-auth-quiz-compatibility.js`

- [x] **Step 1: Confirm RED**

Run:

```powershell
node tools\verify-auth-quiz-compatibility.js
```

Expected before implementation:

```text
Authenticated legacy quiz compatibility verification failed:
```

## Task 2: Add Legacy Quiz Migration Path

**Files:**
- Create: `supabase/functions/course-quiz-compatibility/index.ts`
- Create: `docs/course-platform/operations/legacy-quiz-migration.md`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Add legacy quiz list and migration actions**

Add instructor-only `list_legacy_lectures` and `migrate_lecture_bank` actions. Copy active legacy `quiz_questions` and `quiz_options` into the authenticated question-bank model, normalize legacy difficulty values, and optionally create `activity_instances` for selected sections.

- [x] **Step 2: Document the compatibility path**

Explain what migrates, what does not migrate, how to call the function, and how to validate the result before using it for grades.

## Task 3: Final Verification

- [x] **Step 1: Run legacy quiz compatibility verifier**

```powershell
node tools\verify-auth-quiz-compatibility.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-roster-management.js
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-quiz-compatibility.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
