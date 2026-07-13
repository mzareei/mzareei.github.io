# TC2007B Authenticated Course Platform Spec

Status: Draft for teacher review  
Date: 2026-06-23  
Course: TC2007B Information Security

## 1. Purpose

This spec defines the next version of the TC2007B course platform: a real
classroom system for teaching, live activities, authenticated student work,
controlled content release, durable grading records, and section-by-section
course pacing.

The current GitHub Pages course site is a strong public teaching shell, but it
should not be the only control layer for unreleased or graded material. GitHub
Pages is static hosting, so hidden links are not sufficient protection for
future materials, private question banks, answer keys, or grade-bearing
activities. The next platform should keep public course information on the site
while moving identity, release control, submissions, scoring, and teacher-only
data behind Supabase authentication, Row Level Security, and server-side Edge
Functions.

## 2. Product Goals

1. Students sign in with a real institutional email before completing quizzes,
   exit tickets, missions, portfolios, or any graded activity.
2. The teacher can run two sections of the same course independently, with
   different release timing, session status, and activity windows.
3. Students only see material released for their own section.
4. Unreleased material is blocked by access rules, not just hidden from menus.
5. Every grade-bearing action is stored remotely with student identity, section,
   activity, score, timestamp, and audit history.
6. A class that does not finish can be paused, carried forward, and continued in
   the next meeting without losing context.
7. The teacher can export grade evidence for an official gradebook.
8. The system can survive a semester: backups, restore practice, audit logs, and
   clear operational routines are part of the design.

## 3. Success Criteria

The platform is ready for real course use when all of the following are true:

1. A student can only access graded activities after signing in with an approved
   institutional email.
2. A student from Section A cannot see unreleased Section B content, and a
   student from Section B cannot see unreleased Section A content.
3. A direct URL to unreleased content returns an access-denied state.
4. Correct quiz answers and scoring keys are never shipped to public browser
   code for graded activities.
5. A live quiz can be started, joined by QR code, answered, graded, and exported
   under one authenticated student identity.
6. A class session can move from planned to live to paused to continued or
   closed.
7. The teacher can inspect a student-level record across quizzes, exit tickets,
   missions, and portfolio submissions.
8. The grade export includes student ID, institutional email, section, activity,
   raw score, final score, submission state, and timestamp.
9. Row Level Security is enabled on every browser-exposed table.
10. A backup and restore check has been documented before grade-bearing use.

## 4. Architecture Decision

The recommended architecture is a hybrid model:

1. Public GitHub Pages site: course overview, public syllabus, public policies,
   non-sensitive public examples, and links into the authenticated course app.
2. Authenticated course app: released lectures, missions, quizzes, exit tickets,
   portfolios, progress, and student dashboards.
3. Teacher console: release management, live session control, QR activity
   launch, student records, grading review, exports, and audit tools.
4. Supabase backend: authentication, database, Row Level Security, Edge
   Functions, question selection, scoring, release checks, and durable storage.

The current repository can remain the source of truth for public pages and
non-sensitive course assets. Private or grade-bearing content should either be
stored in Supabase-controlled records or served only through authenticated app
routes that enforce release rules before rendering content.

## 5. Roles

### 5.1 System Roles

`platform_owner`

Owns the course platform configuration. Can manage courses, sections, teachers,
rosters, release rules, grading policy, and system settings. Usually this is the
main instructor.

`instructor`

Can manage assigned courses and sections, open and close sessions, release
materials, start activities, view student records, review grades, export CSVs,
and add manual grade adjustments.

`teaching_assistant`

Can help run live activities, view section-level results, review submissions,
and add draft feedback if enabled. Cannot change grading weights, delete
records, or change system-level security settings.

`student`

Can access released materials for enrolled sections, submit assigned work, view
their own scores, view their own progress, and export their own portfolio.

`observer`

Optional read-only role for a department reviewer or course evaluator. Can view
aggregated course-level statistics but not individual student submissions unless
explicitly granted.

`service`

Server-side Edge Functions using Supabase service credentials. This role selects
questions, validates release access, grades submissions, writes audit records,
and performs trusted teacher operations. It must never be exposed to browser
code.

`anonymous`

A non-signed-in visitor. Can only see public course information and the sign-in
screen. Cannot see released class materials, submit activities, or query student
records.

### 5.2 Role Assignment Rules

Roles are assigned per course and, when needed, per section. A user may be an
instructor in one course and a student in another. Students must be linked to a
roster entry before they can join a section. Teacher and assistant permissions
should be explicit, not inferred from email alone.

