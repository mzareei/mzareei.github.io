# TC2007B Authenticated Platform Phase 3 Release Engine Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first teacher release console and trusted release-management function so instructors can list and change release states for TC2007B content.

**Architecture:** The browser page uses the existing Supabase OTP session and calls a new Edge Function. The Edge Function validates the bearer token, confirms an instructor/platform owner course membership, lists content releases, enforces allowed state transitions, updates release rows, and writes `release_events`.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS v2, Supabase Edge Functions, Node.js verification scripts.

---

## Task 1: Add Release Engine Verifier

**Files:**
- Create: `tools/verify-release-engine.js`

- [x] **Step 1: Define expected files and behavior markers**

The verifier must require:

```text
assets/course-materials/information-security/app/releases.html
assets/course-materials/information-security/app/releases.js
assets/course-materials/information-security/app/release-api.js
supabase/functions/course-release-management/index.ts
```

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-release-engine.js
```

Expected before implementation:

```text
Release engine verification failed:
```

## Task 2: Add Release Management Edge Function

**Files:**
- Create: `supabase/functions/course-release-management/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Require bearer auth**

Return `401` when the Authorization header is missing or invalid.

- [x] **Step 2: Authorize instructor roles**

Allow only `platform_owner` or `instructor` active course memberships.

- [x] **Step 3: List releases**

Return content release rows with content title, content type, section, session, state, and timing fields.

- [x] **Step 4: Update release state**

Validate allowed transitions and update `content_releases`.

- [x] **Step 5: Audit transitions**

Insert a `release_events` row for every state change.

## Task 3: Add Teacher Release Console

**Files:**
- Create: `assets/course-materials/information-security/app/releases.html`
- Create: `assets/course-materials/information-security/app/releases.js`
- Create: `assets/course-materials/information-security/app/release-api.js`
- Modify: `assets/course-materials/information-security/app/app.js`

- [x] **Step 1: Add release console markup**

Include release table, state selector, reason input, refresh button, and update button.

- [x] **Step 2: Add release API helper**

Call `course-release-management` with `action: "list"` and `action: "update_state"`.

- [x] **Step 3: Render release rows**

Show title, type, scope, state, open/close times, and update controls.

- [x] **Step 4: Link teacher actions**

Instructor users should see a link to the release console from the Course App dashboard.

## Task 4: Final Verification

- [x] **Step 1: Run release verifier**

```powershell
node tools\verify-release-engine.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
```
