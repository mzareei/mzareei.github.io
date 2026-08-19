-- The exit ticket asked for 50 words; the first real class run showed that is
-- a stretch in the last five minutes. New floor: 40. Classes already closed
-- keep the 50 they were graded under.
alter table public.class_sessions
  alter column reflection_min_words set default 40;

update public.class_sessions
  set reflection_min_words = 40
  where reflection_min_words = 50
    and state not in ('closed', 'cancelled');
