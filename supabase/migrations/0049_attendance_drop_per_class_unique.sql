-- Attendance is a day, not a class. (Step 2 of 2 — see 0048.)
--
-- Apply this only after the edge functions that write class_attendance have
-- been deployed against 0048's constraint:
--   course-session-join      (the QR scan)
--   course-class-record      (Mark present)
--
-- Until this runs, 0041's `unique (class_session_id, profile_id)` still refuses
-- a student's second day, so a resumed class cannot record its own attendance.
-- After it runs, the only remaining guarantee is one row per student per class
-- **per day**, which is the product rule.

alter table public.class_attendance
  drop constraint if exists class_attendance_class_session_id_profile_id_key;
