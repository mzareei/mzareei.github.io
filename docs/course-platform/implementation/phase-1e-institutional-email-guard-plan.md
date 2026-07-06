# TC2007B Authenticated Platform Phase 1E Institutional Email Guard Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce approved institutional email identity in trusted code, not only in browser text or roster import validation.

**Architecture:** A shared Edge Function identity helper validates the signed-in Supabase email domain and confirms that the linked roster profile email matches the authenticated email. Student-facing trusted functions call this helper before returning released content, starting activities, saving exit tickets, saving portfolio entries, or showing progress. The browser sign-in form also warns students before requesting an OTP from an unapproved domain.

**Tech Stack:** Supabase Edge Functions, static authenticated app JavaScript, Node.js verification.

---

## Task 1: Add Institutional Email Guard Verifier

**Files:**
- Create: `tools/verify-auth-institutional-email-guard.js`

- [x] **Step 1: Require trusted identity markers**

Check for a shared identity helper, server-side calls from student-facing functions, browser pre-checks, and local verification docs.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-institutional-email-guard.js
```

Expected before implementation:

```text
Authenticated institutional email guard verification failed:
```

## Task 2: Add Trusted Identity Guard

**Files:**
- Create: `supabase/functions/_shared/identity.ts`
- Modify: `supabase/functions/course-auth-context/index.ts`
- Modify: `supabase/functions/course-content-access/index.ts`
- Modify: `supabase/functions/course-activity-attempt/index.ts`
- Modify: `supabase/functions/course-exit-ticket/index.ts`
- Modify: `supabase/functions/course-portfolio-entry/index.ts`
- Modify: `supabase/functions/course-student-progress/index.ts`

- [x] **Step 1: Reject unapproved institutional email domains**

- [x] **Step 2: Require authenticated email to match the linked roster profile**

- [x] **Step 3: Apply the guard before student-facing access or submissions**

## Task 3: Add Browser Pre-Check

**Files:**
- Modify: `assets/course-materials/information-security/app/app.js`

- [x] **Step 1: Read approved domains from platform config**

- [x] **Step 2: Warn before OTP send/verify when email is outside the allowed domains**

## Task 4: Update Documentation

**Files:**
- Modify: `supabase/README.md`
- Modify: `docs/course-platform/implementation/current-implementation-status.md`

- [x] **Step 1: Add the institutional email verifier to local verification docs**

- [x] **Step 2: Record the implemented behavior in course-platform status**

## Task 5: Final Verification

- [x] **Step 1: Run institutional email guard verifier**

```powershell
node tools\verify-auth-institutional-email-guard.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-institutional-email-guard.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
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
