# TC2007B Authenticated Platform Phase 3B Content Access Gate Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route released course materials through an authenticated access check so students see an access-denied state for unreleased, closed, or wrong-section releases.

**Architecture:** The Course App dashboard links released materials to `content.html?release=...`. The browser page calls a trusted `course-content-access` Edge Function with the signed-in user's bearer token. The function validates profile identity, active section enrollment or teacher scope, release state, release window, and content ownership before returning `source_ref`.

**Tech Stack:** Supabase Edge Function, static authenticated app HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Content Access Verifier

**Files:**
- Create: `tools/verify-auth-content-access.js`

- [x] **Step 1: Require trusted content gate markers**

Check for the Edge Function, browser API helper, content page, dashboard links, platform config, Supabase config, README, and implementation status note.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-content-access.js
```

Expected before implementation:

```text
Authenticated content access verification failed:
```

## Task 2: Add Trusted Content Access Function

**Files:**
- Create: `supabase/functions/course-content-access/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Require signed-in bearer token**

- [x] **Step 2: Validate released content against profile, section, role, state, and time window**

- [x] **Step 3: Return only verified content metadata and `source_ref`**

## Task 3: Add Browser Gate Page

**Files:**
- Create: `assets/course-materials/information-security/app/content-api.js`
- Create: `assets/course-materials/information-security/app/content.html`
- Create: `assets/course-materials/information-security/app/content.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add content access helper**

- [x] **Step 2: Show granted or denied state in the browser**

- [x] **Step 3: Route dashboard released materials through `content.html?release=`**

## Task 4: Final Verification

- [x] **Step 1: Run content access verifier**

```powershell
node tools\verify-auth-content-access.js
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
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
