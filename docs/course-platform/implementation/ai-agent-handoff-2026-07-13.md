# TC2007B Authenticated Course Platform AI Agent Handoff

Date written: 2026-07-13

Purpose: give another AI agent enough project context, current state, technical architecture, and next steps to continue the work without relying on chat history.

This document is public-safe. Do not add real student names, real roster rows, private Supabase project notes, screenshots with emails, backup locations, function secrets, service-role keys, or completed live evidence to this file. Completed evidence belongs in a private copy of `docs/course-platform/operations/live-supabase-evidence-packet.md`.

## 1. Immediate Snapshot

Repository root:

```text
C:\Users\L03082445\Claude\Projects\My Personal Page
```

Remote project:

```text
https://github.com/mzareei/mzareei.github.io/
```

Current branch at the time this handoff was prepared:

```text
main
```

Git state before this handoff file was added:

```text
## main...origin/main
```

The workspace was clean and matched `origin/main` before this new handoff document was created. PowerShell printed a repeated warning while running `git status`:

```text
warning: unable to access 'C:\Users\L03082445/.config/git/ignore': Permission denied
```

That warning appears to be an environment/global-git-ignore permission issue, not a repository content change.

Recent commits:

```text
93e7e34 Add sign-in email cooldown
0bf4f89 Handle Supabase email sign-in links
6e13fa1 Allow roster-gated OTP signup
4f836bd Configure TC2007B Supabase public key
b7dc2fa Merge pull request #1 from mzareei/codex/authenticated-course-platform
5c3ec79 Build authenticated TC2007B course platform
acc2427 Add TC2007B teacher and student guides
5e8e6d5 Use quiz signals in TC2007B review coach
```

Important current conclusion:

The repository implementation is substantially complete for the authenticated TC2007B course platform. The remaining work is mostly live Supabase deployment, live smoke testing, and private launch evidence. Treat the platform as repository-ready but not fully proven for official grade-bearing classroom use until the live gates are completed.

## 2. What We Were Doing

The original repo is Mahdi Zareei's personal academic website, built with Jekyll and hosted on GitHub Pages. The repo also contains static TC2007B Information Security course materials under `assets/course-materials/information-security/`.

The recent work transformed the TC2007B material set from mostly public/static classroom resources into an authenticated course platform suitable for controlled release of course content, live activities, attempts, gradebook records, student progress, teacher insights, and semester operations.

The platform goal is not to make GitHub Pages private. GitHub Pages remains public. Instead, the static site loads a browser-safe Supabase config and calls Supabase Auth plus Edge Functions. Sensitive operations are enforced in Supabase tables and trusted Edge Functions. Correct answers, official grading records, private rosters, and teacher-only operations must live behind Supabase, not in public JavaScript.

The implementation followed a phased plan:

1. Baseline audit and existing static course verification.
2. Identity and roster foundation.
3. Authenticated app shell.
4. Release engine and session control.
5. Authenticated activity storage and attempt lifecycle.
6. Class pause and continuation.
7. Gradebook and export evidence.
8. Learning loop: progress, review coach, exit tickets, portfolio, teacher insights.
9. Hardening and semester operations: RLS checks, launch checklist, evidence packet, runbook.

The central spec is:

```text
docs/course-platform/tc2007b-authenticated-course-platform-spec.md
```

The best current status summaries are:

```text
docs/course-platform/implementation/current-implementation-status.md
docs/course-platform/implementation/spec-coverage-audit.md
```

## 3. What Exists At The Moment

### 3.1 Jekyll Academic Website

The root site is a lightweight GitHub Pages/Jekyll website:

```text
_config.yml
index.html
about.md
cv.html
research.html
publications.html
projects.html
students.html
teaching.html
blog.html
news.html
contact.md
_data/
_courses/
_posts/
_layouts/
_includes/
assets/css/style.scss
assets/js/main.js
```

The Jekyll site and the course platform are colocated but mostly independent. The main academic site uses `_data/*.yml`, `_courses/*.md`, layouts, includes, and one global stylesheet/script. GitHub Pages builds it automatically on push to `main`.

### 3.2 Static Course Materials

The course content lives here:

```text
assets/course-materials/information-security/
```

It includes lecture decks, missions, bridge sessions, public guides, classroom tools, review coach pages, portfolio tools, and the authenticated app.

The lecture deck engine is self-contained HTML/CSS/JS copied from:

