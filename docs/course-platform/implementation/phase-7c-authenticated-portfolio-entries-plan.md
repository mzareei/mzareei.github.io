# TC2007B Authenticated Platform Phase 7C Portfolio Entries Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move portfolio evidence from local browser storage into authenticated, student-owned Supabase records linked to gradebook categories.

**Architecture:** A new `portfolio_entries` table stores student-owned evidence by course, section, optional released content item, and optional gradebook category. A trusted Edge Function verifies the signed-in student, scopes every action to their own active enrollment, and supports list/submit actions. The authenticated Course App gains a portfolio page and the student progress dashboard counts submitted portfolio entries.

**Tech Stack:** Supabase SQL migration, Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Authenticated Portfolio Verifier

**Files:**
- Create: `tools/verify-auth-portfolio-entries.js`

- [x] **Step 1: Require schema, function, UI, config, docs, and progress integration**

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-portfolio-entries.js
```

Expected before implementation:

```text
Authenticated portfolio entries verification failed:
```

## Task 2: Add Portfolio Entry Schema And Function

**Files:**
- Create: `supabase/migrations/0007_portfolio_entries.sql`
- Create: `supabase/functions/course-portfolio-entry/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Create `portfolio_entries`**

- [x] **Step 2: Add `list_entries` and `submit_entry` trusted actions**

- [x] **Step 3: Link entries to gradebook categories and optional content items**

## Task 3: Add Authenticated Portfolio UI

**Files:**
- Create: `assets/course-materials/information-security/app/portfolio.html`
- Create: `assets/course-materials/information-security/app/portfolio-api.js`
- Create: `assets/course-materials/information-security/app/portfolio.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/app/progress.js`
- Modify: `supabase/functions/course-student-progress/index.ts`
- Modify: `assets/course-materials/information-security/platform-config.js`
- Modify: `supabase/README.md`

- [x] **Step 1: List existing entries**

- [x] **Step 2: Submit new evidence**

- [x] **Step 3: Count portfolio evidence in student progress**

## Task 4: Final Verification

- [x] **Step 1: Run portfolio verifier**

```powershell
node tools\verify-auth-portfolio-entries.js
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
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-portfolio-entries.js
```
