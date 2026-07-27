# TC2007B Course Interaction Backend

This folder contains the Supabase backend for the TC2007B live quiz, question-bank import, exit-ticket reflection tools, and portfolio record submissions.

## Deploy Order

For a complete first-time launch path, use `docs/course-platform/operations/supabase-launch-checklist.md` together with `supabase/course-platform-deployment-manifest.json`. The checklist names the required Auth settings, migrations, seeds, Edge Functions, browser configuration, RLS check, smoke test, and backup stop points before grade-bearing use. Before the first graded activity, copy and complete `docs/course-platform/operations/semester-setup-decisions.md` in private teacher-controlled storage. For copy-paste PowerShell commands, use `docs/course-platform/operations/supabase-powershell-command-sheet.md`.

1. Create a Supabase project.
2. Run `migrations/0001_quiz_pilot.sql`, `migrations/0002_exit_tickets.sql`, `migrations/0003_portfolio_submissions.sql`, `migrations/0004_authenticated_course_platform.sql`, `migrations/0005_authenticated_activity_storage.sql`, `migrations/0006_gradebook_foundation.sql`, `migrations/0007_portfolio_entries.sql`, `migrations/0008_authenticated_exit_tickets.sql`, `migrations/0009_activity_attempt_limits.sql`, and `migrations/0010_profile_identity_confirmations.sql` in the Supabase SQL editor.
3. For the authenticated course shell, run `seed/tc2007b_auth_foundation_demo.sql`. It creates the TC2007B course, two sample sections, initial content items, and release rows without adding real student identities.
4. For a low-stakes authenticated practice activity, run `seed/tc2007b_auth_activity_demo.sql`. It creates one Week 1 activity template, section activity instances, a small practice question bank, and options without adding real student identities.
5. For the non-sensitive course pilot bank, run `seed/tc2007b_demo_question_bank.sql`. It currently covers all active lecture quizzes and bridge sessions.
6. Run `tests/rls_auth_platform_checks.sql` in the Supabase SQL editor after the authenticated migrations are applied and before any activity counts toward grades.
7. Set the function secrets:

```text
QUIZ_TEACHER_PIN=choose-a-private-pin
COURSE_MAINTENANCE_SECRET=choose-a-long-private-maintenance-secret
```

Supabase provides service credentials to Edge Functions through built-in environment variables; do not add service-role keys to this repository or to browser code.

The `COURSE_MAINTENANCE_SECRET` is only for service release maintenance. Use it from a scheduled Supabase job or a private server call with `Authorization: Bearer <secret>` so due releases can open or close without exposing that secret to students.

8. Deploy the functions in `functions/`.
9. Add the project URL and anon key to:

```text
assets/course-materials/information-security/week-01/lecture/quiz/config.js
```

## Teacher Tools

- `quiz/teacher.html` starts live sessions, shows the QR code, exports results, and surfaces the most-missed concepts.
- `quiz/bank.html` imports new question-bank items into Supabase from JSON. It requires the teacher PIN and the safe browser publishable key in `config.js`.
- `exit-ticket/` lets students save a short reflection after lecture. In demo mode it stays in browser local storage; with Supabase configured it calls `course-submit-reflection`.
- `teacher/` summarizes exit tickets by lecture, average confidence, low-confidence count, next actions, and recent muddy points. With Supabase configured it calls `course-reflection-summary`.
- `portfolio/` lets students export local learning evidence and optionally submit a portfolio record to Supabase through `course-submit-portfolio`.
- `assessment/` imports portfolio JSON manually and can load submitted portfolio records through `course-portfolio-summary` with the teacher PIN.

Deploy all Edge Functions:

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

The browser demo mode includes 10-question banks for the active lectures and bridge missions configured in `config.js`. Supabase mode uses question rows stored in the database. For a fast classroom pilot, run `seed/tc2007b_demo_question_bank.sql`; for custom or private banks, import each lecture bank through `quiz/bank.html`.

