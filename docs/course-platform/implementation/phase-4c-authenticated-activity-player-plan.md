# TC2007B Authenticated Platform Phase 4C Activity Player Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic authenticated activity player page and a safe demo seed so signed-in students can exercise the server-side attempt lifecycle.

**Architecture:** The player reads an `activity` query parameter or manual activity instance id, calls `startActivityAttempt`, renders only the server-returned prompt/options, submits selected option ids through `submitActivityAttempt`, and displays the server-returned score. Demo seed rows create one low-stakes Week 1 activity template, two section-specific activity instances, a question bank, questions, and options.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Edge Function helper, Supabase SQL seed, Node.js verification.

---

## Task 1: Add Activity Player Verifier

**Files:**
- Create: `tools/verify-auth-activity-player.js`

- [x] **Step 1: Require player files and demo seed**

Check for:

```text
assets/course-materials/information-security/app/activity.html
assets/course-materials/information-security/app/activity-player.js
supabase/seed/tc2007b_auth_activity_demo.sql
```

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-activity-player.js
```

Expected before implementation:

```text
Authenticated activity player verification failed:
```

## Task 2: Add Activity Player UI

**Files:**
- Create: `assets/course-materials/information-security/app/activity.html`
- Create: `assets/course-materials/information-security/app/activity-player.js`
- Modify: `assets/course-materials/information-security/app/app.css`

- [x] **Step 1: Add activity id controls**

Allow loading by `?activity=` or manual activity instance id input.

- [x] **Step 2: Render questions**

Render server-returned questions and options without correctness fields.

- [x] **Step 3: Submit responses**

Use `submitActivityAttempt` and show server-returned score.

## Task 3: Add Demo Activity Seed

**Files:**
- Create: `supabase/seed/tc2007b_auth_activity_demo.sql`
- Modify: `supabase/README.md`

- [x] **Step 1: Insert activity template and section instances**

Use existing `week-01-mission-01` content item and sections `A` and `B`.

- [x] **Step 2: Insert safe demo question bank**

Add low-stakes questions and options only for demo practice.

- [x] **Step 3: Document seed**

Mention the seed after `tc2007b_auth_foundation_demo.sql`.

## Task 4: Final Verification

- [x] **Step 1: Run activity player verifier**

```powershell
node tools\verify-auth-activity-player.js
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
```
