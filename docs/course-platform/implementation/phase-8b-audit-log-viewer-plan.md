# Phase 8B Audit Log Viewer Plan

Goal: Give instructors a course-scoped audit view for sensitive grading, roster, activity, and release operations.

## Tasks

- [x] **Step 1: Add focused audit-log viewer verifier**
  - Add `tools/verify-auth-audit-log-viewer.js`.
  - Confirm it fails before implementation because the function, page, config, and docs are missing.

- [x] **Step 2: Add instructor-only audit log function**
  - Add `course-audit-log`.
  - Require a signed-in `platform_owner` or `instructor` course membership.
  - Return recent `audit_log` rows for the selected course with safe actor profile labels.

- [x] **Step 3: Add teacher audit log page**
  - Add `audit.html`, `audit.js`, and `audit-api.js`.
  - Add target type, action, and limit filters.
  - Link the page from the teacher dashboard for course instructors.

- [x] **Step 4: Run focused and full verification**
  - Run `node tools\verify-auth-audit-log-viewer.js`.
  - Run the full platform verifier suite.
