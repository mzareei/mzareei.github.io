# TC2007B Semester Setup Decisions

Private teacher planning copy. Copy this template into private teacher-controlled or institution-controlled storage before filling it in for a real term.

Do not commit completed copies that contain real student data, private Supabase project details, institutional policy notes, private grading decisions, roster files, LMS export samples with names, or backup locations.

Use this packet before the first grade-bearing launch. It turns the open decisions from the platform spec into a concrete term setup record so the course can be operated consistently across both sections.

## Course Term And Sections

| Field | Decision | Evidence or note | Teacher initials |
| --- | --- | --- | --- |
| Course code | TC2007B |  |  |
| Course title | Information Security |  |  |
| Term label |  |  |  |
| Section A official name/code |  |  |  |
| Section B official name/code |  |  |  |
| Expected students per section |  |  |  |
| First grade-bearing class date |  |  |  |
| GitHub Pages URL for students |  |  |  |
| Authenticated app URL for students |  |  |  |

## Institutional Email Domains

Decision needed: Allowed institutional domain or domains.

| Check | Decision | Evidence or note | Teacher initials |
| --- | --- | --- | --- |
| Approved student domain 1 |  |  |  |
| Approved student domain 2 |  |  |  |
| Instructor/test account domain |  |  |  |
| Are personal emails blocked from graded work? | Yes / No |  |  |
| Are unrostered institutional emails blocked from graded work? | Yes / No |  |  |
| Where this is configured | `assets/course-materials/information-security/platform-config.js` and Supabase Auth settings |  |  |

Before grade-bearing use, test one rostered email, one unrostered institutional email, and one wrong-domain email.

## Teaching Assistant Plan

Decision needed: Will teaching assistants be used in the first semester?

| Check | Decision | Evidence or note | Teacher initials |
| --- | --- | --- | --- |
| Teaching assistants used this term | Yes / No |  |  |
| TA can view assigned-section results | Yes / No |  |  |
| TA can help run live activities | Yes / No |  |  |
| TA can export gradebook evidence | Yes / No |  |  |
| TA can adjust or lock grades | No |  |  |
| TA roster rows imported and verified | Yes / No / Not applicable |  |  |

Recommended first-semester default: teaching assistants may help monitor and export assigned-section evidence, but only the instructor adjusts or locks official grades.

## Official Grading Weights

Decision needed: Official grading category weights.

Keep the final weights here aligned with `gradebook_categories` before any student activity counts toward the final grade.

| Category | Weight percent | Drop lowest count | Counts toward final grade? | Notes | Teacher initials |
| --- | ---: | ---: | --- | --- | --- |
| Quizzes |  |  | Yes / No |  |  |
| Missions / classroom activities |  |  | Yes / No |  |  |
| Participation / pulses |  |  | Yes / No |  |  |
| Exit tickets |  |  | Yes / No |  |  |
| Portfolio evidence |  |  | Yes / No |  |  |
| Exam preparation / reviews |  |  | Yes / No |  |  |
| Other |  |  | Yes / No |  |  |
| Total | 100 |  |  |  |  |

Before launch, confirm that the teacher gradebook settings page shows the same weights and that a test student summary calculates the expected weighted progress.

## Content Storage And Privacy

Decision needed: Whether course materials should live in Supabase records, protected app files, or a mix of both.

Use this table to classify material before publishing it.

| Content type | Recommended location | Final decision | Notes | Teacher initials |
| --- | --- | --- | --- | --- |
| Public syllabus and policies | Public GitHub Pages |  |  |  |
| Released lecture pages | Public GitHub Pages or release-gated app routes |  |  |  |
| Future lecture materials | Protected app files or Supabase records |  |  |  |
| Low-stakes practice question banks | Supabase records or safe seed files |  |  |  |
| Grade-bearing question banks | Supabase records only |  |  |  |
| Answer keys and scoring rules | Server-side functions or private records only |  |  |  |
| Rubrics | Supabase records or private teacher storage |  |  |  |
| Student submissions | Supabase records only |  |  |  |