### 5.3 Permission Matrix

| Capability | Anonymous | Student | Teaching Assistant | Instructor | Platform Owner | Service |
| --- | --- | --- | --- | --- | --- | --- |
| View public course page | Yes | Yes | Yes | Yes | Yes | Yes |
| Sign in | Yes | Yes | Yes | Yes | Yes | No |
| View released section content | No | Own section | Assigned sections | Assigned sections | All sections | All sections |
| View draft content | No | No | No | Assigned courses | All courses | All courses |
| Start live class session | No | No | If granted | Assigned sections | All sections | Yes |
| Release or close content | No | No | No | Assigned sections | All sections | Yes |
| Submit student work | No | Own work | No | No | No | No |
| View student submissions | No | Own work | Assigned sections | Assigned sections | All sections | Yes |
| Adjust grades | No | No | No | Assigned sections | All sections | Yes |
| Export grade records | No | No | No | Assigned sections | All sections | Yes |
| Manage roster | No | No | No | Assigned courses | All courses | Yes |
| Manage system settings | No | No | No | No | Yes | Yes |

## 6. Student Identity

The preferred sign-in model is institutional email with Supabase passwordless email.
Students enter their institutional email, receive a sign-in link by default, and may enter a one-time code if the Supabase email template is later configured to send codes.

Identity rules:

1. Only approved institutional domains are allowed.
2. Automatic sign-up should be disabled for grade-bearing courses.
3. The roster is imported before students submit graded work.
4. A signed-in user must match exactly one active roster entry for the course.
5. Student ID, email, and section membership are stored once and reused across
   quizzes, exit tickets, portfolio submissions, and grade exports.
6. If a student changes email or has a roster issue, the teacher resolves it
   through a profile merge or roster correction workflow, not by creating a new
   identity.

Assumption for first build: the roster contains `student_identifier`,
`institutional_email`, `full_name`, and `section_code`.

## 7. Release States

Release control has two related state machines: content release state and class
session state.

### 7.1 Content Release States

`draft`

Teacher-only. Students cannot see it, even with a direct URL. Used while
building lectures, activities, or question banks.

`scheduled`

Teacher has approved the item and set `opens_at`. Students cannot access it
before the scheduled time.

`released`

Visible to enrolled students in the matching section. Used for normal pre-class
or post-class materials.

`live`

Visible and active only during a teacher-controlled class moment. Used for QR
quizzes, timed pulses, in-class activities, and short missions.

`paused`

Temporarily unavailable for new submissions, but progress is preserved. Used
when class runs out of time or the teacher wants to continue next meeting.

`review_only`

Visible for study, but new submissions are closed. Scores do not change.

`closed`

Submission window is closed. Teacher can still view records and export grades.
Students may see a closed notice or limited feedback depending on the activity.

`archived`

Kept for audit and semester history. No normal student interaction.

### 7.2 Class Session States

`planned`

Session exists on the calendar but has not started.

`open`

Teacher is preparing the session. Materials may be released, but no live
activity is running.

`live`

The class is in progress. Live activities can be started, paused, resumed, or
closed.

`paused`

Session is intentionally stopped before completion. Used when unfinished content
will continue later.

`continued`

Session resumes work from a previous paused session. It keeps a link to the
original session for grading and reporting.

`closed`

Class meeting is finished and normal submissions are closed.

`cancelled`

Class did not happen. Materials can be rescheduled without deleting the session.

### 7.3 Release Transition Rules

Allowed content release transitions:

| From | To | Who Can Change It |
| --- | --- | --- |
| `draft` | `scheduled` | Instructor, platform owner |
| `draft` | `released` | Instructor, platform owner |
| `scheduled` | `released` | Instructor, platform owner, service when `opens_at` arrives |
| `scheduled` | `draft` | Instructor, platform owner |
| `released` | `live` | Instructor, platform owner |
| `live` | `paused` | Instructor, platform owner |
| `paused` | `live` | Instructor, platform owner |
| `live` | `review_only` | Instructor, platform owner |
| `live` | `closed` | Instructor, platform owner, service when `closes_at` arrives |
| `paused` | `review_only` | Instructor, platform owner |
| `paused` | `closed` | Instructor, platform owner |
| `review_only` | `archived` | Instructor, platform owner |
| `closed` | `review_only` | Instructor, platform owner |
| `closed` | `archived` | Instructor, platform owner |

