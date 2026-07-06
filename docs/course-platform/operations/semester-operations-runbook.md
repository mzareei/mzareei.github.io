# TC2007B Semester Operations Runbook

This runbook is the teacher-facing operating guide for using the authenticated TC2007B course platform with two live sections. It focuses on the parts that matter for real grading: identity, release timing, durable records, recovery, and calm incident handling.

Use it before the first grade-bearing class, before each class meeting, after each class meeting, and at semester rollover.

For the first live Supabase setup, use the launch checklist first:

```text
docs/course-platform/operations/supabase-launch-checklist.md
```

## Backup And Restore Procedure

The database is the official record for signed-in quizzes, activities, gradebook scores, manual adjustments, release history, portfolio evidence, participation events, and audit logs. GitHub remains the source of truth for public course files, static lecture pages, and non-sensitive code.

### Before Grade-Bearing Use

1. Confirm the Supabase project plan and backup level before any activity counts toward final grades.
2. If the project has automated backups, identify where the restore screen lives in the Supabase dashboard and who has permission to use it.
3. If the project does not have automated backups, make a manual database export before the first graded activity.
4. Store backups outside the public repository. Use an off-site backup location controlled by the teacher or institution.
5. Keep gradebook CSV exports after important checkpoints, because they are easy to inspect even if a full restore is not needed.

Manual export from PowerShell:

```powershell
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db dump --file "backups\tc2007b-YYYYMMDD.sql"
```

The `supabase db dump` command should be run from a trusted computer, and the resulting file should not be committed to GitHub because it can contain student records.

### Weekly Backup Routine

1. Export the database with `supabase db dump`.
2. Export the teacher gradebook report for Section A and Section B.
3. Confirm that the backup file opens as text and is larger than the previous week unless the course has not yet started.
4. Move the file to the off-site backup location.
5. Record the date, project reference, and filename in a private teacher log.

### Restore Path

Use the least disruptive recovery path first.

1. For a single incorrect grade, use the gradebook adjustment flow and record a reason.
2. For one missed or corrupted attempt, use the incident procedure and keep the original audit trail.
3. For broad accidental deletion, make a fresh dump of the current database first, then restore into a separate test Supabase project to inspect the backup.
4. Restore production only when the impact is wider than what can be repaired with adjustments and manual recovery.

Supabase dashboard restores can cause restore downtime. Schedule a production restore outside class time and announce the interruption if students may be using the app. If the project plan supports Point-in-Time Recovery, use it for a narrower recovery window after a recent mistake. Database backups do not restore deleted Supabase Storage objects, so any future uploaded files must also have a separate file backup plan.

Priority records to validate after any restore:

1. `profiles`, `course_memberships`, and `section_enrollments`
2. `content_releases` and `release_events`
3. `student_attempts` and `student_responses`
4. `gradebook_scores` and `grade_adjustments`
5. `portfolio_entries`, `participation_events`, and `audit_log`

## RLS Policy Tests

Run the RLS safety script after migrations, after any schema change, and before the first grade-bearing activity of the semester.

SQL file:

```text
supabase/tests/rls_auth_platform_checks.sql
```

How to run:

1. Open the Supabase SQL editor.
2. Paste the full contents of `supabase/tests/rls_auth_platform_checks.sql`.
3. Run it against the production project only after migrations are deployed.
4. A successful run returns a notice that the checks passed.
5. If it raises an exception, stop releasing grade-bearing activities until the failed table is fixed.

The test checks that sensitive tables exist, Row Level Security is enabled, and the browser roles `anon` and `authenticated` do not have direct table privileges. This matches the current design: students and teachers use trusted Edge Functions, while table access stays closed to browser code.

## Teacher Pre-Class Checklist

Use this checklist before each meeting. It is intentionally short enough to run in the classroom.

### Both Sections

1. Sign in as the teacher and open the authenticated course app.
2. Confirm the correct course term is active.
3. Confirm the roster import has no unresolved duplicate or rejected institutional emails.
4. Confirm today-specific lecture material is released only for the section that should see it.
5. Confirm any quiz or activity has the correct release state, attempt limit, time limit, and close time.
6. Open the student view with a test rostered account and confirm unreleased content is hidden.
7. Keep the public lecture page and teacher console open before students scan any QR code.
8. Have a backup activity ready in case classroom Wi-Fi is unstable.