Default policy: use a mix of both public and protected storage. Public materials can stay public, but high-stakes questions, answer keys, future private material, and grade-bearing definitions should not be committed to public static files.

## LMS Gradebook Import Format

Decision needed: Whether the school requires LMS gradebook import formatting.

| Field | Decision | Evidence or note | Teacher initials |
| --- | --- | --- | --- |
| LMS name |  |  |  |
| LMS import required | Yes / No |  |  |
| Required file type | CSV / XLSX / Other |  |  |
| Required student identifier field |  |  |  |
| Required email field |  |  |  |
| Required section field |  |  |  |
| Required score format | Percent / points / both |  |  |
| Required date/time format |  |  |  |
| Tested with sample export | Yes / No |  |  |

The platform export should always keep student ID, institutional email, section, activity, raw score, final score, submission state, and timestamp. Add an LMS-specific copy or conversion only after the official format is confirmed.

## Data Retention After Semester

Decision needed: Data retention policy after the semester ends.

| Record type | Retention period | Storage location | Deletion/archive owner | Teacher initials |
| --- | --- | --- | --- | --- |
| Official gradebook export |  |  |  |  |
| Supabase database backup or dump |  |  |  |  |
| Roster import file |  |  |  |  |
| Audit log |  |  |  |  |
| Student attempts and responses |  |  |  |  |
| Exit tickets |  |  |  |  |
| Portfolio evidence |  |  |  |  |
| Screenshots or classroom evidence |  |  |  |  |

Retention period should follow institutional policy. If policy is unclear, keep official grading evidence in private institution-controlled storage and do not publish or commit it.

## Release And Pacing Defaults

Use this section to decide how much students can see before and after class.

| Item | Default decision | Notes | Teacher initials |
| --- | --- | --- | --- |
| Future weeks visible from day one | No |  |  |
| Release lecture before class | Yes / No / Case by case |  |  |
| Release lecture after class | Yes / No / Case by case |  |  |
| Keep completed class in review mode | Yes / No |  |  |
| Continue unfinished class into next meeting | Yes, use continuation session |  |  |
| Section A and Section B pacing independent | Yes |  |  |

## Speed Bonus Policy

Use this section to keep speed points motivational rather than dominant.

| Policy item | Decision | Evidence or note | Teacher initials |
| --- | --- | --- | --- |
| Speed bonus enabled for live quizzes | Yes / No |  |  |
| Maximum speed bonus |  |  |  |
| Speed bonus counts toward official final score | Yes / No / Bonus only |  |  |
| Accessibility or connectivity exceptions handled by adjustment flow | Yes / No |  |  |

Recommended default: speed bonus may be a small capped engagement signal, but correctness and completion remain the main grading evidence.

## Backup And Export Location

| Item | Private location or owner | Verified date | Teacher initials |
| --- | --- | --- | --- |
| Supabase backup plan |  |  |  |
| Manual database export location |  |  |  |
| Gradebook CSV export location |  |  |  |
| Roster private copy location |  |  |  |
| Completed evidence packet location |  |  |  |
| Completed semester setup decisions location |  |  |  |

## Grade-Bearing Go-Live Decision

Do not mark Go until the live evidence packet and this decisions packet are both complete.

| Gate | Result | Evidence or note | Teacher initials |
| --- | --- | --- | --- |
| Allowed domains decided and tested | Go / No-Go |  |  |
| TA role policy decided | Go / No-Go |  |  |
| Grading weights configured and tested | Go / No-Go |  |  |
| Content storage policy decided | Go / No-Go |  |  |
| LMS import needs decided or waived | Go / No-Go |  |  |
| Data retention policy decided | Go / No-Go |  |  |
| Backup/export location confirmed | Go / No-Go |  |  |
| Live Supabase evidence packet complete | Go / No-Go |  |  |

## Decision Summary

Final note:

```text
I reviewed the semester setup decisions above and approve / do not approve the authenticated TC2007B platform for grade-bearing classroom use this term.
```
