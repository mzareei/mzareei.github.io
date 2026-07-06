# TC2007B Authenticated Platform Phase 1B Roster Management Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the identity foundation usable for real students by adding teacher roster import/validation and safe email-based profile claiming after institutional OTP sign-in.

**Architecture:** A trusted `course-roster-management` Edge Function validates and applies roster rows into `profiles`, `course_memberships`, `section_enrollments`, and `roster_imports`. The authenticated Course App gains a teacher Roster Import page. `course-auth-context` can link a signed-in auth user to an existing roster profile when the institutional email matches and the profile is not already claimed.

**Tech Stack:** Supabase Edge Function, existing authenticated app HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Roster Management Verifier

**Files:**
- Create: `tools/verify-auth-roster-management.js`

- [x] **Step 1: Confirm RED**

Run:

```powershell
node tools\verify-auth-roster-management.js
```

Expected before implementation:

```text
Authenticated roster management verification failed:
```

## Task 2: Add Trusted Roster Actions

**Files:**
- Create: `supabase/functions/course-roster-management/index.ts`
- Modify: `supabase/functions/course-auth-context/index.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Add roster preview and apply actions**

Add instructor-only `preview_roster`, `apply_roster`, and `list_roster` actions with institutional domain checks, duplicate detection, section validation, accepted counts, and rejected rows.

- [x] **Step 2: Link signed-in users to roster profiles by institutional email**

When a signed-in user has no linked `profiles.auth_user_id`, claim the roster profile with the matching institutional email if it is active/invited and unclaimed.

## Task 3: Add Teacher Roster UI

**Files:**
- Create: `assets/course-materials/information-security/app/roster.html`
- Create: `assets/course-materials/information-security/app/roster-api.js`
- Create: `assets/course-materials/information-security/app/roster.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add teacher roster import screen**

Support CSV paste, allowed domain entry, preview, apply, and current roster display.

## Task 4: Final Verification

- [x] **Step 1: Run roster management verifier**

```powershell
node tools\verify-auth-roster-management.js
```

- [x] **Step 2: Run all platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-roster-management.js
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-operations-runbook.js
```
