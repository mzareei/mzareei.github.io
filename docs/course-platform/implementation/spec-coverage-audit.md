# TC2007B Authenticated Platform Spec Coverage Audit

Completion Status: Repository implementation substantially complete; live Supabase proof still required.

This audit maps the original `tc2007b-authenticated-course-platform-spec.md` requirements to current repository evidence. It is intentionally conservative: repository verifiers prove structure, guardrails, links, browser-secret scanning, and expected trusted-function markers, but they do not prove that the live Supabase project has been configured, migrated, deployed, and smoke-tested.

This audit does not replace live Supabase integration testing.

Use `docs/course-platform/operations/live-supabase-evidence-packet.md` as the private live evidence packet when recording the live proof required below.

## Spec Success Criteria Coverage

| Criterion | Repository Evidence | Live Proof Required |
| --- | --- | --- |
| SC-1: Students access graded activities only after institutional sign-in. | Auth shell, institutional domain guard, roster/profile claim flow, identity confirmation, and activity access verifiers. Evidence: `node tools\verify-auth-app-shell.js`, `node tools\verify-auth-institutional-email-guard.js`, `node tools\verify-auth-identity-confirmation.js`, `node tools\verify-auth-activity-player.js`. | Configure Supabase Auth email OTP, approved redirect URLs, anon key, and test one rostered student sign-in. |
| SC-2: Section A and Section B have independent release visibility. | Course sections, enrollments, release tables, release console, section context, and content-access gate verifiers. Evidence: `node tools\verify-auth-course-platform.js`, `node tools\verify-auth-section-management.js`, `node tools\verify-auth-teacher-context-switchers.js`, `node tools\verify-auth-content-access.js`. | Use two test students in different sections and verify each sees only its released content. |
| SC-3: Direct unreleased URLs return access denied. | Authenticated content access and scheduled-release checks require section/release validation before rendering. Evidence: `node tools\verify-auth-content-access.js`, `node tools\verify-auth-scheduled-release-access.js`. | Open an unreleased content URL while signed in as a student and confirm the access-denied state in production. |
| SC-4: Correct quiz answers and scoring keys are not shipped to browser code for graded work. | Server-side activity attempt function, question selection/grading markers, and public file secret scanning. Evidence: `node tools\verify-course-platform.js`, `node tools\verify-auth-activity-schema.js`, `node tools\verify-auth-attempt-lifecycle.js`. | Confirm private/high-stakes question banks are stored in Supabase-controlled records and not committed to public static files. |
| SC-5: A live quiz can be started, joined by QR code, answered, graded, and exported under one authenticated identity. | Live activity controls, activity player, gradebook sync, export evidence, and launch checklist are present. Evidence: `node tools\verify-auth-live-activity-controls.js`, `node tools\verify-auth-activity-player.js`, `node tools\verify-auth-gradebook-sync.js`, `node tools\verify-auth-gradebook-export-evidence.js`, `node tools\verify-auth-supabase-launch-checklist.js`. | Complete one teacher-plus-student smoke test from QR scan to gradebook export in the live project. |
| SC-6: A class session can move from planned to live to paused to continued or closed. | Session state tables, transition functions, teacher session UI, and continuation verifier. Evidence: `node tools\verify-auth-session-continuation.js`, `node tools\verify-auth-live-activity-controls.js`. | Run a real or test class session through pause, continuation, and close states. |
| SC-7: Teacher can inspect student-level records across quizzes, exit tickets, missions, and portfolio submissions. | Student records page and function aggregate scores, attempts, exit tickets, and portfolio evidence. Evidence: `node tools\verify-auth-student-records.js`, `node tools\verify-auth-exit-tickets.js`, `node tools\verify-auth-portfolio-entries.js`. | Submit one attempt, exit ticket, and portfolio entry as a test student and inspect the combined teacher record. |
| SC-8: Grade export includes identity, section, activity, scores, state, and timestamp evidence. | Gradebook review/export and export evidence verifiers require these fields. Evidence: `node tools\verify-auth-gradebook-review.js`, `node tools\verify-auth-gradebook-export-evidence.js`. | Export a live section CSV and check student ID, institutional email, section, activity, raw score, final score, submission state, and timestamp. |
| SC-9: Row Level Security is enabled on every browser-exposed table. | Migrations include RLS enablement and browser role revokes; RLS SQL check is documented. Evidence: `node tools\verify-auth-course-platform.js`, `node tools\verify-auth-operations-runbook.js`. | Run `supabase/tests/rls_auth_platform_checks.sql` in the production Supabase SQL editor after all migrations. |
| SC-10: Backup and restore check is documented before grade-bearing use. | Semester operations runbook and launch checklist document backup, restore, PITR, exports, and stop points. Evidence: `node tools\verify-auth-operations-runbook.js`, `node tools\verify-auth-supabase-launch-checklist.js`. | Confirm backup tier or manual export location, and keep one gradebook export before using activities for grades. |

## Implementation Order Coverage

