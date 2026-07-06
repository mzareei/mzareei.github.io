# TC2007B Live Supabase Evidence Packet

Private teacher record. Copy this template into private teacher-controlled storage before filling it in.

Do not commit completed copies that contain student data, project secrets, screenshots with student names, roster exports, gradebook exports, database dumps, or private Supabase project details.

Use this packet when moving the authenticated course platform from repository-ready to live-classroom-ready. The goal is to keep enough evidence to prove the platform was configured, tested, and backed up before any activity counts toward grades.

## Project And Release Metadata

| Field | Evidence File Or Note | Teacher initials |
| --- | --- | --- |
| Date completed |  |  |
| Course term |  |  |
| Supabase project reference |  |  |
| Git branch or commit deployed |  |  |
| GitHub Pages URL tested |  |  |
| Teacher account tested |  |  |
| Test student account tested |  |  |

## Semester Setup Decisions

Copy `docs/course-platform/operations/semester-setup-decisions.md` into private teacher-controlled storage and complete it before the first grade-bearing activity.

| Decision | Evidence File Or Note | Teacher initials |
| --- | --- | --- |
| Completed private copy location |  |  |
| Approved institutional domains |  |  |
| Teaching assistant role policy |  |  |
| Official grading weights |  |  |
| Content storage and privacy policy |  |  |
| LMS gradebook import format or waiver |  |  |
| Data retention policy |  |  |
| Backup/export location |  |  |
| Grade-bearing go/no-go decision |  |  |

## Live Completion Gates

| Gate | Evidence File Or Note | Teacher initials |
| --- | --- | --- |
| Apply all migrations through `0010_profile_identity_confirmations.sql` |  |  |
| Run safe seed files |  |  |
| Configure Supabase Auth email OTP |  |  |
| Configure approved institutional domains, site URL, and redirect URLs |  |  |
| Add browser-safe Supabase URL and anon key to public config files |  |  |
| Deploy all Edge Functions |  |  |
| Run `supabase/tests/rls_auth_platform_checks.sql` |  |  |
| Import a small real or test roster |  |  |
| Complete one teacher-plus-student smoke test |  |  |
| Verify wrong-section and direct-unreleased access denial |  |  |
| Complete one activity from QR scan to gradebook export |  |  |
| Confirm backup/export location |  |  |

## Migration Evidence

Record how migrations were applied and where the SQL result was saved.

| Migration | Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| `0001_quiz_pilot.sql` |  |  |  |
| `0002_exit_tickets.sql` |  |  |  |
| `0003_portfolio_submissions.sql` |  |  |  |
| `0004_authenticated_course_platform.sql` |  |  |  |
| `0005_authenticated_activity_storage.sql` |  |  |  |
| `0006_gradebook_foundation.sql` |  |  |  |
| `0007_portfolio_entries.sql` |  |  |  |
| `0008_authenticated_exit_tickets.sql` |  |  |  |
| `0009_activity_attempt_limits.sql` |  |  |  |
| `0010_profile_identity_confirmations.sql` |  |  |  |

## Seed Evidence

Use seed files only for safe demo/course setup. Real roster data belongs in private teacher storage and the authenticated roster workflow.

| Seed | Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| `tc2007b_auth_foundation_demo.sql` |  |  |  |
| `tc2007b_auth_activity_demo.sql` |  |  |  |
| `tc2007b_demo_question_bank.sql` |  |  |  |

## Auth And Redirect Evidence

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Supabase Auth email OTP | Email OTP is enabled for sign-in. |  |  |
| Approved institutional domains | Only approved institutional domains are accepted. |  |  |
| Site URL | GitHub Pages site URL is configured. |  |  |
| Redirect URLs | Authenticated app routes are approved redirect targets. |  |  |
| Open self-signup behavior | Unrostered users cannot enter grade-bearing areas. |  |  |

## Edge Function Deployment Evidence

Record the deploy result or deployment log location for each function.

| Edge Function | Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| `quiz-create-session` |  |  |  |
| `quiz-start-attempt` |  |  |  |
| `quiz-submit-attempt` |  |  |  |
| `quiz-session-summary` |  |  |  |
| `quiz-import-questions` |  |  |  |
| `course-submit-reflection` |  |  |  |
| `course-reflection-summary` |  |  |  |
| `course-submit-portfolio` |  |  |  |
| `course-portfolio-summary` |  |  |  |
| `course-participation-summary` |  |  |  |
| `course-auth-context` |  |  |  |
| `course-identity-confirmation` |  |  |  |
| `course-section-management` |  |  |  |
| `course-roster-management` |  |  |  |
| `course-content-library` |  |  |  |
| `course-release-management` |  |  |  |
| `course-release-maintenance` |  |  |  |
| `course-session-management` |  |  |  |
| `course-content-access` |  |  |  |
| `course-activity-attempt` |  |  |  |
| `course-quiz-compatibility` |  |  |  |
| `course-gradebook-summary` |  |  |  |
| `course-student-records` |  |  |  |
| `course-student-progress` |  |  |  |
| `course-learning-insights` |  |  |  |
| `course-participation-events` |  |  |  |
| `course-exit-ticket` |  |  |  |
| `course-portfolio-entry` |  |  |  |
| `course-audit-log` |  |  |  |