```text
assets/course-materials/_template/lecture/
```

Deck conventions from `CLAUDE.md`:

- One folder per lecture or mission.
- `index.html` contains slide content.
- `style.css` and `script.js` are shared deck engine copies.
- Bilingual content uses `data-es`.
- Local storage keys for decks are separate from the main site.
- Avoid committing private or high-stakes answer keys.

### 3.3 Authenticated Course App

The authenticated app lives here:

```text
assets/course-materials/information-security/app/
```

Important app files:

```text
app/index.html
app/app.js
app/app.css
app/auth-api.js
app/identity.html
app/identity.js
app/identity-api.js
app/content.html
app/content.js
app/content-api.js
app/activity.html
app/activity-player.js
app/activity-api.js
app/progress.html
app/progress.js
app/progress-api.js
app/review-coach.html
app/review-coach.js
app/portfolio.html
app/portfolio.js
app/portfolio-api.js
app/exit-ticket.html
app/exit-ticket.js
app/exit-ticket-api.js
app/sections.html
app/sections.js
app/section-api.js
app/roster.html
app/roster.js
app/roster-api.js
app/content-library.html
app/content-library.js
app/content-library-api.js
app/sessions.html
app/sessions.js
app/session-api.js
app/releases.html
app/releases.js
app/release-api.js
app/gradebook.html
app/gradebook.js
app/gradebook-api.js
app/insights.html
app/insights.js
app/insights-api.js
app/student-records.html
app/student-records.js
app/student-records-api.js
app/participation.html
app/participation.js
app/participation-api.js
app/audit.html
app/audit.js
app/audit-api.js
```

Student-facing app areas:

- Sign in through `app/index.html`.
- Confirm/report roster identity through `identity.html`.
- Open released content through `content.html?release=...`.
- Complete authenticated activities through `activity.html`.
- View progress through `progress.html`.
- Use the authenticated review coach through `review-coach.html`.
- Submit authenticated exit tickets through `exit-ticket.html`.
- Create/export portfolio evidence through `portfolio.html`.

Teacher-facing app areas:

- Manage course sections through `sections.html`.
- Import/correct roster profiles through `roster.html`.
- Author content items through `content-library.html`.
- Manage class sessions through `sessions.html`.
- Manage content releases through `releases.html`.
- View learning insights through `insights.html`.
- Record participation through `participation.html`.
- Inspect student records through `student-records.html`.
- Review and export gradebook records through `gradebook.html`.
- Review sensitive audit events through `audit.html`.

### 3.4 Browser Configuration

The authenticated app has a public browser config:

```text
assets/course-materials/information-security/platform-config.js
```

Current public values inspected for this handoff:

```text
courseId: tc2007b
supabaseUrl: https://ojmbupftdikwmlqvibwt.supabase.co
allowedInstitutionalDomains: tec.mx, itesm.mx
```

It also contains a public Supabase anon key. That is expected to be browser-visible. Do not replace it with a service-role key.

The legacy lecture quiz config is:

```text
assets/course-materials/information-security/week-01/lecture/quiz/config.js
```

It also points at:

```text
https://ojmbupftdikwmlqvibwt.supabase.co
```

and contains the public anon key for the legacy quiz path.

### 3.5 Supabase Backend

Supabase project assets live under:

```text
supabase/
```

Key files:

```text
supabase/README.md
supabase/config.toml
supabase/course-platform-deployment-manifest.json
supabase/migrations/
supabase/seed/
supabase/tests/
supabase/functions/
```

The deployment manifest is the single source of truth for migrations, seed files, Edge Functions, browser config files, required secrets, and live checks:

```text
supabase/course-platform-deployment-manifest.json
```

## 4. Database Model Summary

All browser-exposed tables are intended to have Row Level Security enabled and direct browser role access revoked. The browser should interact through Edge Functions, not direct table reads/writes for sensitive workflows.

### 4.1 Legacy Quiz Pilot Tables

Migration:

```text
supabase/migrations/0001_quiz_pilot.sql
```

Tables:

```text
quiz_courses
quiz_lectures
quiz_questions
quiz_options
quiz_sessions
quiz_attempts
quiz_attempt_questions
quiz_answers
```

Purpose:

- Support older live lecture quiz flow.
- Teacher starts sessions.
- Students submit quiz attempts.
- Used for non-sensitive pilot and compatibility path.

Security note:

