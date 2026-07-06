# TC2007B Authenticated Platform Phase 7B Teacher Learning Insights Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give instructors a signed-in learning-insights console that turns grades, missed topics, and exit tickets into next-class teaching signals.

**Architecture:** A trusted Edge Function verifies instructor membership, reads official gradebook records, missed-response topic tags, and exit tickets, then returns safe aggregate summaries by section, topic, activity, student, and lecture. The browser page renders the aggregate signals and teaching recommendations.

**Tech Stack:** Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Teacher Insights Verifier

**Files:**
- Create: `tools/verify-auth-teacher-insights.js`

- [x] **Step 1: Require authenticated insights surface**

Check for the insights page, browser API helper, UI script, trusted insights function, config, dashboard link, and README entries.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-teacher-insights.js
```

Expected before implementation:

```text
Authenticated teacher insights verification failed:
```

## Task 2: Add Trusted Learning Insights Function

**Files:**
- Create: `supabase/functions/course-learning-insights/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Validate instructor identity**

- [x] **Step 2: Summarize by section, topic, activity, and student**

- [x] **Step 3: Include exit-ticket trends and teaching recommendations**

## Task 3: Add Teacher Insights UI

**Files:**
- Create: `assets/course-materials/information-security/app/insights.html`
- Create: `assets/course-materials/information-security/app/insights-api.js`
- Create: `assets/course-materials/information-security/app/insights.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Render section, topic, activity, and student tables**

- [x] **Step 2: Render exit-ticket trends**

- [x] **Step 3: Link insights from teacher actions**

## Task 4: Final Verification

- [x] **Step 1: Run teacher insights verifier**

```powershell
node tools\verify-auth-teacher-insights.js
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
```
