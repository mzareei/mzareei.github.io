# TC2007B Roster Import Guide

Use this guide when preparing the first real or test roster for the authenticated TC2007B course app.

Template:

```text
docs/course-platform/operations/tc2007b-roster-template.csv
```

Do not commit real rosters, student exports, corrected roster files, or files containing real student names, IDs, or institutional emails. Keep completed roster files in private teacher-controlled or institution-controlled storage.

## Required CSV Format

The recommended header is:

```text
institutional_email,full_name,student_identifier,section_code,role
```

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `institutional_email` | Yes | Must be lowercase or will be normalized by the importer. Must use an allowed institutional domain such as `tec.mx` or `itesm.mx`. |
| `full_name` | Yes | Use the official roster name. Students can later confirm or report identity issues. |
| `student_identifier` | Recommended | Use the official student ID or employee/test identifier. |
| `section_code` | Yes | Must already exist in the course, such as `A` or `B` for the demo sections. |
| `role` | Yes | Use `student`, `teaching_assistant`, `instructor`, or `observer`. Blank roles default to `student`. |

Allowed aliases in the browser importer:

| Alias | Treated As |
| --- | --- |
| `email` | `institutional_email` |
| `name` | `full_name` |
| `student_id` | `student_identifier` |
| `matricula` | `student_identifier` |
| `section` | `section_code` |

The canonical header is still preferred because it matches the Edge Function contract directly.

## Safe Test Template

The template includes fake rows only. The `example.tec.mx` domain is intentionally not meant for real import:

```text
institutional_email,full_name,student_identifier,section_code,role
student.test.001@example.tec.mx,Test Student One,A00000001,A,student
student.test.002@example.tec.mx,Test Student Two,A00000002,B,student
ta.test.001@example.tec.mx,Test Teaching Assistant,T00000001,A,teaching_assistant
instructor.test.001@example.tec.mx,Test Instructor,I00000001,A,instructor
observer.test.001@example.tec.mx,Test Observer,O00000001,B,observer
```

Replace the sample rows before real roster import. If you want to test the full sign-in flow, use institutional test accounts you control, such as real `tec.mx` or `itesm.mx` test emails approved for the course.

## Import Steps

1. Confirm the course sections exist before importing the roster.
2. Copy the template into private teacher storage and rename it for the term and section.
3. Replace all sample rows with the official roster rows.
4. Keep the header row unchanged unless you are intentionally using one of the allowed aliases.
5. Open the authenticated app as an instructor.
6. Open the Roster Import page.
7. Confirm allowed domains match the institutional domains.
8. Paste the CSV contents into the CSV roster box.
9. Click Preview roster.
10. Review accepted and rejected rows.
11. Fix rejected rows in the private roster copy.
12. Click Apply accepted rows only after the preview is clean.
13. Record the result in `docs/course-platform/operations/live-supabase-evidence-packet.md`.

## Common Rejection Reasons

The live importer may reject a row with these messages:

| Message | Meaning | Fix |
| --- | --- | --- |
| `Invalid institutional email.` | The email is blank or malformed. | Correct the email format. |
| `Email is outside the allowed institutional domains.` | The email does not end with an allowed domain. | Confirm the official institutional email or update the allowed-domain setting intentionally. |
| `Duplicate email in this import.` | The same email appears twice in the pasted CSV. | Keep one row and remove or correct the duplicate. |
| `Full name is required.` | The name column is blank. | Add the official full name. |
| `Section code is required.` | The section column is blank. | Add the intended section code. |
| `Section code does not exist for this course.` | The section has not been created for the course. | Create/update the section first, or correct the section code. |
| `Role is not valid for roster import.` | The role is not one of the accepted values. | Use `student`, `teaching_assistant`, `instructor`, or `observer`. |

## After Import

1. Refresh the current roster table.
2. Confirm each test student appears in the expected section.
3. Ask one test student account to sign in with the institutional email link or code.
4. Confirm the student reaches the correct dashboard.
5. Confirm an unrostered or wrong-domain email cannot access grade-bearing areas.
6. Use roster correction only with a written reason.
7. Use profile merge only after confirming which identity should remain active.

## Evidence To Keep Privately

Keep these records outside the public repository:

1. The private roster CSV you actually imported.
2. A note of accepted/rejected row counts.
3. A note that one rostered student sign-in worked.
4. A note that one unrostered or wrong-domain sign-in was blocked.
5. Any correction or merge reason.

The repository template is safe to commit because it contains fake sample rows only.
