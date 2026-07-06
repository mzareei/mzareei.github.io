# TC2007B Authenticated Platform Phase 1C Role Permissions Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the teaching assistant role real and consistent with the course spec: TAs can help run section-scoped classroom tools and review section data, but cannot import rosters, change release states, or change final grades.

**Architecture:** Existing trusted Edge Functions keep table access server-side. Instructor/platform-owner users keep course-wide permissions. Teaching assistants are accepted for section-scoped tools only when they have active `section_enrollments` rows with role `teaching_assistant`. Grade-changing actions remain guarded by an instructor-only check.

**Tech Stack:** Supabase Edge Functions and Node.js verification.

---

## Task 1: Add Role Permission Verifier

**Files:**
- Create: `tools/verify-auth-role-permissions.js`

- [x] **Step 1: Confirm RED**

Run:

```powershell
node tools\verify-auth-role-permissions.js
```

Expected before implementation:

```text
Authenticated role permission verification failed:
```

## Task 2: Implement Teaching Assistant Permissions

**Files:**
- Modify: `supabase/functions/course-release-management/index.ts`
- Modify: `supabase/functions/course-session-management/index.ts`
- Modify: `supabase/functions/course-gradebook-summary/index.ts`
- Modify: `supabase/functions/course-learning-insights/index.ts`
- Modify: `supabase/README.md`

- [x] **Step 1: Add teaching assistant support for section-scoped tools**

Allow TAs with active section enrollment to list assigned releases, use permitted section-scoped session tools, review gradebook rows, and view learning insights only for assigned sections.

- [x] **Step 2: Keep grade-changing and roster actions instructor-only**

Keep roster import limited to platform owners/instructors. Keep gradebook adjustments and score locking limited to platform owners/instructors.

## Task 3: Final Verification

- [x] **Step 1: Run role permission verifier**

```powershell
node tools\verify-auth-role-permissions.js
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
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
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
