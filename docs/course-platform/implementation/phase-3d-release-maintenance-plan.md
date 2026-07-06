# TC2007B Authenticated Platform Phase 3D Release Maintenance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trusted service release maintenance so scheduled releases open when `opens_at` arrives and live releases close when `closes_at` arrives.

**Architecture:** A private Supabase Edge Function named `course-release-maintenance` uses the service-role client and requires `COURSE_MAINTENANCE_SECRET` through the `Authorization: Bearer <secret>` header. It checks due `content_releases`, transitions `scheduled` to `released`, transitions `live` to `closed`, and writes `release_events` rows with a null actor to show that the service performed the transition.

**Tech Stack:** Supabase Edge Functions, Supabase service client, Node.js verification.

---

## Task 1: Add Release Maintenance Verifier

**Files:**
- Create: `tools/verify-auth-release-maintenance.js`

- [x] **Step 1: Require maintenance markers**

Check for the maintenance Edge Function, protected secret, due scheduled/live queries, audit event inserts, Supabase config entry, README deploy instructions, and status documentation.

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-auth-release-maintenance.js
```

Expected before implementation:

```text
Release maintenance verification failed:
```

## Task 2: Add Release Maintenance Edge Function

**Files:**
- Create: `supabase/functions/course-release-maintenance/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Require service secret**

Reject requests that do not include `Authorization: Bearer <COURSE_MAINTENANCE_SECRET>`.

- [x] **Step 2: Open due scheduled releases**

Query `content_releases` for `scheduled` rows with `opens_at <= now` and update them to `released`.

- [x] **Step 3: Close due live releases**

Query `content_releases` for `live` rows with `closes_at <= now` and update them to `closed`.

- [x] **Step 4: Audit every transition**

Insert a `release_events` row for each service transition with `actor_profile_id` set to null and a clear reason.

## Task 3: Update Documentation

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Add deploy and secret instructions**

Document `COURSE_MAINTENANCE_SECRET`, the deployment command, and the local verifier command.

- [x] **Step 2: Record implemented behavior**

Add the service-maintenance behavior to the current implementation status file.

## Task 4: Final Verification

- [x] **Step 1: Run focused verifier**

```powershell
node tools\verify-auth-release-maintenance.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-institutional-email-guard.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-release-maintenance.js
node tools\verify-auth-roster-management.js
node tools\verify-auth-role-permissions.js
node tools\verify-auth-ta-release-guard.js
node tools\verify-auth-content-access.js
node tools\verify-auth-scheduled-release-access.js
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-speed-bonus-policy.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-quiz-compatibility.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-export-evidence.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-records.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
