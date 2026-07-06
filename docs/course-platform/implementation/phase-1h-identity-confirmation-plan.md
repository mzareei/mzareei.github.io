# TC2007B Authenticated Platform Phase 1H Identity Confirmation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let rostered students confirm that the signed-in course identity shows the correct name, institutional email, student ID, and section before they submit grade-bearing work.

**Architecture:** A new `profile_identity_confirmations` table stores one confirmation row per course/profile. The trusted `course-identity-confirmation` Edge Function validates Supabase Auth, institutional email, linked roster profile, and active student section enrollment before allowing the student to confirm or report an identity issue. The browser page shows roster identity details and writes only through the trusted function.

**Tech Stack:** Supabase migration, Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Identity Confirmation Verifier

**Files:**
- Create: `tools/verify-auth-identity-confirmation.js`

- [x] **Step 1: Require durable identity confirmation**

Check for the migration, RLS safety coverage, trusted function, student UI, dashboard link, config entry, README deployment notes, and implementation status note.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-identity-confirmation.js
```

Expected before implementation:

```text
Authenticated identity confirmation verification failed:
```

## Task 2: Add Identity Confirmation Storage

**Files:**
- Create: `supabase/migrations/0010_profile_identity_confirmations.sql`
- Modify: `supabase/tests/rls_auth_platform_checks.sql`

- [x] **Step 1: Create confirmation table**

Store `course_id`, `profile_id`, status, optional issue note, confirmation timestamp, and audit-friendly timestamps.

- [x] **Step 2: Harden browser access**

Enable Row Level Security and revoke direct table access from browser roles.

## Task 3: Add Trusted Identity Confirmation Function

**Files:**
- Create: `supabase/functions/course-identity-confirmation/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Validate signed-in roster identity**

Use the shared institutional email guard and require an active linked student profile.

- [x] **Step 2: Confirm or report identity issue**

Support `confirm_identity` and `report_identity_issue`, writing both the confirmation table and `audit_log`.

## Task 4: Add Student Identity UI

**Files:**
- Create: `assets/course-materials/information-security/app/identity.html`
- Create: `assets/course-materials/information-security/app/identity.js`
- Create: `assets/course-materials/information-security/app/identity-api.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Show roster identity**

Render name, email, student ID, section enrollments, and current confirmation state.

- [x] **Step 2: Add confirm and issue-report actions**

Let students confirm correct identity or report a mismatch with a short note.

## Task 5: Final Verification

- [x] **Step 1: Run identity confirmation verifier**

```powershell
node tools\verify-auth-identity-confirmation.js
```

- [x] **Step 2: Run platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-identity-confirmation.js
node tools\verify-auth-institutional-email-guard.js
```