- Legacy browser demo banks may still exist for low-stakes content.
- High-stakes or grade-bearing questions should use authenticated activity records instead.

### 4.2 Legacy Exit Ticket And Portfolio Tables

Migrations:

```text
supabase/migrations/0002_exit_tickets.sql
supabase/migrations/0003_portfolio_submissions.sql
```

Tables:

```text
course_exit_tickets
course_portfolio_submissions
```

Purpose:

- Earlier reflection and portfolio submission paths.
- Still supported by legacy/shared Edge Functions.

### 4.3 Authenticated Course Foundation

Migration:

```text
supabase/migrations/0004_authenticated_course_platform.sql
```

Tables:

```text
profiles
courses
course_memberships
course_sections
section_enrollments
roster_imports
class_sessions
content_items
content_releases
release_events
```

Core concepts:

- `profiles` represent roster identities and optional linked Supabase Auth users.
- `courses` represent the TC2007B course shell.
- `course_memberships` define course-level roles: `platform_owner`, `instructor`, `teaching_assistant`, `student`, `observer`.
- `course_sections` define sections such as Section A and Section B.
- `section_enrollments` assign profiles to sections with roles: `instructor`, `teaching_assistant`, `student`, `observer`.
- `roster_imports` records teacher CSV import metadata.
- `class_sessions` model planned/open/live/paused/continued/closed class meetings.
- `content_items` model lectures, missions, quiz banks, activities, exit tickets, portfolios, resources, and case files.
- `content_releases` scope content to course/section/session and state.
- `release_events` audit release state, schedule, scope, reopen, and archive changes.

Important state/role constraints:

```text
profiles.status: invited, active, inactive, merged
courses.status: planned, active, completed, archived
course_memberships.role: platform_owner, instructor, teaching_assistant, student, observer
section_enrollments.role: instructor, teaching_assistant, student, observer
section_enrollments.status: active, inactive, dropped
roster_imports.status: uploaded, validated, applied, failed
class_sessions.state: planned, open, live, paused, continued, closed, cancelled
content_items.content_type: lecture, mission, quiz_bank, activity, exit_ticket, portfolio, resource, case_file
content_items.source_kind: static_path, supabase_record, external_url
content_releases.state: draft, scheduled, released, live, paused, review_only, closed, archived
content_releases.allowed_attempts: 1 to 20
release_events.event_type: created, state_changed, schedule_changed, scope_changed, reopened, archived
```

### 4.4 Authenticated Activity Storage

Migration:

```text
supabase/migrations/0005_authenticated_activity_storage.sql
```

Tables:

```text
activity_templates
activity_instances
question_banks
questions
question_options
student_attempts
student_responses
```

Core concepts:

- `activity_templates` define reusable activity shells and grading modes.
- `activity_instances` bind an activity to a section/session and live state.
- `question_banks`, `questions`, and `question_options` hold private question data.
- `student_attempts` record signed-in attempts.
- `student_responses` record selected/typed responses and grading outputs.

Important constraints:

```text
activity_templates.activity_type: quiz, mission, exit_ticket, case_file, portfolio, participation_pulse
activity_templates.grading_mode: completion, correctness, rubric, participation, manual
activity_instances.state: planned, open, live, paused, closed, archived
activity_instances.time_limit_seconds: 30 to 14400
activity_instances.randomization_policy: none, shuffle_questions, shuffle_options, shuffle_questions_and_options, random_bank_sample
question_banks.bank_type: practice, graded, exam_prep, diagnostic
questions.question_type: single_choice, multiple_choice, short_text, reflection, rubric
questions.difficulty: easy, medium, hard
student_attempts.status: started, submitted, late, excused, missing, locked
```

### 4.5 Gradebook Foundation

Migration:

```text
supabase/migrations/0006_gradebook_foundation.sql
```

Tables:

```text
gradebook_categories
gradebook_items
gradebook_scores
grade_adjustments
participation_events
audit_log
```

Core concepts:

- Categories carry weights and drop-lowest rules.
- Items can link to activity templates and official due dates.
- Scores carry raw, percent, final, source attempt, status, lock timestamp, and evidence timestamps.
- Adjustments require a reason and audit trail.
- Participation events record low-stakes class participation.
- Audit log records sensitive teacher/system actions.

Important constraints:

