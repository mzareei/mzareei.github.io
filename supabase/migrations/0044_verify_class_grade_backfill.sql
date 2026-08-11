-- Prove the 0043 backfill actually landed, and repair it if it did not.
--
-- 0043 linked each class-grade item to its class session by rebuilding the
-- title course-class-record had written. That match is exact-string and
-- therefore brittle: a session renamed since the grades were posted, or a title
-- long enough to hit the 180-character truncation, leaves class_session_id null
-- — and a null there means the student's My Grades screen silently shows them
-- nothing at all. Silence is the worst possible failure here, so this migration
-- refuses to finish while one exists.

-- Fallback match: pull the class number back out of the title and disambiguate
-- by the section the item's own scores were posted into. Sequence numbers
-- repeat across sections, so the number alone is not enough to identify a
-- session — that pairing is what makes this safe to run.
update public.gradebook_items as item
set class_session_id = candidate.id
from public.class_sessions as candidate
where item.class_session_id is null
  and item.title ~ '^Class [0-9]+ — '
  and candidate.course_id = item.course_id
  and candidate.sequence_number = (substring(item.title from '^Class ([0-9]+) — '))::int
  and candidate.section_id = (
    select score.section_id
    from public.gradebook_scores as score
    where score.gradebook_item_id = item.id
    limit 1
  );

do $$
declare
  orphaned int;
  linked int;
begin
  select count(*) into orphaned
  from public.gradebook_items as item
  join public.gradebook_categories as category on category.id = item.category_id
  where category.name = 'Class grades'
    and item.class_session_id is null;

  if orphaned > 0 then
    raise exception
      'ABORT: % class-grade item(s) are not linked to a class session. Students would see no grade for them. Re-post those classes from the class record screen, or link them by hand, before continuing.',
      orphaned;
  end if;

  select count(*) into linked
  from public.gradebook_items
  where class_session_id is not null;

  raise notice 'class-grade backfill verified: % item(s) linked to a class session', linked;
end $$;

-- Nothing may reach the gradebook without saying which class it belongs to.
-- Previously the only thing standing between a stray item and a student's
-- screen was that nobody had inserted one.
do $$
declare
  quiz_items int;
begin
  select count(*) into quiz_items
  from public.gradebook_items as item
  join public.gradebook_categories as category on category.id = item.category_id
  where category.name = 'Quizzes';

  if quiz_items > 0 then
    raise exception 'ABORT: % separate quiz gradebook item(s) survived 0043.', quiz_items;
  end if;
end $$;