Every transition writes a `release_events` row. Reopening a closed graded item
requires a reason and creates an audit entry.

Allowed class session transitions:

| From | To | Who Can Change It |
| --- | --- | --- |
| `planned` | `open` | Instructor, platform owner |
| `open` | `live` | Instructor, platform owner |
| `live` | `paused` | Instructor, platform owner |
| `paused` | `live` | Instructor, platform owner |
| `paused` | `continued` | Instructor, platform owner |
| `continued` | `live` | Instructor, platform owner |
| `live` | `closed` | Instructor, platform owner |
| `open` | `cancelled` | Instructor, platform owner |
| `planned` | `cancelled` | Instructor, platform owner |
| `closed` | `continued` | Instructor, platform owner with reason |

## 8. Data Tables

This section defines the target data model. Existing `quiz_*`,
`course_exit_tickets`, and `course_portfolio_submissions` tables can be migrated
or wrapped into this model over time.

### 8.1 Identity And Enrollment

`profiles`

One row per authenticated person.

Key fields: `id`, `auth_user_id`, `institutional_email`, `student_identifier`,
`full_name`, `preferred_name`, `status`, `created_at`, `updated_at`.

`courses`

One row per course offering family.

Key fields: `id`, `code`, `title`, `term_label`, `status`, `created_at`.

`course_memberships`

Course-level role assignments.

Key fields: `id`, `course_id`, `profile_id`, `role`, `status`, `created_at`.

`course_sections`

One row per class section.

Key fields: `id`, `course_id`, `section_code`, `section_name`,
`meeting_pattern`, `campus`, `status`, `created_at`.

`section_enrollments`

Links students, teachers, and assistants to a section.

Key fields: `id`, `section_id`, `profile_id`, `role`, `status`,
`enrolled_at`, `dropped_at`.

`roster_imports`

Tracks imported rosters and validation results.

Key fields: `id`, `course_id`, `section_id`, `uploaded_by`, `source_filename`,
`row_count`, `accepted_count`, `rejected_count`, `status`, `created_at`.

### 8.2 Sessions And Release Control

`class_sessions`

One row per real class meeting per section.

Key fields: `id`, `course_id`, `section_id`, `sequence_number`, `title`,
`planned_date`, `actual_start_at`, `actual_end_at`, `state`,
`continued_from_session_id`, `teacher_notes`, `created_at`, `updated_at`.

`content_items`

A lecture, mission, case file, activity page, quiz bank, exit ticket, or
resource.

Key fields: `id`, `course_id`, `content_type`, `slug`, `title`, `summary`,
`source_kind`, `source_ref`, `contains_sensitive_content`, `default_points`,
`created_by`, `created_at`, `updated_at`.

`content_releases`

Controls when a content item is visible to a section or session.

Key fields: `id`, `content_item_id`, `course_id`, `section_id`,
`class_session_id`, `state`, `opens_at`, `closes_at`, `review_opens_at`,
`review_closes_at`, `allowed_attempts`, `created_by`, `updated_by`,
`created_at`, `updated_at`.

`release_events`

Audit trail for release changes.

Key fields: `id`, `content_release_id`, `actor_profile_id`, `event_type`,
`old_state`, `new_state`, `reason`, `created_at`.

### 8.3 Activities And Assessment

`activity_templates`

Reusable definition for a quiz, mission, exit ticket, case file, portfolio
checkpoint, or participation pulse.

Key fields: `id`, `content_item_id`, `activity_type`, `grading_mode`,
`max_score`, `weight_category`, `instructions`, `created_at`, `updated_at`.

`activity_instances`

A specific run of an activity for one section/session.

Key fields: `id`, `activity_template_id`, `section_id`, `class_session_id`,
`state`, `starts_at`, `ends_at`, `time_limit_seconds`, `randomization_policy`,
`question_count`, `created_by`, `created_at`, `updated_at`.

`question_banks`

Groups questions by course, lecture, topic, and usage level.

Key fields: `id`, `course_id`, `content_item_id`, `title`, `bank_type`,
`status`, `created_by`, `created_at`, `updated_at`.

`questions`

Question prompts. For graded activities, these are served only by trusted
functions.

Key fields: `id`, `question_bank_id`, `prompt`, `question_type`,
`difficulty`, `topic_tags`, `points`, `explanation`, `status`, `created_at`,
`updated_at`.

`question_options`

Answer choices for choice-based questions.

