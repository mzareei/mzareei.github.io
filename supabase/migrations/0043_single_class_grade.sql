-- One grade per class, and nothing else.
--
-- Two grading paths used to reach the gradebook and both showed up on the
-- student's screen:
--
--   "Quizzes"      — the raw end-of-class quiz score, posted by the activity
--                    engine, weighted 30% with drop-lowest 1
--   "Class grades" — the real composite computed in course-class-record
--                    (30% pulse + 70% quiz, scaled to the 80% mastery
--                    threshold, x0.8 when the exit ticket is missing),
--                    weighted 0%
--
-- Because the composite carried 0% weight, the weighted course total students
-- saw was the raw quiz score alone — the one number that was never meant to be
-- reported on its own. The composite already contains the quiz, so the quiz
-- item was double-counting a component as if it were a peer.
--
-- Weighted categories go away entirely. There is one grade per class and the
-- course total is their plain average, so there is nothing left for a weight
-- to configure.
--
-- Quiz ATTEMPTS are untouched. They are the input the class grade is computed
-- from; only the separate gradebook slot they were posted into is removed.

-- A class grade belongs to a class session. It was previously matched by
-- reconstructing the title string, which breaks the moment a session is
-- renamed. Make the link explicit so the student view can join on it.
alter table public.gradebook_items
  add column if not exists class_session_id uuid
  references public.class_sessions(id) on delete cascade;

-- Backfill from the title course-class-record wrote: "Class <n> — <title>",
-- truncated to 180 characters. Match on the same construction rather than
-- parsing the number back out.
update public.gradebook_items as item
set class_session_id = session.id
from public.class_sessions as session
where item.class_session_id is null
  and item.course_id = session.course_id
  and item.title = left('Class ' || session.sequence_number || ' — ' || session.title, 180);

-- One class, one grade — enforced here rather than by the title uniqueness that
-- happened to stand in for it.
create unique index if not exists gradebook_items_class_session_key
  on public.gradebook_items (class_session_id)
  where class_session_id is not null;

-- Drop the separate quiz slot. Scores cascade from their item; the category
-- is delete-restricted by its items, so items go first.
delete from public.gradebook_items
where category_id in (
  select id from public.gradebook_categories where name = 'Quizzes'
);

delete from public.gradebook_categories
where name = 'Quizzes';

-- The surviving category is a container, not a weight. Nothing reads
-- weight_percent any more; leaving it at 0 would only invite someone to
-- rediscover it and conclude class grades are worth nothing.
update public.gradebook_categories
set weight_percent = 100,
    drop_lowest_count = 0,
    updated_at = now()
where name = 'Class grades';
