# TC2007B Course Interaction Backend

This folder contains the Supabase backend for the TC2007B live quiz, question-bank import, exit-ticket reflection tools, and portfolio record submissions.

## Deploy Order

1. Create a Supabase project.
2. Run `migrations/0001_quiz_pilot.sql`, `migrations/0002_exit_tickets.sql`, and `migrations/0003_portfolio_submissions.sql` in the Supabase SQL editor.
3. For the non-sensitive course pilot bank, run `seed/tc2007b_demo_question_bank.sql`. It currently covers all active lecture quizzes and bridge sessions.
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
```

The browser demo mode includes 10-question banks for the active lectures and bridge missions configured in `config.js`. Supabase mode uses question rows stored in the database. For a fast classroom pilot, run `seed/tc2007b_demo_question_bank.sql`; for custom or private banks, import each lecture bank through `quiz/bank.html`.

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

## Local Verification

Run this before pushing course-platform changes:

```powershell
node tools/verify-course-platform.js
```

It checks lecture question-bank coverage, malformed answer keys, local course links, JavaScript syntax, and accidental server-secret references in public files.