### Section A

1. Check the Section A class session state.
2. Release only the Section A material needed for the current meeting.
3. After class, close or pause Section A activities based on what was actually finished.
4. Export the Section A gradebook snapshot if an activity counted toward grading.

### Section B

1. Check the Section B class session state.
2. Release only the Section B material needed for the current meeting.
3. If Section B is behind Section A, keep future Section B material in draft or scheduled state.
4. After class, close or pause Section B activities based on what was actually finished.

## Semester Rollover Procedure

Use rollover when one semester ends and the next offering begins. Do not reuse the same active course records for a new group of students.

1. Export the final gradebook for every section.
2. Export audit evidence needed for grade disputes: grade adjustments, submitted attempts, portfolio entries, and release events.
3. Mark the old course as completed, then archived after the grade dispute period ends.
4. Keep old student records read-only. Do not delete them until the institutional retention period allows it.
5. Create a new course ID for the next term, such as `tc2007b-2026-fall`.
6. Clone reusable content items and activity templates without cloning student attempts, responses, gradebook scores, or portfolio evidence.
7. Create fresh Section A and Section B records for the new term.
8. Import the new roster and validate institutional emails before any grade-bearing activity.
9. Run all local verifiers and the RLS Policy Tests before the first class.
10. Run one low-stakes practice activity with a test student before using the new course for grading.

## Privacy And Data Retention Notes

The platform is designed for real classroom records, so treat it like an official grade system even when an activity feels informal.

1. Require students to sign in with their institutional email before quizzes or activities can count.
2. Do not ask students to enter grades, IDs, or private notes into public pages.
3. Do not commit real rosters, student exports, database dumps, or service-role keys to GitHub.
4. Do not put high-stakes answer keys in public JavaScript files or public seeds.
5. Keep grade exports and backups in teacher-controlled or institution-controlled storage.
6. Share class analytics in aggregate form when possible.
7. If using data for research or public examples, remove names, institutional emails, student IDs, and free-text responses that can identify a student.
8. Follow the institution's grade-record retention requirement before deleting old records.

## Incident Procedures

The goal during an incident is to protect records first, then repair the class experience. Do not overwrite evidence until a backup or export exists.

### Wrong Roster

Symptoms: a student cannot enter, appears in the wrong section, or sees material for the wrong section.

1. Pause grade-bearing activities if the error affects more than one student.
2. Export the current roster and membership records before changing them.
3. Correct the `profiles`, `course_memberships`, and `section_enrollments` records.
4. Ask the affected student to sign out and sign back in.
5. Re-check access from the student view.
6. If the student missed a graded activity because of the roster error, use a documented makeup or manual gradebook adjustment.

### Duplicate Student

Symptoms: the same person appears under two institutional emails, two student identifiers, or two profile records.

1. Do not delete either profile immediately.
2. Identify which profile is tied to the official institutional email.
3. Export attempts, gradebook scores, portfolio entries, and audit events for both profiles.
4. Move any needed evidence to the official profile through a documented teacher adjustment or controlled data repair.
5. Mark the duplicate profile as inactive or merged.
6. Record the reason in the private teacher log.

### Missed Activity

Symptoms: a student was present but did not submit because of device, Wi-Fi, late roster correction, accessibility need, or teacher-approved exception.

1. Check whether a `student_attempts` row exists.
2. If an attempt exists but was not submitted, decide whether to reopen, mark late, excuse, or grade manually.
3. If no attempt exists, create a documented makeup opportunity or gradebook adjustment.
4. Keep the same grading standard for Section A and Section B unless the class conditions were genuinely different.
5. Put the reason in the gradebook adjustment record, not only in a private note.

### Connection Failure

Symptoms: many phones cannot load the quiz, submissions fail, or the classroom network drops.

1. Pause the activity rather than closing it.
2. Tell students to stop refreshing until the teacher confirms the next step.
3. Check whether the teacher console and Supabase dashboard are reachable from a different network.
4. If the failure is short, continue the same activity and extend the time window.
5. If the failure is long, close the live attempt window, mark the activity as paused, and continue it in the next meeting.
6. If the activity was grade-bearing, export whatever records exist before applying makeup rules.
7. Write a short incident note with date, affected section, affected activity, and the chosen grading remedy.
