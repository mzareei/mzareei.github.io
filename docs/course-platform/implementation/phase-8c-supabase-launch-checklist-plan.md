# Phase 8C Supabase Launch Checklist Plan

Goal: Give the teacher one clear launch path for moving the authenticated course platform from repository implementation to a live Supabase project that is safe enough to smoke test before grade-bearing use.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-supabase-launch-checklist.js`.
  - Run it before implementation and confirm it fails because the launch checklist, deployment manifest, and documentation references are missing.

- [x] **Step 1: Add deployment manifest**
  - Add `supabase/course-platform-deployment-manifest.json`.
  - List every migration, safe seed, Edge Function, browser configuration file, required secret, Auth setting, RLS check, and live smoke test.

- [x] **Step 2: Add teacher-facing launch checklist**
  - Add `docs/course-platform/operations/supabase-launch-checklist.md`.
  - Include project setup, Auth email OTP, approved institutional email domain, migrations, seeds, Edge Function deploy commands, browser-safe configuration, RLS safety checks, teacher/student smoke test, backups, and rollback stop points.

- [x] **Step 3: Link launch checklist from operations docs**
  - Link the checklist from the semester operations runbook.
  - Link the checklist and manifest from `supabase/README.md`.
  - Add the verifier to local verification docs.

- [x] **Step 1: Run launch checklist verifier**
  - Run `node tools\verify-auth-supabase-launch-checklist.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the new launch checklist verifier.