Key fields: `id`, `question_id`, `option_text`, `is_correct`, `position`,
`created_at`, `updated_at`.

`student_attempts`

One student attempt at one activity instance.

Key fields: `id`, `activity_instance_id`, `profile_id`, `section_id`,
`started_at`, `submitted_at`, `status`, `score_raw`, `score_percent`,
`speed_bonus`, `score_final`, `grading_version`, `created_at`, `updated_at`.

`student_responses`

Individual answers or submitted activity artifacts.

Key fields: `id`, `student_attempt_id`, `question_id`, `response_json`,
`selected_option_id`, `is_correct`, `points_awarded`, `answered_at`,
`created_at`.

`exit_tickets`

Short reflections after a class session.

Key fields: `id`, `course_id`, `section_id`, `class_session_id`, `profile_id`,
`confidence`, `one_thing`, `muddy_point`, `next_action`, `created_at`.

`portfolio_entries`

Student-owned artifacts and progress evidence.

Key fields: `id`, `course_id`, `section_id`, `profile_id`, `content_item_id`,
`entry_type`, `entry_json`, `visibility`, `created_at`, `updated_at`.

### 8.4 Gradebook And Audit

`gradebook_categories`

Defines grading groups such as quizzes, missions, participation, portfolio, and
exam preparation.

Key fields: `id`, `course_id`, `name`, `weight_percent`, `drop_lowest_count`,
`status`, `created_at`.

`gradebook_items`

One gradebook column.

Key fields: `id`, `course_id`, `category_id`, `activity_template_id`, `title`,
`max_score`, `due_at`, `status`, `created_at`.

`gradebook_scores`

Official grade record per student per gradebook item.

Key fields: `id`, `gradebook_item_id`, `profile_id`, `section_id`,
`source_attempt_id`, `score_raw`, `score_percent`, `score_final`, `status`,
`locked_at`, `created_at`, `updated_at`.

`grade_adjustments`

Manual teacher adjustments with reasons.

Key fields: `id`, `gradebook_score_id`, `actor_profile_id`,
`previous_score_final`, `new_score_final`, `reason`, `created_at`.

`participation_events`

Low-stakes classroom evidence such as joining a QR activity, answering a pulse,
or completing a non-graded practice task.

Key fields: `id`, `course_id`, `section_id`, `class_session_id`, `profile_id`,
`event_type`, `points`, `metadata`, `created_at`.

`audit_log`

System-wide record of sensitive changes.

Key fields: `id`, `course_id`, `actor_profile_id`, `target_type`,
`target_id`, `action`, `metadata`, `created_at`.

## 9. Security Model

1. All browser-exposed tables must have Row Level Security enabled.
2. Anonymous users can only access public course metadata and the sign-in flow.
3. Students can read released content for their own active sections.
4. Students can read and write only their own attempts, responses, exit tickets,
   and portfolio entries.
5. Students cannot update a submitted attempt after the activity closes.
6. Students cannot read answer keys or correctness rules.
7. Instructors can manage records for courses and sections where they hold an
   instructor role.
8. Teaching assistants can receive scoped permissions per section.
9. Edge Functions perform trusted actions: release validation, randomized
   question selection, answer grading, gradebook sync, export preparation, and
   audit logging.
10. Service credentials stay only in Supabase Edge Function runtime secrets.

## 10. Grading Model

Official grades should be based on defensible academic evidence:

1. Correctness.
2. Completion.
3. Rubric-based activity evidence.
4. Submission status.
5. Teacher-approved adjustments.

Speed can be used as a small engagement bonus or live leaderboard signal, but it
should not dominate official grades. This avoids unfair penalties caused by
phone speed, network quality, accessibility needs, or classroom logistics.

Recommended score fields:

1. `score_raw`: points earned before conversion.
2. `score_percent`: normalized percent.
3. `speed_bonus`: optional small bonus.
4. `score_final`: official gradebook score after policy and adjustments.
5. `status`: `draft`, `submitted`, `late`, `excused`, `missing`, `adjusted`,
   or `locked`.

## 11. Classroom Continuation Model

When a class does not finish:

1. The teacher marks the `class_sessions.state` as `paused`.
2. Live activities that should continue are moved to `paused`.
3. Activities that should be graded as-is are moved to `closed`.
4. The next meeting can create a new session with
   `continued_from_session_id`.
5. The teacher can move unfinished content releases to the continued session.
6. Reports preserve both the original session and the continuation session.

