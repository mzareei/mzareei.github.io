# Phase 8F PowerShell Launch Commands Plan

Goal: Give the teacher a copy-paste friendly PowerShell command sheet that is tied to the deployment manifest and supports the live launch checklist without automating private or risky steps.

## Tasks

- [x] **Step 1: Confirm RED**
  - Add `tools/verify-auth-powershell-launch-commands.js`.
  - Run it before implementation and confirm it fails because the command sheet and documentation links are missing.

- [x] **Step 1: Add PowerShell launch command sheet**
  - Add `docs/course-platform/operations/supabase-powershell-command-sheet.md`.
  - Include local verification, Supabase login/link, safe secret setting, SQL files to run in the Supabase SQL editor, Edge Function deploy commands, browser configuration, evidence packet reminders, and final Git commands for the teacher.
  - Require every Edge Function in `supabase/course-platform-deployment-manifest.json` to appear as a deploy command.

- [x] **Step 2: Link command sheet from launch docs**
  - Link the command sheet from `docs/course-platform/operations/supabase-launch-checklist.md`.
  - Link the command sheet from `supabase/README.md`.
  - Add the verifier to implementation status.

- [x] **Step 1: Run command-sheet verifier**
  - Run `node tools\verify-auth-powershell-launch-commands.js`.

- [x] **Step 2: Run full platform verifier suite**
  - Run the full local verifier suite, including the PowerShell launch command verifier.
