# Phase 8H Post-Launch Sanity SQL Plan

Goal: Add aggregate SQL checks that the teacher can run after the live Supabase smoke test to confirm roster, release, attempt, gradebook, exit-ticket, portfolio, audit, and RLS evidence without selecting individual student names or emails by default.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-post-launch-sanity-sql.js`.
  - Run it before implementation and confirm it fails because the SQL file and documentation links are missing.

- [x] **Step 1: Add post-launch SQL sanity checks**
  - Add `supabase/tests/post_launch_smoke_sanity_checks.sql`.
  - Include aggregate summaries for course metadata, roster, section enrollments, releases, activity instances, attempts, responses, gradebook scores, exit tickets, portfolio entries, audit events, and RLS state.
  - Avoid selecting individual student names or institutional emails by default.

- [x] **Step 2: Link SQL checks from launch/evidence docs**
  - Link the SQL file from the launch checklist.
  - Link the SQL file from the PowerShell command sheet.
  - Add post-launch SQL evidence rows to the live evidence packet.
  - Add the verifier to implementation status and Supabase README.

- [x] **Step 1: Run post-launch SQL verifier**
  - Run `node tools\verify-auth-post-launch-sanity-sql.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the post-launch SQL verifier.
