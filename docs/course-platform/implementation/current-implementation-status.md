# TC2007B Authenticated Course Platform Implementation Status

Last local verification: all platform verifiers passed in the workspace.

This status file separates what is implemented in the repository from what still has to be done in the live Supabase project before real grade-bearing use.

## Implemented In The Repository

### Identity And Roster

- Supabase foundation tables for profiles, courses, sections, memberships, enrollments, and roster imports.
- Instructors can create and update course sections before importing rosters.
- Teacher roster import page with CSV preview, accepted/rejected rows, and apply action.
- Teacher roster tools can correct profile details and merge duplicate profiles with audit records.
- Signed-in users can claim a pre-created roster profile by matching institutional email.
- Allowed institutional domains are configured in `platform-config.js`.
- Trusted functions reject unapproved institutional email domains and require the signed-in email to match the linked roster profile.
- Teaching assistants can be imported as roster roles while roster import itself remains instructor-only.
- Students can confirm or report their roster identity before grade-bearing work.

### Authenticated Course App

- Student/teacher app shell with passwordless email sign-in support.
- Supabase Auth users can be created by institutional email link or code, while course access remains blocked unless the email matches an active roster profile.
- Role-aware dashboard links.
- The signed-in home uses a role-aware Instructor Command Center: instructors receive grouped Teach/Review/Manage navigation, persistent course/section/session context, a selected-session workspace, released materials, and supported review shortcuts; students retain a separate released-material and student-action composition. Evidence: `node tools/verify-auth-command-center.js`.
- Teacher dashboard includes course, section, and session switchers for classroom context.
- Teacher tools honor selected course, section, and session context from dashboard links.
- Student links for progress, portfolio, exit ticket, and activity player.
- Teacher links for content library, roster import, sessions, releases, insights, classroom mode, and gradebook.
- Self-contained app design system with first-class light/dark theming and an accessible theme toggle, decoupled from the dark lecture-deck stylesheet. Rationale and details in `docs/course-platform/implementation/app-ui-redesign.md`.

### Release And Session Control

- Teacher Release Console with release-state transitions.
- Instructors can create content items with sensitive-content metadata and optional draft releases.
- Teacher Session Console with class session state transitions.
- Continuation flow for paused/closed classes.
- Teacher Session Console can start, pause, resume, close, and extend live activities.
- Carry-forward selection for releases moved into continuation sessions.
- Authenticated content access gate for released dashboard materials, including access-denied states for invalid or wrong-section releases.
- Scheduled releases become visible after their open time through the authenticated dashboard, content gate, activity launcher, and student progress checks.
- Service release maintenance can open due scheduled releases and close due live releases while writing `release_events` audit rows.
- Authenticated activity QR launcher and copyable student join link.
- Teaching assistants can view assigned releases but cannot change release states; section-scoped session tools remain limited to their assigned sections.

### Authenticated Activities

- Activity, question-bank, question, option, attempt, and response tables.
- Server-side question selection and grading.
- Per-attempt time limits are enforced server-side and shown as a live countdown in the student activity player.
- Release-configured attempt limits are enforced with numbered attempts and remaining-attempt display.
- Small capped speed bonuses are calculated server-side from correctness and remaining time, then folded into `score_final`.
- Per-student randomized question/option order through activity instance policy.
- Direct activity ID access is blocked unless the content is released/live for the student's section.
- Legacy `quiz_*` question banks can be migrated into authenticated activity banks.
- Legacy typed-name attempts are intentionally not migrated as official grade evidence.

### Gradebook And Audit

- Gradebook categories, items, official scores, adjustments, participation events, and audit log.
- Automatic score synchronization from submitted authenticated attempts.
- Teacher Gradebook page with filters and CSV export including attempt status and submission timestamp evidence.
- Instructors can create or update gradebook categories, weights, drop-lowest policy, and status.
- Teacher and student summaries calculate weighted course progress from category weights and drop-lowest rules.
- Manual adjustment flow with required reason.
- Instructors can create official missing or excused gradebook records for rostered students without activity attempts.
- Score locking for finalized records.
- Teachers can record low-stakes participation events for rostered students, sections, and class sessions.
- Teaching assistants can review/export assigned-section gradebook records but cannot adjust or lock final scores.

### Learning Loop

- Student progress page with grades, attempts, portfolio count, and recommendations.
- Students have an authenticated Review Coach page based on weak-topic signals, released practice, and progress records.
- Teacher learning insights page with section summaries, topic signals, and exit-ticket trends.
- Teacher student-record view across official scores, activity attempts, exit tickets, and portfolio evidence.
- Authenticated exit-ticket table, function, and student page.
- Portfolio entry table, function, and student page.
- Students can export their own portfolio evidence as a local JSON record.
- Teaching assistants can view learning insights for assigned sections.

### Semester Operations

- Backup and restore runbook.
- RLS safety SQL check.
- Supabase launch checklist with deployment manifest, Auth setup, migration order, function deploys, RLS checks, smoke tests, and backup stop points.
- Spec coverage audit maps the original success criteria and phases to repository evidence and live Supabase proof still required.
- Live Supabase evidence packet records migration, deployment, RLS, roster, smoke-test, export, and backup proof.
- PowerShell launch command sheet lists local checks, Supabase linking, secrets, function deploys, SQL steps, and evidence recording.
- Roster import packet provides a safe CSV template and teacher guide for live roster testing.
- Post-launch SQL sanity checks summarize live roster, release, attempt, gradebook, exit-ticket, portfolio, audit, and RLS evidence.
- Semester setup decisions packet captures institutional domains, teaching assistants, grading weights, content storage, LMS export needs, and data retention before grade-bearing launch.
- Instructors can review sensitive course audit events from the teacher console.
- Teacher pre-class checklist.
- Semester rollover procedure.
- Privacy/data-retention notes.
- Incident procedures for wrong roster, duplicate student, missed activity, and connection failure.

## Verified Locally

Run from the repository root:

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
node tools\verify-auth-roster-import-packet.js
node tools\verify-auth-post-launch-sanity-sql.js
node tools\verify-auth-semester-setup-decisions.js
node tools\verify-auth-qa-test-accounts.js
```

## Still Required In Live Supabase

These steps cannot be proven by repository files alone:

1. Apply all migrations through `0010_profile_identity_confirmations.sql`.
2. Run safe seed files for the course structure and practice activity.
3. Configure Supabase Auth passwordless email and approved redirect URLs.
4. Add the public Supabase anon key to `platform-config.js`.
5. Deploy all listed Edge Functions from `supabase/README.md`.
6. Run `supabase/tests/rls_auth_platform_checks.sql` in the Supabase SQL editor.
7. Import a small real or test roster through the authenticated Roster Import page.
8. Test with one teacher account and one rostered student account.
9. Complete one low-stakes activity from QR scan to gradebook export.
10. Confirm backups/export location before grade-bearing use.

## Current Risk Notes

- The repository verifiers prove structure, links, key security markers, and browser-secret scanning. They do not replace live Supabase integration testing.
- See `docs/course-platform/implementation/spec-coverage-audit.md` for the success-criteria coverage map and live completion gates.
- Deno is not installed in the current local shell, so Edge Function type checking has not been run locally.
- Public GitHub Pages files remain public. Sensitive future materials and answer keys should stay in Supabase records or release-gated app flows, not in public static files.