This keeps Section A and Section B independent. If Section A finishes a topic
and Section B does not, only Section B receives the continuation state.

## 12. Teacher Workflows

### 12.1 Before The Semester

1. Create course and two sections.
2. Import roster for each section.
3. Confirm allowed institutional email domain.
4. Configure grading categories and weights.
5. Prepare content items as `draft`.
6. Create the first two weeks of class sessions.
7. Test sign-in with a teacher test student account.
8. Test one full quiz attempt and grade export.

### 12.2 Before Each Class

1. Open teacher console.
2. Select course and section.
3. Select today or create a class session.
4. Release only the needed lecture, mission, quiz, and exit ticket.
5. Confirm that future content remains locked.
6. Start live activity when the room is ready.

### 12.3 During Class

1. Project the lecture or classroom mode.
2. Show QR code for the current live activity.
3. Students sign in on phones if not already signed in.
4. Students complete the activity.
5. Teacher watches live participation and score signals.
6. Teacher pauses, extends, closes, or continues the activity.

### 12.4 After Class

1. Close live submissions.
2. Move lecture materials to `review_only` if students should revisit them.
3. Review exit tickets and missed concepts.
4. Export grade evidence if needed.
5. Decide whether the next session needs review, continuation, or normal
   progression.

## 13. Student Workflows

### 13.1 First-Time Student

1. Opens course link or scans QR.
2. Enters institutional email.
3. Receives OTP.
4. Signs in.
5. Sees only enrolled section materials.
6. Confirms name and student ID from roster.

### 13.2 During Class

1. Opens QR activity.
2. Lands on the released live activity.
3. Answers questions or completes mission task.
4. Submits before the activity closes.
5. Sees permitted feedback.

### 13.3 After Class

1. Reviews released materials.
2. Completes available exit ticket or portfolio item.
3. Checks personal progress.
4. Uses Review Coach based on released and completed work.

## 14. Implementation Order

### Phase 0: Current Baseline Audit

Goal: Confirm the existing platform remains stable while planning the upgrade.

Deliverables:

1. Verify clean Git state.
2. Run course verifier.
3. Document existing Supabase tables and functions.
4. Identify which public pages contain sensitive or future content.

Success point: The current GitHub Pages and Supabase pilot still work before
the authenticated upgrade begins.

### Phase 1: Identity And Roster Foundation

Goal: Make institutional identity the center of student activity.

Deliverables:

1. Supabase Auth email OTP configuration.
2. Approved institutional email domain list.
3. `profiles`, `courses`, `course_sections`, `course_memberships`,
   `section_enrollments`, and `roster_imports`.
4. RLS policies for student, teacher, assistant, and anonymous access.
5. Teacher roster import and validation screen.

Success point: A rostered student can sign in and see their section, while an
unrostered email cannot enter graded areas.

### Phase 2: Authenticated App Shell

Goal: Give students and teachers a protected home base.

Deliverables:

1. Student dashboard with released items, live activities, progress, and scores.
2. Teacher dashboard with course, section, and session switchers.
3. Shared auth guard for protected app routes.
4. Clear sign-out and expired-session behavior.

Success point: Students and teachers see different dashboards based on role and
section membership.

### Phase 3: Release Engine

Goal: Control what each section can see and when.

Deliverables:

1. `class_sessions`, `content_items`, `content_releases`, and
   `release_events`.
2. Teacher release controls: draft, schedule, release, live, pause, review,
   close, archive.
3. Student access checks for direct URLs.
4. Section-specific content visibility.

Success point: Section A can see one lecture while Section B cannot, even if
both students know the same route.

### Phase 4: Authenticated Quiz And Activity Storage

Goal: Move grade-bearing activity records under signed-in identity.

Deliverables:

1. `activity_templates`, `activity_instances`, `question_banks`, `questions`,
   `question_options`, `student_attempts`, and `student_responses`.
2. Server-side question selection and grading.
3. Random question order and option order per student.
4. Attempt limits and time windows.
5. Compatibility path from current `quiz_*` tables into the new model.

Success point: A signed-in student completes a randomized quiz, and the teacher
sees a durable score linked to that student's profile and section.

### Phase 5: Class Pause And Continuation

Goal: Support real classroom pacing.

Deliverables:

1. Session state controls for planned, open, live, paused, continued, closed,
   and cancelled.
2. Teacher action to carry unfinished content into the next session.
3. Reports that show original and continuation sessions together.
4. Student UI that clearly shows paused or continued work.

