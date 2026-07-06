# Phase 6F Gradebook Settings Plan

Goal: Let instructors configure gradebook categories before and during the semester while keeping teaching assistants read/export-only.

## Tasks

- [x] **Step 1: Add focused gradebook settings verifier**
  - Add `tools/verify-auth-gradebook-settings.js`.
  - Confirm it fails before implementation because category settings are missing.

- [x] **Step 2: Add instructor-only category settings action**
  - Extend `course-gradebook-summary` with `save_category`.
  - Reuse the existing instructor permission check.
  - Validate category name, weight percent, drop-lowest count, and status.
  - Write an `audit_log` row when a category is created or updated.

- [x] **Step 3: Add teacher category settings controls**
  - Add category name, weight, drop-lowest, status, save, and new-category controls to `gradebook.html`.
  - Add `saveGradebookCategory` to `gradebook-api.js`.
  - Add category settings rendering and save behavior to `gradebook.js`.

- [x] **Step 4: Run focused and full verification**
  - Run `node tools\verify-auth-gradebook-settings.js`.
  - Run the full platform verifier suite.