| Phase | Repository Evidence | Live Proof Required |
| --- | --- | --- |
| Phase 0: Current Baseline Audit | Course verifier checks lecture bank coverage, local links, JavaScript syntax, server-secret references, and function count. Evidence: `node tools\verify-course-platform.js`. | Run the verifier immediately before merging/deploying. |
| Phase 1: Identity And Roster Foundation | Foundation schema, institutional email guard, section management, roster import, roster corrections, role permissions, TA rules, and identity confirmation are represented. Evidence: `node tools\verify-auth-course-platform.js`, `node tools\verify-auth-roster-management.js`, `node tools\verify-auth-roster-corrections.js`, `node tools\verify-auth-role-permissions.js`. | Configure Auth email OTP, import a real or test roster, and verify rostered/unrostered account behavior. |
| Phase 2: Authenticated App Shell | Protected app shell, auth context function, dashboards, teacher/student navigation, and foundation seed are represented. Evidence: `node tools\verify-auth-app-shell.js`, `node tools\verify-auth-foundation-seed.js`. | Visit the live app as teacher and student after anon key and redirects are configured. |
| Phase 3: Release Engine | Release tables, release transitions, content access gates, scheduled release maintenance, content library, and session controls are represented. Evidence: `node tools\verify-release-engine.js`, `node tools\verify-auth-release-maintenance.js`, `node tools\verify-auth-content-library.js`, `node tools\verify-auth-content-access.js`. | Test draft, scheduled, released, live, paused, review-only, closed, and wrong-section access in Supabase. |
| Phase 4: Authenticated Quiz And Activity Storage | Activity templates, instances, banks, questions, options, attempts, responses, server-side grading, attempt lifecycle, speed policy, player, and legacy compatibility are represented. Evidence: `node tools\verify-auth-activity-schema.js`, `node tools\verify-auth-attempt-lifecycle.js`, `node tools\verify-auth-speed-bonus-policy.js`, `node tools\verify-auth-activity-player.js`, `node tools\verify-auth-quiz-compatibility.js`. | Complete a low-stakes authenticated activity with at least one student and inspect stored attempts/responses. |
| Phase 5: Class Pause And Continuation | Session continuation, carry-forward releases, and live activity controls are represented. Evidence: `node tools\verify-auth-session-continuation.js`, `node tools\verify-auth-live-activity-controls.js`. | Pause an unfinished test session, create a continuation, and confirm reporting links the original and continuation sessions. |
| Phase 6: Gradebook And Exports | Gradebook tables, sync, review/export, evidence fields, adjustments, locking, settings, weighted summary, missing/excused records, and participation events are represented. Evidence: `node tools\verify-auth-gradebook-schema.js`, `node tools\verify-auth-gradebook-sync.js`, `node tools\verify-auth-gradebook-export-evidence.js`, `node tools\verify-auth-gradebook-adjustments.js`, `node tools\verify-auth-gradebook-status-records.js`. | Export a section gradebook from live data and verify it against teacher/student records. |
| Phase 7: Learning Loop | Student progress, Review Coach, teacher insights, exit tickets, portfolio entries, portfolio export, and student-record inspection are represented. Evidence: `node tools\verify-auth-student-progress.js`, `node tools\verify-auth-review-coach.js`, `node tools\verify-auth-teacher-insights.js`, `node tools\verify-auth-exit-tickets.js`, `node tools\verify-auth-portfolio-entries.js`, `node tools\verify-auth-student-records.js`. | Generate live data for one student and confirm recommendations, insights, and portfolio evidence reflect it. |
| Phase 8: Hardening And Semester Operations | Runbook, RLS safety SQL, audit-log viewer, Supabase launch checklist, and deployment manifest are represented. Evidence: `node tools\verify-auth-operations-runbook.js`, `node tools\verify-auth-audit-log-viewer.js`, `node tools\verify-auth-supabase-launch-checklist.js`. | Complete launch checklist, RLS SQL check, backup/export confirmation, and teacher/student smoke test before grade-bearing use. |

## Live Supabase Completion Gates

Cannot Mark Goal Complete Until these live gates have evidence outside the repository:

1. Apply all migrations through `0010_profile_identity_confirmations.sql`.
2. Run the safe seed files for the course shell, practice activity, and demo bank.
3. Configure Supabase Auth email OTP.
4. Configure approved institutional email domains, site URL, and redirect URLs.
5. Add browser-safe Supabase URL and anon key to the public config files.
6. Deploy all Edge Functions listed in `supabase/course-platform-deployment-manifest.json`.
7. Run `supabase/tests/rls_auth_platform_checks.sql`.
8. Import a small real or test roster.
9. Complete one teacher-plus-student smoke test.
10. Verify wrong-section and direct-unreleased access denial.
11. Complete one activity from QR scan to gradebook export.
12. Confirm backup/export location before grade-bearing use.

## Current Conclusion

The repository now contains the authenticated platform foundation, activity flow, gradebook, learning loop, operations materials, and verification guardrails described by the spec. The remaining gap is not another local file; it is live deployment evidence from Supabase. Until the live gates above are completed and documented, the platform should be treated as repository-ready but not yet fully proven for official grade-bearing classroom use.

Completed evidence should be recorded in a private copy of `docs/course-platform/operations/live-supabase-evidence-packet.md`, not committed to the public repository.