Success point: The teacher can pause an unfinished class and continue it in the
next meeting without manually recreating activities.

### Phase 6: Gradebook And Exports

Goal: Make records usable for real grading.

Deliverables:

1. `gradebook_categories`, `gradebook_items`, `gradebook_scores`,
   `grade_adjustments`, `participation_events`, and `audit_log`.
2. Teacher grade review screen.
3. CSV exports by section, activity, category, and full semester.
4. Manual adjustment flow with required reason.
5. Locked score state for finalized items.

Success point: The teacher can export a section grade report that matches
student records and includes adjustment reasons.

### Phase 7: Learning Loop

Goal: Use the data to improve teaching, not only grading.

Deliverables:

1. Student progress dashboard.
2. Review Coach based on missed concepts and released content.
3. Teacher insights by section, topic, activity, and student.
4. Exit ticket trend reports.
5. Portfolio evidence linked to gradebook categories.

Success point: After class, the teacher can see what to review next and each
student can see what to practice.

### Phase 8: Hardening And Semester Operations

Goal: Make the platform reliable enough for a semester.

Deliverables:

1. Backup and restore procedure.
2. RLS policy tests.
3. Teacher pre-class checklist.
4. Semester rollover procedure.
5. Privacy and data retention notes.
6. Incident procedure for wrong roster, duplicate student, missed activity, or
   connection failure.

Success point: The course can be run for both sections with clear operating
procedures and a recovery path.

## 15. Migration From Current Platform

Existing pieces to keep:

1. GitHub Pages public course shell.
2. Teacher and student guides.
3. Lecture and mission structure.
4. Supabase Edge Function pattern.
5. Server-side quiz grading concept.
6. Existing question bank seed as low-stakes/demo material.
7. Teacher insights, assessment, progress, and review coach ideas.

Existing pieces to change:

1. Replace typed student names/IDs with authenticated profile identity.
2. Replace teacher PIN as the main security model with authenticated teacher
   roles.
3. Move future/private/graded content out of public-only access.
4. Convert section-specific operations into first-class database records.
5. Move portfolio and progress evidence from mostly local browser storage into
   durable student-owned records.

Existing-to-target table mapping:

| Existing Table | Target Direction |
| --- | --- |
| `quiz_courses` | Migrate into `courses` or keep as compatibility view |
| `quiz_lectures` | Migrate into `content_items` and `class_sessions` |
| `quiz_questions` | Migrate into `questions` |
| `quiz_options` | Migrate into `question_options` |
| `quiz_sessions` | Migrate into `activity_instances` |
| `quiz_attempts` | Migrate into `student_attempts` after profile identity exists |
| `quiz_attempt_questions` | Migrate into `student_responses` metadata or a join table if detailed ordering must be preserved |
| `quiz_answers` | Migrate into `student_responses` |
| `course_exit_tickets` | Migrate into `exit_tickets` |
| `course_portfolio_submissions` | Migrate into `portfolio_entries` and `gradebook_scores` |

## 16. Operational Policies

### 16.1 Content Policy

Public materials can stay in the public repository. Future lectures, private
question banks, answer keys, rubrics, and grade-bearing activity definitions
should not be published as public static files.

### 16.2 Assessment Policy

Quizzes and activities can count toward final grading only after authentication,
RLS, server-side scoring, and export checks are complete.

### 16.3 Backup Policy

Before using the system for grades, the teacher should confirm the Supabase
backup tier, export critical grade data periodically, and test one restore or
manual recovery procedure. Database backups do not restore deleted Supabase
Storage objects, so files should also exist in a separate source of truth.

### 16.4 Fairness Policy

Speed points should be limited to engagement or a small bonus. Official grades
should prioritize correctness, completion, and teacher-reviewed evidence.

## 17. Open Decisions

These do not block the spec, but they should be decided before implementation:

1. Exact institutional email domain or domains.
2. Whether teaching assistants will exist in the first semester.
3. Official grading weights.
4. Whether materials should live in Supabase records, protected app files, or a
   mix of both.
5. Whether the school requires LMS gradebook import formatting.
6. Data retention policy after the semester ends.

## 18. References

1. GitHub Pages documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
2. Supabase Row Level Security documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
3. Supabase passwordless email login documentation: https://supabase.com/docs/guides/auth/auth-email-passwordless
4. Supabase database backups documentation: https://supabase.com/docs/guides/platform/backups
