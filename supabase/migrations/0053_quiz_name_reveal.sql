-- Consent to have your real name shown on the class podium.
--
-- On the ATTEMPT, not the profile, and deliberately: the question a student is
-- answering is "do you want your name shown for this quiz, in front of this
-- room, today" — not "may we always name you". A new quiz starts anonymous
-- again, which is the honest reading of the tap.
--
-- Default false so a quiz that ran before this migration, and a student who
-- never answers, both stay anonymous.
alter table public.student_attempts
  add column if not exists name_revealed boolean not null default false;

comment on column public.student_attempts.name_revealed is
  'Student opted in to having their real name shown on the class podium for THIS attempt. Per-quiz consent; never inherited by a later attempt.';