To move older `quiz_*` question banks into the authenticated activity model, use the compatibility path in `docs/course-platform/operations/legacy-quiz-migration.md`. It migrates question banks only, not old typed-name attempts.

Question imports expect:

```json
[
  {
    "prompt": "Question text",
    "explanation": "Shown after submission when explanations are enabled.",
    "difficulty": "easy",
    "topic": ["cia", "availability"],
    "options": [
      { "text": "Choice A", "is_correct": false },
      { "text": "Choice B", "is_correct": true }
    ]
  }
]
```

## Security Notes

The browser never receives correct answers in the Supabase version. Questions are selected, shuffled, and graded in Edge Functions using Supabase's built-in server-side credentials.

Do not put high-stakes exam question banks or answer keys in this public repository. Use the demo seed only for a classroom pilot or low-stakes checks.

Trusted functions reject unapproved institutional email domains through `_shared/identity.ts`. External access grants are an exact-address exception to that check, recorded by an instructor from the roster panel and stored in `external_access_grants`. Use them for guest professors, external collaborators, and QA test accounts.

A `COURSE_TEST_EMAILS` secret provides the same exception without a database row. It exists for bootstrap and recovery; prefer panel grants, which are audited and revocable without a redeploy. Addresses are never committed to this repository, since `platform-config.js` is served publicly.

```bash
supabase secrets set COURSE_TEST_EMAILS="qa.address@example.com"
```

See `docs/course-platform/operations/qa-test-accounts.md`.

## Operations

Before using the authenticated platform for grade-bearing activities, read `docs/course-platform/operations/supabase-launch-checklist.md`, read `docs/course-platform/operations/semester-operations-runbook.md`, review `docs/course-platform/implementation/spec-coverage-audit.md`, review `docs/course-platform/operations/semester-setup-decisions.md`, review `docs/course-platform/operations/roster-import-guide.md`, copy `docs/course-platform/operations/tc2007b-roster-template.csv` into private teacher storage before adding real students, copy `docs/course-platform/operations/live-supabase-evidence-packet.md` into private teacher storage, copy `docs/course-platform/operations/semester-setup-decisions.md` into private teacher storage before filling it, read `docs/course-platform/operations/deploying-edge-functions.md` before the first Edge Function deploy, use `docs/course-platform/operations/supabase-powershell-command-sheet.md` for PowerShell commands, run `supabase/tests/rls_auth_platform_checks.sql` before grade-bearing use, and run `supabase/tests/post_launch_smoke_sanity_checks.sql` after the live smoke test.

The runbook covers backup and restore procedure, RLS Policy Tests, teacher pre-class checks, semester rollover, privacy and data retention notes, and incidents for wrong roster, duplicate student, missed activity, and connection failure.

## Local Verification

Run this before pushing course-platform changes:

```powershell
node tools/verify-course-platform.js
node tools/verify-auth-course-platform.js
node tools/verify-auth-app-shell.js
node tools/verify-auth-command-center.js
node tools/verify-auth-institutional-email-guard.js
node tools/verify-auth-identity-confirmation.js
node tools/verify-auth-section-management.js
node tools/verify-auth-foundation-seed.js
node tools/verify-release-engine.js
node tools/verify-auth-release-maintenance.js
node tools/verify-auth-teacher-context-switchers.js
node tools/verify-auth-teacher-context-tools.js
node tools/verify-auth-live-activity-controls.js
node tools/verify-auth-roster-management.js
node tools/verify-auth-roster-corrections.js
node tools/verify-auth-role-permissions.js
node tools/verify-auth-ta-release-guard.js
node tools/verify-auth-content-library.js
node tools/verify-auth-content-access.js
node tools/verify-auth-scheduled-release-access.js
node tools/verify-auth-activity-schema.js
node tools/verify-auth-attempt-lifecycle.js
node tools/verify-auth-speed-bonus-policy.js
node tools/verify-auth-activity-player.js
node tools/verify-auth-quiz-compatibility.js
node tools/verify-auth-session-continuation.js
node tools/verify-auth-gradebook-schema.js
node tools/verify-auth-gradebook-sync.js
node tools/verify-auth-gradebook-review.js
node tools/verify-auth-gradebook-export-evidence.js
node tools/verify-auth-gradebook-adjustments.js
node tools/verify-auth-gradebook-settings.js
node tools/verify-auth-weighted-grade-summary.js
node tools/verify-auth-gradebook-status-records.js
node tools/verify-auth-participation-events.js
node tools/verify-auth-student-records.js
node tools/verify-auth-student-progress.js
node tools/verify-auth-review-coach.js
node tools/verify-auth-teacher-insights.js
node tools/verify-auth-exit-tickets.js
node tools/verify-auth-portfolio-entries.js
node tools/verify-auth-portfolio-export.js
node tools/verify-auth-audit-log-viewer.js
node tools/verify-auth-operations-runbook.js
node tools/verify-auth-supabase-launch-checklist.js
node tools/verify-auth-spec-coverage-audit.js
node tools/verify-auth-live-evidence-packet.js
node tools/verify-auth-powershell-launch-commands.js
node tools/verify-auth-roster-import-packet.js
node tools/verify-auth-post-launch-sanity-sql.js
node tools/verify-auth-semester-setup-decisions.js
node tools/verify-auth-qa-test-accounts.js
```

