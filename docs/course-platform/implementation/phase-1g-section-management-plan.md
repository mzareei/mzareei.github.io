# Phase 1G Section Management Plan

Goal: Let instructors create and update course sections before roster import, session planning, and release setup.

## Tasks

- [x] **Step 1: Add focused section-management verifier**
  - Add `tools/verify-auth-section-management.js`.
  - Confirm it fails before implementation because the function, page, config, and docs are missing.

- [x] **Step 2: Add instructor-only section management function**
  - Add `course-section-management`.
  - Require a signed-in `platform_owner` or `instructor` course membership.
  - Support `list_sections` and `save_section`.
  - Validate section code, name, meeting pattern, campus, and status.
  - Write `audit_log` rows when sections are created or updated.

- [x] **Step 3: Add teacher section management page**
  - Add `sections.html`, `sections.js`, and `section-api.js`.
  - Add controls for section code, name, meeting pattern, campus, and status.
  - Link section management from the teacher dashboard.

- [x] **Step 4: Run focused and full verification**
  - Run `node tools\verify-auth-section-management.js`.
  - Run the full platform verifier suite.
