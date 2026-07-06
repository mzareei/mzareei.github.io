# Phase 8E Live Evidence Packet Plan

Goal: Add a private-fillable evidence template so the teacher can record the live Supabase proof required before the authenticated platform is used for grade-bearing work.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-live-evidence-packet.js`.
  - Run it before implementation and confirm it fails because the evidence packet and documentation links are missing.

- [x] **Step 1: Add live evidence packet**
  - Add `docs/course-platform/operations/live-supabase-evidence-packet.md`.
  - Include project metadata, migration evidence, seed evidence, Auth/redirect evidence, Edge Function deployment evidence, browser configuration evidence, RLS evidence, roster evidence, teacher and student smoke tests, section isolation, direct URL access-denied proof, QR-to-gradebook proof, gradebook export evidence, backup evidence, and Go/No-Go decision.
  - Make clear that completed copies with student data or project details should stay in private teacher storage and not be committed.

- [x] **Step 2: Link evidence packet from launch and audit docs**
  - Link the packet from `docs/course-platform/operations/supabase-launch-checklist.md`.
  - Link the packet from `docs/course-platform/implementation/spec-coverage-audit.md`.
  - Add the verifier to implementation status and Supabase README.

- [x] **Step 1: Run live evidence verifier**
  - Run `node tools\verify-auth-live-evidence-packet.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the live evidence packet verifier.
