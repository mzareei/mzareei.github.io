# TC2007B Supabase PowerShell Command Sheet

Use this sheet after reading `docs/course-platform/operations/supabase-launch-checklist.md`. It gathers the PowerShell commands that are safe to run from your local repository and names the SQL files that must be run in the Supabase SQL editor.

Do Not Paste Service-Role Keys into any public file, browser config, GitHub issue, screenshot, or command history that students can see. Supabase Edge Functions receive service credentials through the Supabase runtime.

Keep `docs/course-platform/operations/live-supabase-evidence-packet.md` open while you work. After each section below, record the result in your private evidence packet copy.

## Run From Repository Root

```powershell
cd "C:\Users\L03082445\Claude\Projects\My Personal Page"
git status
```

## Local Repository Verification

Run these before linking/deploying, so you know the repository version is internally consistent:

```powershell
node tools\verify-course-platform.js
node tools\verify-auth-course-platform.js
node tools\verify-auth-app-shell.js
node tools\verify-auth-institutional-email-guard.js
node tools\verify-auth-identity-confirmation.js
node tools\verify-auth-section-management.js
node tools\verify-auth-foundation-seed.js
node tools\verify-release-engine.js
node tools\verify-auth-release-maintenance.js
node tools\verify-auth-teacher-context-switchers.js
node tools\verify-auth-teacher-context-tools.js
node tools\verify-auth-live-activity-controls.js
node tools\verify-auth-roster-management.js
node tools\verify-auth-roster-corrections.js
node tools\verify-auth-role-permissions.js
node tools\verify-auth-ta-release-guard.js
node tools\verify-auth-content-library.js
node tools\verify-auth-content-access.js
node tools\verify-auth-scheduled-release-access.js
node tools\verify-auth-activity-schema.js
node tools\verify-auth-attempt-lifecycle.js
node tools\verify-auth-speed-bonus-policy.js
node tools\verify-auth-activity-player.js
node tools\verify-auth-quiz-compatibility.js
node tools\verify-auth-session-continuation.js
node tools\verify-auth-gradebook-schema.js
node tools\verify-auth-gradebook-sync.js
node tools\verify-auth-gradebook-review.js
node tools\verify-auth-gradebook-export-evidence.js
node tools\verify-auth-gradebook-adjustments.js
node tools\verify-auth-gradebook-settings.js
node tools\verify-auth-weighted-grade-summary.js
node tools\verify-auth-gradebook-status-records.js
node tools\verify-auth-participation-events.js
node tools\verify-auth-student-records.js
node tools\verify-auth-student-progress.js
node tools\verify-auth-review-coach.js
node tools\verify-auth-teacher-insights.js
node tools\verify-auth-exit-tickets.js
node tools\verify-auth-portfolio-entries.js
node tools\verify-auth-portfolio-export.js
node tools\verify-auth-audit-log-viewer.js
node tools\verify-auth-operations-runbook.js
node tools\verify-auth-supabase-launch-checklist.js
node tools\verify-auth-spec-coverage-audit.js
node tools\verify-auth-live-evidence-packet.js
node tools\verify-auth-powershell-launch-commands.js
node tools\verify-auth-qa-test-accounts.js
```

## Link Supabase Project

Install/login/link only from your trusted teacher machine:

```powershell
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Write the linked project reference in the private evidence packet.

## Set Function Secrets

Use private values. Do not use the examples literally.

```powershell
npx supabase secrets set QUIZ_TEACHER_PIN="<choose-a-private-pin>"
npx supabase secrets set COURSE_MAINTENANCE_SECRET="<choose-a-long-private-maintenance-secret>"
```

Do not set a custom service-role secret named `SUPABASE_SERVICE_ROLE_KEY`; Supabase provides service credentials to Edge Functions at runtime.

## Run SQL In Supabase

Run these migration files in the Supabase SQL editor, in order:

```text
supabase/migrations/0001_quiz_pilot.sql
supabase/migrations/0002_exit_tickets.sql
supabase/migrations/0003_portfolio_submissions.sql
supabase/migrations/0004_authenticated_course_platform.sql
supabase/migrations/0005_authenticated_activity_storage.sql
supabase/migrations/0006_gradebook_foundation.sql
supabase/migrations/0007_portfolio_entries.sql
supabase/migrations/0008_authenticated_exit_tickets.sql
supabase/migrations/0009_activity_attempt_limits.sql
supabase/migrations/0010_profile_identity_confirmations.sql
supabase/migrations/0011_external_access_grants.sql
```

Then run these safe seed files in the Supabase SQL editor:

```text
supabase/seed/tc2007b_auth_foundation_demo.sql
supabase/seed/tc2007b_auth_activity_demo.sql
supabase/seed/tc2007b_demo_question_bank.sql
```

Finally run the RLS safety check:

```text
supabase/tests/rls_auth_platform_checks.sql
```

After the live teacher-plus-student smoke test, run the post-launch smoke sanity checks:

```text
supabase/tests/post_launch_smoke_sanity_checks.sql
```

Write each SQL result in the evidence packet.

## Deploy Edge Functions

Run after migrations are applied and secrets are set:

```powershell
npx supabase functions deploy quiz-create-session
npx supabase functions deploy quiz-start-attempt
npx supabase functions deploy quiz-submit-attempt
npx supabase functions deploy quiz-session-summary
npx supabase functions deploy quiz-import-questions
npx supabase functions deploy course-submit-reflection
npx supabase functions deploy course-reflection-summary
npx supabase functions deploy course-submit-portfolio
npx supabase functions deploy course-portfolio-summary
npx supabase functions deploy course-participation-summary
npx supabase functions deploy course-auth-context
npx supabase functions deploy course-identity-confirmation
npx supabase functions deploy course-section-management
npx supabase functions deploy course-roster-management
npx supabase functions deploy course-content-library
npx supabase functions deploy course-release-management
npx supabase functions deploy course-release-maintenance
npx supabase functions deploy course-session-management
npx supabase functions deploy course-content-access
npx supabase functions deploy course-activity-attempt
npx supabase functions deploy course-quiz-compatibility
npx supabase functions deploy course-gradebook-summary
npx supabase functions deploy course-student-records
npx supabase functions deploy course-student-progress
npx supabase functions deploy course-learning-insights
npx supabase functions deploy course-participation-events
npx supabase functions deploy course-exit-ticket
npx supabase functions deploy course-portfolio-entry
npx supabase functions deploy course-audit-log
```

Write each deploy result or log location in the evidence packet.

## Browser Configuration

Update only browser-safe public values:

```text
assets/course-materials/information-security/platform-config.js
assets/course-materials/information-security/week-01/lecture/quiz/config.js
```

Expected values:

1. Supabase project URL.
2. Supabase anon key.
3. Allowed institutional domains.
4. Course ID or course slug.

Then run the public-file safety scan again:

```powershell
node tools\verify-course-platform.js
```

## Live Evidence Packet

Use the private evidence packet while you complete the live checks:

```text
docs/course-platform/operations/live-supabase-evidence-packet.md
```

The repository contains the blank template. Completed copies may contain student names, emails, export filenames, screenshots, or Supabase project details, so keep them outside the public repository.

## Final Local Check Before Push

After documentation/config changes, run:

```powershell
node tools\verify-auth-powershell-launch-commands.js
node tools\verify-auth-live-evidence-packet.js
node tools\verify-auth-supabase-launch-checklist.js
```

Then commit from PowerShell when you are ready:

```powershell
git status
git add .
git commit -m "Add authenticated course platform launch commands"
git push -u origin codex/authenticated-course-platform
```
