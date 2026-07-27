# TC2007B Supabase Launch Checklist

Use this checklist for the first live Supabase setup, after a clean clone, or before the first activity that counts toward grades.

Do not use for grade-bearing activities until every required item below is complete and one teacher-plus-student smoke test has passed from QR scan to gradebook export.

Authoritative manifest:

```text
supabase/course-platform-deployment-manifest.json
```

PowerShell command sheet:

```text
docs/course-platform/operations/supabase-powershell-command-sheet.md
```

Private evidence template:

```text
docs/course-platform/operations/live-supabase-evidence-packet.md
```

Semester setup decisions packet:

```text
docs/course-platform/operations/semester-setup-decisions.md
```

Roster import packet:

```text
docs/course-platform/operations/roster-import-guide.md
docs/course-platform/operations/tc2007b-roster-template.csv
```

For each live check below, write the result in the evidence packet. Keep completed copies in private teacher-controlled storage, not in the public repository.

## 0. Semester Setup Decisions

1. Copy `docs/course-platform/operations/semester-setup-decisions.md` into private teacher-controlled storage.
2. Complete the semester setup decisions before the first activity that counts toward grades.
3. Confirm institutional email domains, teaching assistant use, official grading weights, content storage/privacy policy, LMS gradebook import needs, data retention, backup/export location, and the grade-bearing go/no-go decision.
4. Keep completed copies private. Do not commit filled decision records, real roster details, private policy notes, or backup locations to the public repository.
5. Record the private completed-copy location in `docs/course-platform/operations/live-supabase-evidence-packet.md`.

## 1. Supabase Project

1. Create or open the production Supabase project for the current TC2007B term.
2. Confirm the project reference and store it in your private teacher notes.
3. Confirm who has owner/admin access before grades are stored.
4. Confirm the project backup plan before students complete graded work.
5. Keep service-role credentials out of GitHub, public JavaScript, screenshots, and student-facing documents.
6. Record the project reference and launch date in `docs/course-platform/operations/live-supabase-evidence-packet.md`.

## 2. Auth And Email

1. Enable Supabase Auth passwordless email.
2. Configure the approved institutional email domain, for example `tec.mx` and `itesm.mx`.
3. Configure the public site URL for the GitHub Pages course site.
4. Configure approved redirect URLs for the authenticated app pages.
5. Test one teacher account and one rostered student account before class.
6. Allow institutional passwordless email sign-in only with the app's roster gate in place: unrostered users may create an Auth identity, but they must not enter grade-bearing course areas.
7. Record the Auth and redirect results in the evidence packet.

## 3. Database Migrations

Run the migrations in this order in the Supabase SQL editor or through your approved Supabase deployment workflow:

```text
0001_quiz_pilot.sql
0002_exit_tickets.sql
0003_portfolio_submissions.sql
0004_authenticated_course_platform.sql
0005_authenticated_activity_storage.sql
0006_gradebook_foundation.sql
0007_portfolio_entries.sql
0008_authenticated_exit_tickets.sql
0009_activity_attempt_limits.sql
0010_profile_identity_confirmations.sql
0011_external_access_grants.sql
```

Stop point: if any migration fails, do not continue to seeds or Edge Function deploys. Save the error message and fix the database state first.

After the migrations succeed, write the result in the evidence packet.

## 4. Seed Data

Use only safe, non-real-student seed files:

```text
tc2007b_auth_foundation_demo.sql
```

The foundation seed creates the course shell, sample sections, and the content-item catalog. Graded question banks are authored in the app and stored server-side — never committed as seed files, so correct answers never live in the public repository.

Real student rosters should be imported through the authenticated teacher roster page, not committed as seed files.

After the safe seeds run, write the result in the evidence packet.

## 5. Edge Functions

Set the private function secrets first:

```text
QUIZ_TEACHER_PIN=choose-a-private-pin
COURSE_MAINTENANCE_SECRET=choose-a-long-private-maintenance-secret
```

Deploy every function below after migrations are applied:

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

Stop point: if an Edge Function deploy fails, do not test graded workflows until that function is deployed successfully. The app depends on these functions instead of direct table access from the browser.

After the deploys succeed, write each function result or log location in the evidence packet.

## 6. Browser Configuration

Update the browser-safe configuration files only with public values:

```text
assets/course-materials/information-security/platform-config.js
assets/course-materials/information-security/week-01/lecture/quiz/config.js
```

Required public values:

1. Supabase project URL.
2. Supabase anon key.
3. Allowed institutional domains.
4. Course ID or course slug used by the app.

Never place service-role keys in these files.

After updating browser configuration, write the result in the evidence packet.

## 7. RLS Safety Check

Run this SQL check after migrations and before any grade-bearing use:

```text
supabase/tests/rls_auth_platform_checks.sql
```

After the teacher-plus-student smoke test, run the post-launch smoke sanity checks:

```text
supabase/tests/post_launch_smoke_sanity_checks.sql
```

Expected result: the SQL editor shows a notice that the TC2007B authenticated platform RLS checks passed.

Stop point: if the check raises an exception, stop. Do not release grade-bearing activities until the failed table has Row Level Security enabled and browser roles do not have direct table privileges.

After the RLS check passes, write the SQL result in the evidence packet.
After the post-launch smoke sanity checks run, write the aggregate results location in the evidence packet.

## 8. Teacher And Student Smoke Test

Run the smoke test with one teacher account and one rostered student account.

1. Teacher signs in through the authenticated app.
2. Teacher confirms the course, section, and session context.
3. Teacher imports or verifies a small test roster.
4. Student signs in with the rostered institutional email.
5. Student confirms roster identity.
6. Teacher releases one low-stakes activity only for the student's section.
7. Student opens the activity from a QR code or join link.
8. Student submits the activity.
9. Teacher confirms the attempt appears in live results and gradebook.
10. Teacher exports the gradebook CSV and verifies student ID, institutional email, section, activity, raw score, final score, submission state, and timestamp.

The smoke test is not complete until the flow passes from QR scan to gradebook export.

After the smoke test passes, write the teacher account, test student account, section isolation result, direct URL access-denied result, and export evidence location in the evidence packet.

## 9. Backups Before First Grade

1. Confirm the Supabase backup tier or make a manual database dump.
2. Store backups outside the public repository.
3. Export the gradebook after any activity that counts toward final grades.
4. Keep the backup/export location in private teacher notes.
5. Read `docs/course-platform/operations/semester-operations-runbook.md` before using the app for official records.
6. Write the backup/export location and Go/No-Go decision in the evidence packet.

## 10. Rollback Stop Points

Stop and repair before class if any of these are true:

1. A rostered student cannot sign in with institutional email.
2. A student can access unreleased or wrong-section content.
3. A direct unreleased URL does not show access denied.
4. Correct answers or service secrets appear in public browser files.
5. The RLS Safety Check fails.
6. The teacher cannot export grade evidence.
7. Backups or grade exports have not been confirmed.

When a stop point happens during class, pause the activity, export existing records if possible, and follow the incident procedure in the semester operations runbook.
