# TC2007B Authenticated Platform Phase 3E Content Library Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let instructors prepare authenticated course content records before release, including sensitive or graded material that should be controlled by Supabase release states instead of only public GitHub Pages links.

**Architecture:** A trusted `course-content-library` Edge Function validates the signed-in instructor, lists existing `content_items`, and saves new or updated content records. When requested, it also creates or updates an initial `draft` `content_releases` row for a section/session and writes release/audit records. The teacher page gives a compact form for content metadata and draft-release scope.

**Tech Stack:** Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Content Library Verifier

**Files:**
- Create: `tools/verify-auth-content-library.js`

- [x] **Step 1: Require instructor-only content authoring**

Check for the content-library function, teacher UI, browser API helper, config entry, dashboard link, README entries, and implementation status note.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-content-library.js
```

Expected before implementation:

```text
Authenticated Content Library verification failed:
```

## Task 2: Add Trusted Content Library Function

**Files:**
- Create: `supabase/functions/course-content-library/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Validate instructor identity**

Require an active `platform_owner` or `instructor` course membership. Teaching assistants cannot author content records.

- [x] **Step 2: Save content item metadata**

Support create/update for content type, slug, title, summary, source kind, source reference, sensitive-content flag, and default points.

- [x] **Step 3: Create optional draft release**

When requested, create or update a `draft` content release for the chosen section/session and write `release_events` plus `audit_log` records.

## Task 3: Add Teacher Content Library UI

**Files:**
- Create: `assets/course-materials/information-security/app/content-library.html`
- Create: `assets/course-materials/information-security/app/content-library.js`
- Create: `assets/course-materials/information-security/app/content-library-api.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Render content records**

Show content type, title, source, sensitive flag, draft release count, and last update.

- [x] **Step 2: Save content records**

Let instructors create/edit content records and optionally create a draft release scoped to section/session.

- [x] **Step 3: Link from teacher dashboard**

Add Content Library to the authenticated teacher action list.

## Task 4: Final Verification

- [x] **Step 1: Run Content Library verifier**

```powershell
node tools\verify-auth-content-library.js
```

- [x] **Step 2: Run platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-content-library.js
node tools\verify-release-engine.js
node tools\verify-auth-content-access.js
```
