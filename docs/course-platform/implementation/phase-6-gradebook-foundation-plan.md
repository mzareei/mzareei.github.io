# TC2007B Authenticated Platform Phase 6A Gradebook Foundation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the official gradebook and audit database foundation so authenticated activity results can later become durable grading records.

**Architecture:** The migration creates grade categories, gradebook items, official student score rows, manual adjustment history, participation evidence, and an audit log. Direct browser access remains revoked; future Edge Functions will synchronize scores and expose teacher exports safely.

**Tech Stack:** Supabase SQL migration, Node.js verification.

---

## Task 1: Add Gradebook Schema Verifier

**Files:**
- Create: `tools/verify-auth-gradebook-schema.js`

- [x] **Step 1: Require gradebook tables**

Check for:

```text
gradebook_categories
gradebook_items
gradebook_scores
grade_adjustments
participation_events
audit_log
```

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-gradebook-schema.js
```

Expected before implementation:

```text
Authenticated gradebook schema verification failed:
```

## Task 2: Add Gradebook Foundation Migration

**Files:**
- Create: `supabase/migrations/0006_gradebook_foundation.sql`

- [x] **Step 1: Create official grading tables**

Add categories, items, scores, and adjustment history with the relationships defined in the project spec.

- [x] **Step 2: Create participation and audit tables**

Add low-stakes evidence and sensitive-change history with structured metadata.

- [x] **Step 3: Keep browser access closed**

Enable RLS and revoke direct table access from `anon` and `authenticated`.

## Task 3: Document Deployment And Verification

**Files:**
- Modify: `supabase/README.md`

- [x] **Step 1: Add migration 0006 to deploy order**

- [x] **Step 2: Add verifier to local verification list**

## Task 4: Final Verification

- [x] **Step 1: Run gradebook verifier**

```powershell
node tools\verify-auth-gradebook-schema.js
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
```
