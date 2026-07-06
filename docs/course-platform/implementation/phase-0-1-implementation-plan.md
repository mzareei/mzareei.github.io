# TC2007B Authenticated Platform Phase 0-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reliable implementation baseline and add the authenticated course foundation tables required by the TC2007B platform spec.

**Architecture:** Phase 0 keeps the existing course verifier trustworthy on Windows clones. Phase 1 adds Supabase schema foundations for institutional identity, sections, roster membership, class sessions, and release control while preserving the existing quiz pilot tables.

**Tech Stack:** Jekyll/GitHub Pages static course shell, Supabase Postgres migrations, Supabase Auth identity model, Node.js verification scripts.

---

## Scope

This plan implements the first safe slice of `docs/course-platform/tc2007b-authenticated-course-platform-spec.md`.

It does not build the full authenticated frontend yet. It prepares the database and verification base needed before student sign-in, teacher release controls, gradebook exports, and live classroom continuation can be safely implemented.

## Task 1: Repair Current Course Verifier On Windows

**Files:**
- Modify: `tools/verify-course-platform.js`

- [x] **Step 1: Verify the current failure**

Run:

```powershell
node tools\verify-course-platform.js
```

Expected before the fix on a CRLF Windows checkout:

```text
Error: Could not parse const demoQuestionBanks =
```

- [x] **Step 2: Normalize parser line endings**

Modify `parseObjectAfter` so it can find markers regardless of LF or CRLF line endings:

```javascript
function parseObjectAfter(fileText, marker, endMarker) {
  const normalized = fileText.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(marker);
  const end = normalized.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not parse ${marker.trim()}`);
  }
  const objectSource = normalized.slice(start + marker.length, end).trim().replace(/;$/, "");
  return Function(`return (${objectSource});`)();
}
```

- [x] **Step 3: Verify the existing course platform**

Run:

```powershell
node tools\verify-course-platform.js
```

Expected after the fix:

```text
Course platform verification passed.
```

## Task 2: Add Authenticated Platform Schema Verifier

**Files:**
- Create: `tools/verify-auth-course-platform.js`

- [x] **Step 1: Write a verifier before adding the migration**

Create a Node.js verifier that fails until `supabase/migrations/0004_authenticated_course_platform.sql` exists and contains the required foundation tables, RLS statements, release states, and class session states.

The verifier must check these table names:

```javascript
const requiredTables = [
  "profiles",
  "courses",
  "course_memberships",
  "course_sections",
  "section_enrollments",
  "roster_imports",
  "class_sessions",
  "content_items",
  "content_releases",
  "release_events"
];
```

The verifier must check these release states:

```javascript
const requiredReleaseStates = [
  "draft",
  "scheduled",
  "released",
  "live",
  "paused",
  "review_only",
  "closed",
  "archived"
];
```

The verifier must check these class session states:

```javascript
const requiredSessionStates = [
  "planned",
  "open",
  "live",
  "paused",
  "continued",
  "closed",
  "cancelled"
];
```

- [x] **Step 2: Run verifier and confirm RED**

Run:

```powershell
node tools\verify-auth-course-platform.js
```

Expected before migration:

```text
Authenticated platform verification failed:
- Missing migration: supabase/migrations/0004_authenticated_course_platform.sql
```

## Task 3: Add Phase 1 Supabase Migration

**Files:**
- Create: `supabase/migrations/0004_authenticated_course_platform.sql`

- [x] **Step 1: Create the foundation schema**

Add tables for profiles, courses, memberships, sections, enrollments, roster imports, class sessions, content items, content releases, and release events.

- [x] **Step 2: Add constraints and indexes**

Include constraints for role names, profile status, section status, content release states, and class session states.

- [x] **Step 3: Enable RLS and revoke browser table access**

Enable RLS on each new table and revoke direct `anon` and `authenticated` access. Public browser access will later be reintroduced through explicit policies and trusted Edge Functions.

- [x] **Step 4: Verify GREEN**

Run:

```powershell
node tools\verify-auth-course-platform.js
```

Expected:

```text
Authenticated platform verification passed.
```

## Task 4: Update Backend Documentation

**Files:**
- Modify: `supabase/README.md`

- [x] **Step 1: Add the new migration to deploy order**

Mention `migrations/0004_authenticated_course_platform.sql` after the existing quiz, exit ticket, and portfolio migrations.

- [x] **Step 2: Document the new verifier**

Add:

```powershell
node tools/verify-auth-course-platform.js
```

Expected:

```text
Authenticated platform verification passed.
```

## Task 5: Final Verification

- [x] **Step 1: Run both verification scripts**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
```

- [x] **Step 2: Inspect changed files**

```powershell
git status --short
git diff --stat
```

- [x] **Step 3: Commit instructions for user**

If Codex cannot write to `.git`, provide PowerShell commands for the user to stage, commit, and push the implementation slice.
