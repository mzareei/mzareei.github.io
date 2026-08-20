-- 2026-08-20: three students were thrown out of the end-of-class quiz
-- mid-class (expired auth tokens at the 1-hour mark, right at quiz time) and
-- had to start over from question 1; one answered 11 of 12 questions and has
-- nothing stored at all. A running attempt now survives any interruption:
--   questions_json    the exact questions (and option order) dealt at first
--                     start, frozen so a resumed attempt is never re-shuffled;
--   progress_answers  question_id -> selected_option_id, saved as the student
--                     goes (merged monotonically; grading still reads
--                     student_responses written at submit);
--   clock_t0          when the student tapped "Let's go" — the per-question
--                     schedule anchor a resumed player rebuilds from.
alter table public.student_attempts
  add column if not exists questions_json jsonb,
  add column if not exists progress_answers jsonb not null default '{}'::jsonb,
  add column if not exists clock_t0 timestamptz;