```text
gradebook_categories.status: draft, active, archived
gradebook_items.status: draft, published, closed, locked, archived
gradebook_scores.status: draft, posted, excused, missing, locked
gradebook_scores locked records require locked_at
grade_adjustments.reason length: 5 to 1000 chars
```

### 4.6 Authenticated Portfolio, Exit Tickets, Attempt Limits, Identity Confirmation

Migrations:

```text
supabase/migrations/0007_portfolio_entries.sql
supabase/migrations/0008_authenticated_exit_tickets.sql
supabase/migrations/0009_activity_attempt_limits.sql
supabase/migrations/0010_profile_identity_confirmations.sql
```

Tables/features:

```text
portfolio_entries
exit_tickets
student_attempts.attempt_number
profile_identity_confirmations
```

Important behavior:

- Students can create authenticated portfolio entries linked to course/section/category context.
- Students can submit authenticated exit tickets tied to course/section/session/release context.
- Attempt numbers are unique by activity instance, profile, and attempt number.
- Release-configured attempt limits are enforced in `course-activity-attempt`.
- Students can confirm roster identity or report an identity issue before grade-bearing work.

## 5. Edge Function Map

All Edge Functions live under:

```text
supabase/functions/
```

Shared helpers:

```text
supabase/functions/_shared/client.ts
supabase/functions/_shared/cors.ts
supabase/functions/_shared/identity.ts
```

`_shared/identity.ts` currently defines approved institutional domains:

```text
tec.mx
itesm.mx
```

and enforces exact match between signed-in email and roster profile email.

### 5.1 Legacy Quiz And Reflection Functions

```text
quiz-create-session
quiz-start-attempt
quiz-submit-attempt
quiz-session-summary
quiz-import-questions
course-submit-reflection
course-reflection-summary
course-submit-portfolio
course-portfolio-summary
course-participation-summary
```

Purpose:

- Preserve the original lecture quiz/session workflow.
- Support quiz question imports.
- Support early exit-ticket/reflection/portfolio tools.

### 5.2 Auth Context And Identity

```text
course-auth-context
course-identity-confirmation
```

Important `course-auth-context` behavior:

- Requires `Authorization: Bearer <access_token>`.
- Uses Supabase Auth to resolve the user.
- Rejects unapproved institutional email domains.
- Loads an already-linked profile by `auth_user_id`.
- If no linked profile exists, attempts to claim a pre-created roster profile where `institutional_email` exactly matches the signed-in email and profile status is `invited` or `active`.
- Sets claimed profiles to `active`.
- Returns memberships, sections, visible releases, and teacher sessions.
- Returns `roster_status` values such as `missing_profile`, `active`, and `not_enrolled`.

Important identity confirmation behavior:

- Student can confirm identity.
- Student can report an identity issue with a note.
- Writes audit rows for `identity_confirmed` or `identity_issue_reported`.

### 5.3 Course/Section/Roster Tools

```text
course-section-management
course-roster-management
```

Purpose:

- Instructors create/update course sections before roster import.
- Instructors import CSV roster rows.
- Instructors correct profile details.
- Instructors merge duplicate profiles.
- Teaching assistants can exist as roster roles, but roster import remains instructor-only.

Related docs:

```text
docs/course-platform/operations/roster-import-guide.md
docs/course-platform/operations/tc2007b-roster-template.csv
docs/course-platform/implementation/phase-1b-roster-management-plan.md
docs/course-platform/implementation/phase-1f-roster-corrections-plan.md
```

### 5.4 Content Release And Session Control

```text
course-content-library
course-release-management
course-release-maintenance
course-session-management
course-content-access
```

Purpose:

- Create content items.
- Create draft/scheduled/released/live/review-only releases.
- Scope releases by course, section, and session.
- Transition release states.
- Maintain scheduled and expiring releases by service call.
- Start/pause/resume/close/continue class sessions.
- Gate direct content URLs by signed-in identity, section membership, release state, open/close windows, and scheduled release rules.

Important security expectation:

- Direct unreleased URLs must show access denied.
- Wrong-section release access must be denied.
- Teaching assistants can view assigned-section releases but cannot change release states.

### 5.5 Authenticated Activities

```text
course-activity-attempt
course-quiz-compatibility
```

Important `course-activity-attempt` behavior:

