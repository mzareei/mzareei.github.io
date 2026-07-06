# TC2007B Authenticated Platform Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first authenticated course app shell for roster-aware student and teacher entry.

**Architecture:** Keep GitHub Pages as the public shell, add a static authenticated app entry page, use Supabase Auth in the browser for email OTP, and call a trusted Edge Function to load the signed-in user's profile, roles, sections, and released content context.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase JS v2 in browser, Supabase Edge Functions, existing `window.QUIZ_CONFIG`-style configuration.

---

## Task 1: Add Auth App Shell Verifier

**Files:**
- Create: `tools/verify-auth-app-shell.js`

- [x] **Step 1: Define expected app shell files**

The verifier must require:

```text
assets/course-materials/information-security/app/index.html
assets/course-materials/information-security/app/app.css
assets/course-materials/information-security/app/app.js
assets/course-materials/information-security/app/auth-api.js
assets/course-materials/information-security/platform-config.js
supabase/functions/course-auth-context/index.ts
```

- [x] **Step 2: Confirm RED before implementation**

Run:

```powershell
node tools\verify-auth-app-shell.js
```

Expected before app files:

```text
Authenticated app shell verification failed:
```

## Task 2: Add Browser Configuration

**Files:**
- Create: `assets/course-materials/information-security/platform-config.js`

- [x] **Step 1: Add safe browser configuration**

The file must define `window.TC2007B_PLATFORM_CONFIG` with `courseId`, `supabaseUrl`, `supabaseAnonKey`, and `authContextFunction`.

- [x] **Step 2: Do not include secrets**

The file must not include service-role keys or private API keys.

## Task 3: Add Static Authenticated Course App

**Files:**
- Create: `assets/course-materials/information-security/app/index.html`
- Create: `assets/course-materials/information-security/app/app.css`
- Create: `assets/course-materials/information-security/app/app.js`
- Create: `assets/course-materials/information-security/app/auth-api.js`

- [x] **Step 1: Build sign-in view**

Include institutional email input, OTP request button, OTP verification input, and status region.

- [x] **Step 2: Build signed-in dashboard shell**

Include sections for identity, course roles, section enrollments, released items, and teacher actions.

- [x] **Step 3: Wire Supabase browser auth**

Use Supabase email OTP with `shouldCreateUser: false`, verify the code, load session, and sign out.

- [x] **Step 4: Load course context**

Call `course-auth-context` with the Supabase access token.

## Task 4: Add Course Auth Context Edge Function

**Files:**
- Create: `supabase/functions/course-auth-context/index.ts`

- [x] **Step 1: Require Authorization header**

Return `401` when no bearer token is present.

- [x] **Step 2: Resolve the Supabase user**

Use the admin client to validate the token and find the authenticated user.

- [x] **Step 3: Load platform profile and memberships**

Return profile, course memberships, section enrollments, and visible release summaries.

- [x] **Step 4: Keep output minimal**

Do not return answer keys, hidden content, or unrelated student records.

## Task 5: Update Course Links And Docs

**Files:**
- Modify: `_courses/information-security.md`
- Modify: `supabase/README.md`

- [x] **Step 1: Add Course App link**

Add a visible authenticated app link near Teacher Guide and Student Guide.

- [x] **Step 2: Document the new function deploy command**

Add:

```powershell
npx supabase functions deploy course-auth-context
```

## Task 6: Final Verification

- [x] **Step 1: Run all verifiers**

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
```

- [x] **Step 2: Inspect workspace**

```powershell
git status --short
git diff --stat
```
