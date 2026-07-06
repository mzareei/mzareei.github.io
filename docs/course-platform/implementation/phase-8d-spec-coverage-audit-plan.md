# Phase 8D Spec Coverage Audit Plan

Goal: Create a conservative requirement-by-requirement audit that maps the original authenticated course platform spec to repository evidence and live Supabase proof that still has to be gathered.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-spec-coverage-audit.js`.
  - Run it before implementation and confirm it fails because the coverage audit and documentation links are missing.

- [x] **Step 1: Add spec coverage audit**
  - Add `docs/course-platform/implementation/spec-coverage-audit.md`.
  - Map all 10 success criteria to repository evidence and live proof required.
  - Map implementation phases 0 through 8 to repository evidence and live proof required.
  - Explicitly state that local verifiers do not replace live Supabase integration testing.

- [x] **Step 2: Link audit from status and README**
  - Link the audit from `docs/course-platform/implementation/current-implementation-status.md`.
  - Link the audit from `supabase/README.md`.
  - Add `node tools\verify-auth-spec-coverage-audit.js` to the local verifier list.

- [x] **Step 1: Run spec coverage verifier**
  - Run `node tools\verify-auth-spec-coverage-audit.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the spec coverage verifier.
