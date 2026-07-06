# Phase 8G Roster Import Packet Plan

Goal: Make the live roster-import gate easier and safer by adding a fake-data CSV template and a teacher guide that matches the authenticated roster importer.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-roster-import-packet.js`.
  - Run it before implementation and confirm it fails because the roster guide, CSV template, and documentation links are missing.

- [x] **Step 1: Add safe roster template**
  - Add `docs/course-platform/operations/tc2007b-roster-template.csv`.
  - Include the canonical importer header and fake sample rows for students, teaching assistant, instructor, and observer roles.
  - Include Section A and Section B examples.

- [x] **Step 2: Add roster import guide**
  - Add `docs/course-platform/operations/roster-import-guide.md`.
  - Document required fields, allowed aliases, accepted roles, preview/apply flow, common rejection reasons, and private evidence to keep.
  - Warn not to commit real rosters or student data.

- [x] **Step 3: Link roster packet from launch docs**
  - Link the guide and CSV template from the Supabase launch checklist.
  - Add roster-template evidence fields to the live evidence packet.
  - Add the verifier to implementation status and Supabase README.

- [x] **Step 1: Run roster packet verifier**
  - Run `node tools\verify-auth-roster-import-packet.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the roster import packet verifier.
