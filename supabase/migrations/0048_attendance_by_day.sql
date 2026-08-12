-- Attendance is a day, not a class. (Step 1 of 2 — see 0049.)
--
-- A lecture the professor pauses today and finishes next week is one class with
-- one grade, but two days in a room. 0041 keyed attendance one row per student
-- per class, which cannot say that: the second day's scan collides with the
-- unique constraint and is discarded as a duplicate of the first.
--
-- Engagement and grading are unaffected and stay per class — they key on
-- class_session_id, which a pause does not change. This migration touches
-- attendance only.
--
-- Split across two migrations on purpose. Dropping the old constraint in the
-- same step as adding the new one would leave a window where the deployed
-- edge functions still name `class_session_id,profile_id` as their ON CONFLICT
-- target and no such constraint exists — every check-in would fail with a raw
-- database error, mid-class, for a student standing in front of a QR code.
-- So: add the new constraint here while the old one still stands, deploy the
-- functions, then drop the old one in 0049.
--
-- The date is written by the caller rather than generated, because
-- `timestamptz at time zone 'America/Monterrey'` is STABLE, not IMMUTABLE, and
-- a generated column requires IMMUTABLE. The default covers any writer that
-- forgets; every real writer sets it explicitly from one shared helper.

alter table public.class_attendance
  add column if not exists attendance_date date;

alter table public.class_attendance
  alter column attendance_date
  set default (now() at time zone 'America/Monterrey')::date;

-- Every existing row keeps exactly the meaning it already had: the day it was
-- actually scanned, in the timezone the class happens in.
update public.class_attendance
   set attendance_date = (checked_in_at at time zone 'America/Monterrey')::date
 where attendance_date is null;

alter table public.class_attendance
  alter column attendance_date set not null;

-- First scan of the day still wins: a re-scan after a page reload collides here
-- and is discarded, so the recorded arrival time cannot drift later in the hour.
-- A scan on a different day is a different row, which is the whole point.
--
-- While 0041's `unique (class_session_id, profile_id)` is still in place this
-- constraint is strictly redundant — that is intended. It exists so the edge
-- functions can name it before the older, narrower one goes away.
alter table public.class_attendance
  add constraint class_attendance_session_profile_day_key
  unique (class_session_id, profile_id, attendance_date);

create index if not exists class_attendance_session_day_idx
  on public.class_attendance (class_session_id, attendance_date);
