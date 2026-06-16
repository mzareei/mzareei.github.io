# TC2007B Quiz Pilot

This folder contains the Supabase backend for the Week 1 Lecture 1 quiz pilot.

## Deploy Order

1. Create a Supabase project.
2. Run `migrations/0001_quiz_pilot.sql` in the Supabase SQL editor.
3. For a non-sensitive demo bank, run `seed/week01_lecture01_demo.sql`.
4. Set the teacher PIN function secret:

```text
QUIZ_TEACHER_PIN=choose-a-private-pin
```

Supabase provides service credentials to Edge Functions through built-in environment variables; do not add service-role keys to this repository or to browser code.

5. Deploy the functions in `functions/`.
6. Add the project URL and anon key to:

```text
assets/course-materials/information-security/week-01/lecture/quiz/config.js
```

## Security Notes

The browser never receives correct answers in the Supabase version. Questions are selected, shuffled, and graded in Edge Functions using Supabase's built-in server-side credentials.

Do not put high-stakes exam question banks or answer keys in this public repository. Use the demo seed only for a classroom pilot or low-stakes checks.
