# Phase 7F Student Portfolio Export Plan

Goal: Let a signed-in student export their own portfolio evidence as a local JSON record without exposing other students or private quiz answer data.

## Tasks

- [x] **Step 1: Add focused portfolio export verifier**
  - Add `tools/verify-auth-portfolio-export.js`.
  - Confirm it fails before implementation because the export action, UI, and docs are missing.

- [x] **Step 2: Add trusted export action**
  - Extend `supabase/functions/course-portfolio-entry/index.ts` with `export_entries`.
  - Use the existing authenticated student profile and section enrollment checks.
  - Return only the signed-in student's portfolio entries, catalog labels, sections, and identity fields needed for a personal record.

- [x] **Step 3: Add student export controls**
  - Add an `Export portfolio` button to `assets/course-materials/information-security/app/portfolio.html`.
  - Add `exportPortfolioEntries` to `portfolio-api.js`.
  - Add JSON download behavior to `portfolio.js`.

- [x] **Step 4: Run focused and full verification**
  - Run `node tools\verify-auth-portfolio-export.js`.
  - Run the full platform verifier suite.
