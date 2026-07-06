# Phase 6G Weighted Grade Summary Plan

Goal: Use configured gradebook category weights and drop-lowest rules in teacher and student progress summaries.

## Tasks

- [x] **Step 1: Add focused weighted-summary verifier**
  - Add `tools/verify-auth-weighted-grade-summary.js`.
  - Confirm it fails before implementation because weighted totals are not calculated or displayed.

- [x] **Step 2: Add weighted grade calculations to trusted functions**
  - Extend `course-gradebook-summary` to return `weighted_summary` for the currently filtered gradebook rows.
  - Extend `course-student-progress` to return `weighted_summary` for the signed-in student's official scores.
  - Honor `drop_lowest_count` inside each category before averaging that category.

- [x] **Step 3: Show weighted summaries in teacher and student views**
  - Add weighted course cards to the teacher gradebook summary.
  - Add category-level weighted summary cards to the teacher gradebook view.
  - Add weighted course and category summary signals to the student progress page.

- [x] **Step 4: Run focused and full verification**
  - Run `node tools\verify-auth-weighted-grade-summary.js`.
  - Run the full platform verifier suite.
