-- La Subida: the room clock, candy, and correctness settled per round.
--
-- Numbered 0058, not 0057 as first planned: 0057 was taken same-day by
-- 0057_quiz_attempt_resume.sql, the kick-resume hotfix (see docs/05-status.md,
-- "Deploy shape: migration 0057 before the two functions"). Two migrations
-- sharing one version number would make `supabase db push` record the second
-- as already applied and skip it — these columns would silently never exist.
--
-- candy and correct_count are the race; the grade never reads them.
-- round_answer_times is stamped by the SERVER on the first answer it sees for
-- a question, so "fast" cannot be claimed by a client.
-- settled_through is the highest round index already folded into the two
-- counters; settling recomputes from scratch, so it is a cursor, not a lock.

alter table student_attempts
  add column if not exists candy int not null default 0,
  add column if not exists correct_count int not null default 0,
  add column if not exists round_answer_times jsonb not null default '{}'::jsonb,
  add column if not exists settled_through int not null default -1;
