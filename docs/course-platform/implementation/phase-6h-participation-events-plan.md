# TC2007B Authenticated Platform Phase 6H Participation Events Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers record low-stakes classroom participation evidence under authenticated student identity, section, and class-session context.

**Architecture:** A trusted `course-participation-events` Edge Function validates a teacher or teaching-assistant session, scopes assistants to assigned sections, lists rostered students/sessions, records `participation_events`, and writes `audit_log` evidence. The teacher UI provides a quick form for attendance, pulse responses, contributions, and approved device/makeup exceptions.

**Tech Stack:** Supabase Edge Function, static HTML/CSS/JavaScript, Node.js verification.

---

## Task 1: Add Participation Events Verifier

**Files:**
- Create: `tools/verify-auth-participation-events.js`

- [x] **Step 1: Require trusted participation recording**

Check for the participation function, teacher UI, browser API helper, config entry, dashboard link, README entry, and status note.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-participation-events.js
```

Expected before implementation:

```text
Authenticated participation events verification failed:
```

## Task 2: Add Trusted Participation Function

**Files:**
- Create: `supabase/functions/course-participation-events/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1: Validate teacher scope**

Allow platform owners and instructors for all course sections. Allow teaching assistants only for assigned active sections.

- [x] **Step 2: List participation context**

Return scoped sections, class sessions, rostered students, and recent participation events.

- [x] **Step 3: Record participation evidence**

Insert `participation_events` for a rostered student in the selected section/session and write an `audit_log` row.

## Task 3: Add Teacher Participation UI

**Files:**
- Create: `assets/course-materials/information-security/app/participation.html`
- Create: `assets/course-materials/information-security/app/participation.js`
- Create: `assets/course-materials/information-security/app/participation-api.js`
- Modify: `assets/course-materials/information-security/app/app.js`
- Modify: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Render scoped roster and sessions**

Populate section, session, and student controls from the trusted context response.

- [x] **Step 2: Record participation events**

Let teachers record event type, points, and a short note.

- [x] **Step 3: Link from teacher dashboard**

Add the participation recorder to the authenticated teacher action list.

## Task 4: Final Verification

- [x] **Step 1: Run participation verifier**

```powershell
node tools\verify-auth-participation-events.js
```

- [x] **Step 2: Run platform verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-participation-events.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-teacher-insights.js
```
