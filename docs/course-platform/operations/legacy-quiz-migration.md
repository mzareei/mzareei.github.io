# Legacy Quiz Migration

This runbook describes the compatibility path from the original `quiz_*` pilot tables into the authenticated TC2007B activity model.

The old live quiz pilot is useful for classroom practice, but old attempts were identified by typed names or typed student identifiers. They are not safe enough to become official gradebook evidence. The compatibility path therefore migrates question banks only.

## What Migrates

The `course-quiz-compatibility` Edge Function can copy one legacy lecture bank at a time.

Source tables:

```text
quiz_lectures
quiz_questions
quiz_options
```

Target tables:

```text
content_items
question_banks
questions
question_options
activity_templates
activity_instances
```

The migration normalizes old difficulty values into the authenticated model's allowed values. For example, old `challenge` rows become `hard`.

## What Does Not Migrate

Do not migrate legacy student attempts, answers, typed names, or typed identifiers into official records.

Excluded legacy tables:

```text
quiz_sessions
quiz_attempts
quiz_attempt_questions
quiz_answers
```

Do not migrate legacy student attempts because they were not tied to institutional OTP sign-in, roster profiles, or section enrollments.

## List Legacy Lectures

Call the function with an instructor session token:

```json
{
  "course_id": "tc2007b",
  "action": "list_legacy_lectures"
}
```

The response shows each legacy lecture, active question count, and whether a target authenticated bank already exists.

## Migrate One Lecture Bank

Example request:

```json
{
  "course_id": "tc2007b",
  "action": "migrate_lecture_bank",
  "lecture_id": "tc2007b-w1-l1",
  "content_slug": "legacy-tc2007b-w1-l1",
  "section_ids": ["<section-a-uuid>", "<section-b-uuid>"],
  "question_count": 10
}
```

If `section_ids` is empty, the function migrates the bank and activity template but does not create `activity_instances`.

## Validation Before Grade Use

1. Run `list_legacy_lectures`.
2. Migrate one lecture.
3. Open the authenticated activity player with a test student.
4. Submit a low-stakes attempt.
5. Confirm the attempt syncs into the official gradebook.
6. Only then release the migrated activity for real grades.
