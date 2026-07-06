# Phase 8I Semester Setup Decisions Plan

Goal: Add a teacher-facing semester setup decisions packet that turns the spec's open decisions into a concrete pre-launch checklist before grade-bearing use.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-semester-setup-decisions.js`.
  - Run it before implementation and confirm it fails because the decisions packet and documentation links are missing.

- [x] **Step 1: Add semester setup decisions packet**
  - Add `docs/course-platform/operations/semester-setup-decisions.md`.
  - Cover institutional email domains, teaching assistants, grading weights, content storage/privacy, LMS import format, data retention, release defaults, speed bonus policy, backup/export location, and go/no-go approval.
  - Make clear that completed copies are private teacher records and should not be committed.

- [x] **Step 2: Link decisions packet from launch and evidence docs**
  - Link the packet from the Supabase launch checklist.
  - Add semester setup evidence rows to the live evidence packet.
  - Add the packet and verifier to implementation status and Supabase README.

- [x] **Step 1: Run semester setup verifier**
  - Run `node tools\verify-auth-semester-setup-decisions.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the semester setup decisions verifier.
