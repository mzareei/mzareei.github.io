# TC2007B Authenticated Platform Phase 8 Hardening And Semester Operations Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated course platform reliable enough to run two real TC2007B sections for a semester, including backup habits, RLS safety checks, pre-class routines, rollover, privacy handling, and incident response.

**Architecture:** The platform keeps sensitive grade and activity records in Supabase, exposes them only through trusted Edge Functions, and uses GitHub Pages for the public/static shell. Phase 8 adds operational controls around that architecture: a semester runbook, an RLS regression check script, and README references so deployment and verification stay discoverable.

**Tech Stack:** Markdown runbook, Supabase SQL safety checks, Node.js verification.

---

## Task 1: Add Operations Verifier

**Files:**
- Create: `tools/verify-auth-operations-runbook.js`

- [x] **Step 1: Confirm RED**

Run:

```powershell
node tools\verify-auth-operations-runbook.js
```

Expected before implementation:

```text
Authenticated operations runbook verification failed:
```

## Task 2: Add Semester Operations Materials

**Files:**
- Create: `docs/course-platform/operations/semester-operations-runbook.md`
- Create: `supabase/tests/rls_auth_platform_checks.sql`
- Modify: `supabase/README.md`

- [x] **Step 1: Add backup and restore procedure**

Document manual database export, off-site backup storage, Supabase dashboard restore considerations, Point-in-Time Recovery, restore downtime, and the extra care needed for any files outside the database.

- [x] **Step 2: Add RLS test pack**

Add a SQL script that checks required grade-bearing tables exist, Row Level Security is enabled, and browser roles do not have direct table privileges.

- [x] **Step 3: Add operating procedures**

Document teacher pre-class checks, Section A and Section B routines, semester rollover, privacy/data retention notes, and incidents for wrong roster, duplicate student, missed activity, and connection failure.

## Task 3: Final Verification

- [x] **Step 1: Run operations verifier**

```powershell
node tools\verify-auth-operations-runbook.js
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
node tools\verify-auth-operations-runbook.js
```
