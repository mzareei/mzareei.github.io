# TC2007B Authenticated Platform Phase 7D Authenticated Exit Tickets Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move exit tickets from informal typed-name records into authenticated, roster-linked student reflections while preserving legacy summaries during the transition.

**Architecture:** A new `exit_tickets` table stores signed-in reflections by course, section, optional class session, optional content item, and profile. A trusted `course-exit-ticket` Edge Function verifies the signed-in student, scopes section choices to active enrollments, and supports context/list plus submit actions. Teacher learning insights merge authenticated `exit_tickets` with legacy `course_exit_tickets` while the course transitions.

**Tech Stack:** Supabase SQL migration, Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Authenticated Exit-Ticket Verifier

**Files:**
- Create: `tools/verify-auth-exit-tickets.js`

- [x] **Step 1: Confirm RED**

Run:

```powershell
node tools\verify-auth-exit-tickets.js
```

Expected before implementation:

```text
Authenticated exit-ticket verification failed:
```

## Task 2: Add Authenticated Exit-Ticket Storage And Function

**Files:**
- Create: `supabase/migrations/0008_authenticated_exit_tickets.sql`
- Create: `supabase/functions/course-exit-ticket/index.ts`
- Modify: `supabase/functions/course-learning-insights/index.ts`
- Modify: `supabase/tests/rls_auth_platform_checks.sql`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`

- [x] **Step 1: Create authenticated exit_tickets table**

Create `exit_tickets` linked to course, section, class session, profile, and optional content item. Enable RLS and revoke direct browser access.

- [x] **Step 2: Add signed-in submit and list actions**

Add `list_my_tickets` and `submit_ticket` actions that require an active signed-in profile and active student enrollment.

- [x] **Step 3: Include authenticated exit tickets in teacher insights**

Merge authenticated `exit_tickets` with legacy `course_exit_tickets` so trends stay continuous during migration.

## Task 3: Add Student Exit-Ticket UI

**Files:**
- Create: `assets/course-materials/information-security/app/exit-ticket.html`
- Create: `assets/course-materials/information-security/app/exit-ticket-api.js`
- Create: `assets/course-materials/information-security/app/exit-ticket.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add student exit ticket page**

Let signed-in students choose section/session, set confidence, enter one clear idea and one muddy point, submit, and review their recent tickets.

## Task 4: Final Verification

- [x] **Step 1: Run authenticated exit-ticket verifier**

```powershell
node tools\verify-auth-exit-tickets.js
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