## Browser Configuration Evidence

| File | Check | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| `assets/course-materials/information-security/platform-config.js` | Supabase URL, anon key, course ID, allowed domains, and function names are correct. |  |  |
| `assets/course-materials/information-security/week-01/lecture/quiz/config.js` | Legacy quiz pilot config has only browser-safe public values. |  |  |
| Public file scan | No service-role key, server secret, or private answer key appears in browser files. |  |  |

## RLS Safety Evidence

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Run `supabase/tests/rls_auth_platform_checks.sql` | SQL editor reports TC2007B authenticated platform RLS checks passed. |  |  |
| Browser role privileges | `anon` and `authenticated` do not have direct table privileges on sensitive tables. |  |  |
| Table RLS status | Sensitive tables have Row Level Security enabled. |  |  |
| Post-launch SQL sanity checks | `supabase/tests/post_launch_smoke_sanity_checks.sql` summarizes live roster, release, attempt, gradebook, exit-ticket, portfolio, audit, and RLS evidence without selecting individual names or emails by default. |  |  |

## Roster Evidence

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Roster import guide reviewed | Teacher reviewed `docs/course-platform/operations/roster-import-guide.md`. |  |  |
| Roster template used | Private copy started from `docs/course-platform/operations/tc2007b-roster-template.csv`, and fake `example.tec.mx` sample rows were replaced before import. |  |  |
| Import test roster | Accepted rows match the intended test roster. |  |  |
| Reject invalid institutional email | Bad-domain or malformed email is rejected. |  |  |
| Rostered student sign-in | Student reaches the correct section dashboard. |  |  |
| Unrostered student sign-in | User cannot access grade-bearing areas. |  |  |
| Duplicate profile check | No unresolved duplicate test profile remains. |  |  |

## Teacher Account Smoke Test

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Teacher signs in | Teacher dashboard loads with instructor tools. |  |  |
| Course/section/session context | Teacher can select the intended course, section, and session. |  |  |
| Release console | Teacher can release one low-stakes activity for one section. |  |  |
| Live activity controls | Teacher can start, pause/resume, extend, and close a test activity. |  |  |
| Audit log | Sensitive teacher action appears in audit log. |  |  |

## Student Account Smoke Test

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Student signs in | Student signs in with institutional email OTP. |  |  |
| Identity confirmation | Student confirms roster name and student ID. |  |  |
| Released dashboard | Student sees only released section materials. |  |  |
| Activity player | Student starts and submits one low-stakes activity. |  |  |
| Student progress | Student progress page reflects the submitted activity. |  |  |

## Section Isolation Evidence

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Section A released item | Section A test student can see Section A released item. |  |  |
| Section B unreleased item | Section A test student cannot see Section B-only or unreleased item. |  |  |
| Section B released item | Section B test student can see Section B released item. |  |  |
| Wrong-section release attempt | Wrong-section access shows access denied. |  |  |

## Direct URL Access-Denied Evidence

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Draft direct URL | Student receives access denied. |  |  |
| Scheduled-before-open direct URL | Student receives access denied. |  |  |
| Wrong-section direct URL | Student receives access denied. |  |  |
| Closed/review-only behavior | Student sees only the intended review/closed state. |  |  |

## QR scan to gradebook export

| Step | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Teacher starts live activity | QR code or join link is available. |  |  |
| Student scans QR or opens join link | Student lands on the correct authenticated activity. |  |  |
| Student submits answers | Attempt is submitted before close or with expected status. |  |  |
| Server grades attempt | Raw score, percent, speed bonus, and final score are recorded. |  |  |
| Gradebook sync | Official score appears for the correct student and section. |  |  |
| Teacher export | CSV export includes the test record. |  |  |

## Gradebook Export Evidence

| Field | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Student ID | Present and correct. |  |  |
| Institutional email | Present and correct. |  |  |
| Section | Present and correct. |  |  |
| Activity | Present and correct. |  |  |
| Raw score | Present and correct. |  |  |
| Final score | Present and correct. |  |  |
| Submission state | Present and correct. |  |  |
| Timestamp | Present and correct. |  |  |
| Adjustment reason if used | Present when applicable. |  |  |

## Backup And Restore Evidence

| Check | Expected Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| Supabase backup tier confirmed | Backup availability is understood before grade-bearing use. |  |  |
| Manual database export or backup snapshot | Backup exists in private storage. |  |  |
| Gradebook CSV backup | Section gradebook export is saved privately. |  |  |
| Restore path understood | Teacher knows whether recovery uses adjustment, test restore, PITR, or production restore. |  |  |
| Storage/file backup plan | Any future uploaded files have a non-database backup plan. |  |  |

## Go/No-Go Decision

| Decision Item | Result | Evidence File Or Note | Teacher initials |
| --- | --- | --- | --- |
| All live completion gates are filled |  |  |  |
| No unresolved stop points remain |  |  |  |
| Backup/export location is confirmed |  |  |  |
| Grade-bearing use approved for first class | Go / No-Go |  |  |

Final note:

```text
I reviewed the evidence above and approve / do not approve the authenticated TC2007B platform for grade-bearing classroom use.
```