- Requires signed-in rostered user.
- Supports `start_attempt` and `submit_attempt`.
- Verifies activity instance is open/live enough for attempts.
- Verifies released content is visible for the student's section.
- Enforces `allowed_attempts` from the release, clamped to 1 through 20.
- Reuses an open attempt if one exists.
- Creates numbered attempts using `attempt_number`.
- Enforces per-attempt time limit from `activity_instances.time_limit_seconds`.
- Selects questions server-side.
- Applies question/option randomization according to instance policy.
- Grades server-side.
- Calculates a small capped speed bonus from correctness and remaining time.
- Stores `score_raw`, `score_percent`, `speed_bonus`, and `score_final`.
- Syncs submitted attempts into `gradebook_scores` when a published/closed/locked gradebook item is linked.
- Does not expose correct answers to browser code for authenticated graded work.

Important score logic from inspection:

```text
speed_bonus max: 5 percent
final score: min(100, score_percent + speed_bonus)
```

### 5.6 Gradebook, Records, Progress, And Insights

```text
course-gradebook-summary
course-student-records
course-student-progress
course-learning-insights
course-participation-events
```

Important gradebook behavior:

- Teachers can summarize and export gradebook records.
- Instructors can save gradebook categories with weights and drop-lowest count.
- Instructors can adjust scores with required reasons.
- Instructors can lock scores.
- Instructors can create official missing or excused records.
- Teaching assistants can review/export assigned-section gradebook records but cannot adjust or lock final scores.
- CSV export includes identity, section, activity/item, source attempt, submission state, scores, timestamps, adjustment count/reason, and lock evidence.
- Weighted summaries apply category weights and drop-lowest rules.

Important participation behavior:

- Teachers can record low-stakes participation events for rostered students, sections, and class sessions.
- Permissions are scoped by instructor/TA role and section assignment.

### 5.7 Exit Ticket, Portfolio, Audit

```text
course-exit-ticket
course-portfolio-entry
course-audit-log
```

Purpose:

- Authenticated exit ticket submission.
- Authenticated portfolio entry submission and student-owned export.
- Teacher/instructor audit log review for sensitive course events.

## 6. Auth Flow Details

Files:

```text
assets/course-materials/information-security/app/index.html
assets/course-materials/information-security/app/app.js
assets/course-materials/information-security/app/auth-api.js
assets/course-materials/information-security/platform-config.js
supabase/functions/course-auth-context/index.ts
supabase/functions/_shared/identity.ts
```

Browser flow:

1. `app/index.html` shows an institutional email input and an optional six digit code input.
2. `app.js` normalizes the email to lowercase.
3. `app.js` rejects email domains not listed in `platform-config.js`.
4. `auth-api.js` calls `supabase.auth.signInWithOtp`.
5. `sendOtp` uses `shouldCreateUser: true`, so a Supabase Auth account can be created by institutional email.
6. Course entry is still roster-gated: creating a Supabase Auth user is not enough to access grade-bearing course context.
7. `auth-api.js` sets `emailRedirectTo` to the current app URL without query/hash.
8. Users can click the sign-in email link or enter a code if Supabase shows one.
9. `verifyOtp` calls `supabase.auth.verifyOtp({ email, token, type: "email" })`.
10. `getSession` reads the current Supabase session.
11. `loadCourseContext` POSTs to `/functions/v1/course-auth-context` with `Authorization: Bearer <access_token>`.
12. The Edge Function enforces institutional email and exact roster profile match.
13. A matching invited/active profile can be claimed by email and linked to the Auth user.
14. The app renders roles, section enrollments, released items, student actions, and teacher actions.

Recent sign-in changes:

- Commit `6e13fa1` allowed roster-gated OTP signup by enabling Auth identity creation while keeping course access blocked unless a roster match exists.
- Commit `0bf4f89` handled Supabase email sign-in links and aligned docs/spec with email-link support.
- Commit `93e7e34` added a 60 second browser cooldown for sign-in email requests and handles Supabase rate-limit style errors.

Cooldown implementation details:

```text
localStorage key: tc2007b.auth-send-cooldown
cooldown duration: 60 seconds
button text during cooldown: Try again in Ns
rate limit detection regex: /rate limit|too many|email rate/i
```

Teacher context behavior:

- `app.js` stores selected teacher course/section/session context in local storage key `tc2007b.teacher-context`.
- Teacher dashboard links append `course`, `section`, and `session` query parameters.
- Teacher tools use those parameters to stay focused on the selected context.

## 7. Release And Content Access Model

Release records live in:

```text
content_items
content_releases
release_events
```