The Instructor Command Center verifier checks the role-aware signed-in home, grouped instructor navigation, selected-session workspace, supported contextual actions, responsive shell markers, and accessible disclosures.

The course verifier checks lecture question-bank coverage, malformed answer keys, local course links, JavaScript syntax, and accidental server-secret references in public files. The authenticated-platform verifier checks the Phase 1 Supabase foundation schema, release states, class session states, RLS enablement, and browser access revokes. The app-shell and foundation-seed verifiers check the authenticated entry page, context function, and safe TC2007B demo course structure. The release-engine, release-maintenance, teacher-context, context-aware teacher tools, live activity controls, section-management, roster-management, roster correction and profile merge, role-permission, TA-release-guard, content-library, institutional-email-guard, identity-confirmation, content-access, scheduled-release, activity-schema, attempt-lifecycle, speed-bonus, activity-player, quiz-compatibility, session-continuation, gradebook-schema, gradebook-sync, gradebook-review, gradebook-export-evidence, gradebook-adjustments, gradebook-settings, weighted-grade-summary, gradebook-status-records, participation-events, student-records, student-progress, review-coach, teacher-insights, exit-ticket, portfolio-entry, portfolio-export, audit-log-viewer, operations-runbook, Supabase launch-checklist, spec-coverage, and semester setup decisions verifiers check teacher release controls, service release maintenance, teacher context switchers, context-aware teacher tools, live activity controls, instructor section setup before roster import, roster import/profile claiming, roster correction and profile merge, scoped teaching-assistant permissions, teaching assistants can view assigned releases but cannot change release states, instructor-only content item authoring with draft release creation, trusted functions reject unapproved institutional email domains, student roster identity confirmation, authenticated released-content gates, scheduled releases whose open time has arrived, signed-in activity storage, trusted server-side attempt start/submit behavior including release-configured attempt limits, capped speed bonuses that feed final scores without replacing correctness, the authenticated activity player, legacy question-bank migration, class pause and continuation controls, official grading/audit tables, automatic score synchronization into official gradebook records, the teacher gradebook review/export surface, CSV evidence fields for identity, activity, source attempt, submission state, scores, and timestamps, manual score adjustments with locking, instructor gradebook category settings, official missing/excused gradebook records, weighted teacher/student grade summaries, authenticated participation event recording, teacher student-record inspection across scores, attempts, exit tickets, and portfolio evidence, signed-in student progress recommendations, authenticated Review Coach guidance, teacher learning-loop summaries, authenticated exit tickets, authenticated portfolio evidence linked to gradebook categories, student-owned portfolio export, instructor audit-log review, semester operations hardening, the live Supabase launch checklist, the success-criteria coverage audit, and the teacher's private pre-launch decision template for domains, TA use, grading weights, content storage, LMS export needs, and retention.
