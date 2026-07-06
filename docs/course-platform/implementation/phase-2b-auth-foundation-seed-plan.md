# TC2007B Authenticated Foundation Seed Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe demo seed for authenticated course structure so the Course App can load TC2007B sections, content items, and release rows after profiles/enrollments exist.

**Architecture:** Keep student identity out of the seed. Seed only course metadata, two course sections, content items, and release states for early-course materials.

**Tech Stack:** Supabase SQL seed, Node.js verifier.

---

## Task 1: Add Seed Verifier

**Files:**
- Create: `tools/verify-auth-foundation-seed.js`

- [x] **Step 1: Write verifier**

Check that `supabase/seed/tc2007b_auth_foundation_demo.sql` contains course, sections, content items, and content releases.

- [x] **Step 2: Confirm RED**

Run:

```powershell
node tools\verify-auth-foundation-seed.js
```

Expected before seed:

```text
Authenticated foundation seed verification failed:
```

## Task 2: Add Seed

**Files:**
- Create: `supabase/seed/tc2007b_auth_foundation_demo.sql`

- [x] **Step 1: Insert course**

Insert `tc2007b`.

- [x] **Step 2: Insert two sample sections**

Insert `A` and `B` as section codes.

- [x] **Step 3: Insert content items**

Insert initial app-visible lectures, missions, and review tools.

- [x] **Step 4: Insert release rows**

Release Week 1 items and keep later items as draft/scheduled examples.

## Task 3: Documentation And Verification

**Files:**
- Modify: `supabase/README.md`

- [x] **Step 1: Document seed**

Mention the new authenticated foundation seed after migration `0004`.

- [x] **Step 2: Run verifier**

```powershell
node tools\verify-auth-foundation-seed.js
```