Content item source kinds:

```text
static_path
supabase_record
external_url
```

Release states:

```text
draft
scheduled
released
live
paused
review_only
closed
archived
```

Current expected behavior:

- Students see only releases visible to their active section enrollments.
- Scheduled releases become effective only after `opens_at`.
- Closed releases disappear unless review windows or review-only state apply.
- Paused/live state is reflected in the dashboard label.
- Content access is validated again in `course-content-access`, not only in the dashboard.
- Direct URLs for unreleased, wrong-section, or invalid release IDs must return access denied.
- Release maintenance can open due scheduled releases and close due live releases using a private `COURSE_MAINTENANCE_SECRET`.

Important service secret:

```text
COURSE_MAINTENANCE_SECRET
```

Do not put it in public files. It is meant for scheduled Supabase jobs or private server calls with:

```text
Authorization: Bearer <secret>
```

## 8. What Is Verified Locally

The current status file says:

```text
Last local verification: all platform verifiers passed in the workspace.
```

That statement is in:

```text
docs/course-platform/implementation/current-implementation-status.md
```

For a new agent, do not rely on the old statement alone. Re-run the verifiers before making any new "passes" claim, before committing, or before deployment.

Full local verifier set from the current docs:

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
```

These are structural/static verifiers. They check repository consistency, links, schema markers, expected function behavior markers, documentation completeness, public-file safety, and expected UI/API wiring. They do not prove the live Supabase project has all migrations, functions, secrets, Auth settings, RLS behavior, or smoke-test data.

Known local verification gap:

```text
Deno is not installed in the current local shell, so Edge Function type checking has not been run locally.
```

## 9. Live Supabase State

Public config already points at a Supabase project:

```text
https://ojmbupftdikwmlqvibwt.supabase.co
```

The project ref appears to be:

```text
ojmbupftdikwmlqvibwt
```

However, public config being filled does not prove the live project is fully migrated, seeded, deployed, RLS-checked, or smoke-tested. The current docs still say live proof is required.

The required live migrations, in order:

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
```

Safe seed files:

```text
tc2007b_auth_foundation_demo.sql
tc2007b_auth_activity_demo.sql
tc2007b_demo_question_bank.sql
```

Required live SQL checks:

```text
supabase/tests/rls_auth_platform_checks.sql
supabase/tests/post_launch_smoke_sanity_checks.sql
```

Required function secrets:

```text
QUIZ_TEACHER_PIN
COURSE_MAINTENANCE_SECRET
```

Never add custom `SUPABASE_SERVICE_ROLE_KEY` to public files or browser config. Supabase Edge Functions receive service credentials from the Supabase runtime.

## 10. Authoritative Launch Docs

Read these before doing live deployment work:

```text
supabase/README.md
supabase/course-platform-deployment-manifest.json
docs/course-platform/operations/supabase-launch-checklist.md
docs/course-platform/operations/supabase-powershell-command-sheet.md
docs/course-platform/operations/semester-operations-runbook.md
docs/course-platform/operations/semester-setup-decisions.md
docs/course-platform/operations/roster-import-guide.md
docs/course-platform/operations/live-supabase-evidence-packet.md
docs/course-platform/implementation/spec-coverage-audit.md
```

The launch checklist is explicit: do not use the platform for grade-bearing activities until every required launch item is complete and one teacher-plus-student smoke test has passed from QR scan to gradebook export.

## 11. Next Steps For Another AI Agent

### 11.1 First Orientation Steps

1. Run `git status --short --branch`.
2. Read `CLAUDE.md`.
3. Read `docs/course-platform/implementation/current-implementation-status.md`.
4. Read `docs/course-platform/implementation/spec-coverage-audit.md`.
5. Read `supabase/course-platform-deployment-manifest.json`.
6. Read `docs/course-platform/operations/supabase-launch-checklist.md`.
7. Confirm whether the user wants live Supabase deployment help, more repository docs, code changes, or a commit/push.

### 11.2 Preferred GitHub-First Workflow

The user's intended workflow is:

```text
Another AI agent continues the work directly on GitHub.
The user pulls changes into this local folder only when needed.
```

That means GitHub should be treated as the source of truth for continuing work. The local folder is a working copy that may lag behind GitHub until the user chooses to pull.

Recommended GitHub-side workflow:

1. Start from the latest `main` on GitHub.
2. Create a focused branch for each unit of work, preferably using the existing branch prefix convention:

   ```text
   codex/<short-task-name>
   ```

3. Make changes on that branch, not directly on `main`, for anything beyond tiny documentation edits.
4. Keep commits small and descriptive.
5. Open a pull request when the change is reviewable.
6. In the pull request description, include:

   ```text
   Summary of changes
   Files touched
   Verification run
   Live Supabase steps performed, if any
   Live Supabase steps still pending
   Any private evidence location, described generically without exposing private data
   ```

7. Merge to `main` only after review/approval and verification.
8. Remember that GitHub Pages deploys from `main`, so merging public-site or public-course-material changes can publish them.

Recommended local workflow for the user after GitHub work is merged:

```powershell
cd "C:\Users\L03082445\Claude\Projects\My Personal Page"
git status
git pull
```

If the user wants to inspect a GitHub branch before merge:

```powershell
cd "C:\Users\L03082445\Claude\Projects\My Personal Page"
git fetch
git switch <branch-name>
```

If the local folder has uncommitted changes, do not pull blindly. First inspect:

```powershell
git status --short --branch
```

Then decide whether to commit, stash, or move the local changes before pulling.

Important consequence for future agents:

- Do not assume this local folder contains the latest work if another agent is operating directly on GitHub.
- Before making local changes, pull or fetch first.
- Before telling the user to pull, state whether the relevant GitHub changes are on `main` or on a branch/PR.
- For live Supabase evidence, do not commit filled private evidence to GitHub. Keep only public-safe templates and generic status updates in the repo.

### 11.3 If Continuing Repository Work Locally

Use this loop:

1. Pull latest first because this repo is edited from multiple machines:

   ```powershell
   git pull
   ```

2. Make focused edits.
3. Run the relevant verifier and the full verifier set if touching cross-cutting course-platform behavior.
4. Run `git diff --check`.
5. Inspect `git diff`.
6. Commit only if the user asks or the workflow requires it.
7. Push only when appropriate for GitHub Pages visibility.

Do not revert user changes. If files are dirty, identify whether the changes are yours or pre-existing before editing.

### 11.4 If Continuing Live Supabase Launch

Follow this order:

1. Confirm with the user that live deployment should happen against project ref `ojmbupftdikwmlqvibwt` or ask for the correct project ref.
2. Confirm Supabase CLI login is available on the user's trusted teacher machine.
3. Keep `docs/course-platform/operations/live-supabase-evidence-packet.md` open, but copy it to private teacher-controlled storage before filling it.
4. Complete private `semester-setup-decisions.md` copy before grade-bearing use.
5. Link the project:

   ```powershell
   npx supabase link --project-ref <project-ref>
   ```

6. Set secrets:

   ```powershell
   npx supabase secrets set QUIZ_TEACHER_PIN="<private-pin>"
   npx supabase secrets set COURSE_MAINTENANCE_SECRET="<long-private-secret>"
   ```

7. Run migrations in order in the Supabase SQL editor or approved deployment workflow.
8. Run safe seeds.
9. Deploy all Edge Functions from the manifest.
10. Configure Supabase Auth:

    ```text
    passwordless email enabled
    site URL set to the GitHub Pages course app
    redirect URLs include the authenticated app pages
    institutional domains agreed: tec.mx, itesm.mx unless user changes them
    ```

11. Run `supabase/tests/rls_auth_platform_checks.sql`.
12. Import a tiny test roster through the authenticated roster page.
13. Test one teacher account and one rostered student account.
14. Student confirms identity.
15. Teacher releases one low-stakes activity to the student's section.
16. Student opens activity from QR/join link and submits.
17. Teacher confirms live results and gradebook sync.
18. Teacher exports gradebook CSV and checks identity, section, activity, source attempt, scores, status, and timestamps.
19. Run `supabase/tests/post_launch_smoke_sanity_checks.sql`.
20. Confirm backup/export location before grade-bearing use.
21. Record results in the private evidence packet.
22. Update public docs only with non-sensitive launch status.

### 11.5 Live Completion Gates

Do not mark the platform fully ready for official grade-bearing classroom use until there is evidence for all of these:

1. Migrations through `0010_profile_identity_confirmations.sql` applied.
2. Safe seeds run.
3. Supabase Auth passwordless email configured.
4. Approved site URL and redirect URLs configured.
5. Public Supabase URL and anon key configured in browser files.
6. All Edge Functions in the manifest deployed.
7. Function secrets set privately.
8. `rls_auth_platform_checks.sql` passed.
9. Small real or test roster imported through the app.
10. Teacher sign-in works.
11. Rostered student sign-in works.
12. Student identity confirmation works.
13. Section-specific content isolation works.
14. Direct unreleased URL access is denied.
15. Wrong-section release access is denied.
16. Activity flow passes from QR scan/join link to submission.
17. Gradebook sync works.
18. Gradebook CSV export contains required evidence fields.
19. Post-launch sanity SQL run after smoke data exists.
20. Backup/export location confirmed.

## 12. Risks And Constraints

### 12.1 Public GitHub Pages

Everything committed under this repository can become public through GitHub Pages or GitHub itself. Do not commit:

- Real rosters.
- Student names or emails in evidence.
- Private teacher notes.
- Filled launch evidence.
- Screenshots with private student data.
- Service-role keys.
- `COURSE_MAINTENANCE_SECRET`.
- `QUIZ_TEACHER_PIN`.
- High-stakes answer keys.
- Private exam banks.

### 12.2 Anon Key Is Public, Service Key Is Not

The Supabase anon key in `platform-config.js` and legacy quiz config is browser-safe by design. It does not bypass RLS or Edge Function checks by itself. The service-role key must never appear in this repository or any browser file.

### 12.3 Local Verifiers Are Not Live Integration Tests

The Node verification scripts are useful guardrails. They do not prove:

- Supabase Auth is configured.
- Email delivery works.
- Redirect URLs are correct.
- Migrations are applied in the live project.
- Function deploys succeeded.
- RLS behaves correctly in production.
- Teacher/student smoke tests work.
- Gradebook exports contain live evidence.
- Backups exist.

### 12.4 Deno Type Checking

The current docs note Deno is not installed in the local shell. Edge Functions are TypeScript files for Supabase/Deno. If a future agent installs or has Deno available, run type checks or at least `deno check` for Edge Functions where practical.

### 12.5 Supabase CLI And Network Access

Live operations use `npx supabase ...` and require network access and logged-in Supabase credentials. In this Codex environment, network operations may require user approval. Do not work around approvals. Request permission when needed.

### 12.6 Email Rate Limits

The browser now has a 60 second local cooldown for sign-in email requests, and catches rate-limit messages. Supabase's real Auth email rate limits still apply. During live testing, avoid repeatedly requesting sign-in emails from the same address.

## 13. Recommended Reading Order

For a new AI agent:

```text
1. CLAUDE.md
2. docs/course-platform/implementation/current-implementation-status.md
3. docs/course-platform/implementation/spec-coverage-audit.md
4. supabase/course-platform-deployment-manifest.json
5. supabase/README.md
6. docs/course-platform/operations/supabase-launch-checklist.md
7. docs/course-platform/operations/supabase-powershell-command-sheet.md
8. docs/course-platform/operations/semester-operations-runbook.md
9. assets/course-materials/information-security/platform-config.js
10. assets/course-materials/information-security/app/auth-api.js
11. assets/course-materials/information-security/app/app.js
12. supabase/functions/course-auth-context/index.ts
13. supabase/functions/course-activity-attempt/index.ts
14. supabase/functions/course-gradebook-summary/index.ts
15. supabase/tests/rls_auth_platform_checks.sql
16. supabase/tests/post_launch_smoke_sanity_checks.sql
```

## 14. Short Version To Carry Forward

We built an authenticated Supabase-backed TC2007B course platform inside a public GitHub Pages academic website. The repository contains the static app, Supabase migrations, seed data, Edge Functions, RLS checks, launch docs, runbooks, and many Node verifiers. Public browser config already points to Supabase project `ojmbupftdikwmlqvibwt` and allowed domains `tec.mx` and `itesm.mx`. The latest work improved passwordless email sign-in, roster-gated Auth user creation, email-link handling, and a 60 second sign-in request cooldown.

The repo-side implementation is considered substantially complete by the current status docs, but the remaining critical work is live Supabase proof: apply migrations, seed safe data, configure Auth, deploy functions, run RLS SQL, import a test roster, test teacher and student accounts, confirm identity, verify section access controls, complete one QR-to-gradebook activity, export grade evidence, run post-launch SQL, and confirm backups. Do not use for grade-bearing work until those live gates are done and documented privately.
