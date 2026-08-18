-- Reset ONE group, not the whole course.
--
-- 0042 gave the course a single reset that erases every group at once. That was
-- written when there was one professor and one group. With 402/501/502 running
-- side by side it is a foot-gun: the Classes screen is scoped to the group in
-- the top-bar switcher, so "reset" while looking at 501 read as "reset 501" and
-- meant "reset everything anyone has ever done in this course".
--
-- These functions are the group-sized version. Same rule as 0042 about what
-- survives — lectures, question banks, the schedule, the groups themselves, the
-- roster and the gradebook's category structure are all kept — with two
-- differences that only make sense per group:
--
--   * gradebook_items are NOT deleted. An item is course-wide and shared by
--     every group; deleting it to clear 501 would blank 402's grades too. Only
--     501's gradebook_scores go, and the item is left standing.
--   * The frozen Gen-1 pilot tables (quiz_sessions, quiz_attempts,
--     course_exit_tickets, course_portfolio_submissions) are NOT touched. They
--     carry no section, so there is no honest way to delete "this group's
--     share" of them. Clearing those stays a whole-course operation.
--
-- 0042's course-wide functions are left in place and still work; the whole
-- course is still resettable, but only by deliberately choosing All groups.

create or replace function public.reset_section_activity(
  p_course_id text,
  p_section_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  counts jsonb := '{}'::jsonb;
  n bigint;
  session_ids uuid[];
begin
  -- The section must belong to the course the caller named. Without this a
  -- caller could pass any group's id from any course and have it wiped.
  if not exists (
    select 1 from public.course_sections
     where id = p_section_id and course_id = p_course_id
  ) then
    raise exception 'section_not_in_course';
  end if;

  select coalesce(array_agg(id), '{}') into session_ids
    from public.class_sessions
   where course_id = p_course_id and section_id = p_section_id;

  -- ---------------------------------------------------------- live class data
  delete from public.pulse_answers
    where round_id in (
      select id from public.pulse_rounds
       where course_id = p_course_id and section_id = p_section_id
    );
  get diagnostics n = row_count; counts := counts || jsonb_build_object('pulse_answers', n);

  -- Frees the ON DELETE RESTRICT that a sent checkpoint holds over the
  -- professor's question plan, which is why the plans themselves survive.
  delete from public.pulse_rounds
   where course_id = p_course_id and section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('pulse_rounds', n);

  delete from public.class_attendance
   where course_id = p_course_id and section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_attendance', n);

  -- ------------------------------------------------------------ quiz attempts
  delete from public.student_responses
    where student_attempt_id in (
      select sa.id from public.student_attempts sa where sa.section_id = p_section_id
    );
  get diagnostics n = row_count; counts := counts || jsonb_build_object('student_responses', n);

  delete from public.student_attempts where section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('student_attempts', n);

  -- Instances are per-run, not content: starting a quiz makes a new one.
  delete from public.activity_instances where section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('activity_instances', n);

  -- ------------------------------------------------------ written submissions
  delete from public.exit_tickets
   where course_id = p_course_id and section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('exit_tickets', n);

  delete from public.portfolio_entries
   where course_id = p_course_id and section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('portfolio_entries', n);

  -- ------------------------------------------------------------------ grading
  delete from public.class_grade_overrides
   where course_id = p_course_id and class_session_id = any(session_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_grade_overrides', n);

  -- The scores for this group only. Their grade_adjustments cascade. The ITEMS
  -- stay: they are course-wide, and another group's grades hang off them.
  delete from public.gradebook_scores
   where section_id = p_section_id
     and gradebook_item_id in (
       select id from public.gradebook_items where course_id = p_course_id
     );
  get diagnostics n = row_count; counts := counts || jsonb_build_object('gradebook_scores', n);
  counts := counts || jsonb_build_object('gradebook_items', 0);

  delete from public.participation_events
   where course_id = p_course_id and section_id = p_section_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('participation_events', n);

  -- ---------------------------------------------------------- per-class notes
  delete from public.class_student_notes
   where course_id = p_course_id and class_session_id = any(session_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_student_notes', n);

  delete from public.class_presentation_state
   where class_session_id = any(session_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_presentation_state', n);

  -- -------------------------------------------------- the sessions themselves
  -- Kept, but rewound. A rehearsed class left 'closed' with a spent join code
  -- would otherwise still look like it had happened.
  update public.class_sessions
     set state = 'planned',
         actual_start_at = null,
         actual_end_at = null,
         join_code = null,
         updated_at = now()
   where course_id = p_course_id
     and section_id = p_section_id
     and (state <> 'planned' or actual_start_at is not null or join_code is not null);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_sessions_rewound', n);

  return counts;
end;
$$;

-- Take one student out of ONE group. The course-wide sibling in 0042 unenrols a
-- person from every group at once, which is the wrong tool when the professor
-- of 501 is clearing invented names: a student who also sits in 402 must keep
-- that seat, and their account must survive.
create or replace function public.remove_section_student(
  p_course_id text,
  p_section_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  has_staff_role boolean;
begin
  if not exists (
    select 1 from public.course_sections
     where id = p_section_id and course_id = p_course_id
  ) then
    raise exception 'section_not_in_course';
  end if;

  -- A teacher is never removable through this path, whatever the caller sends.
  select exists (
    select 1 from public.course_memberships
     where profile_id = p_profile_id
       and status = 'active'
       and role in ('platform_owner', 'instructor', 'teaching_assistant')
  ) into has_staff_role;
  if has_staff_role then
    raise exception 'profile_is_staff';
  end if;

  delete from public.section_enrollments
   where profile_id = p_profile_id and section_id = p_section_id;

  -- The course membership only goes when the last group in this course does.
  -- Someone still enrolled in 402 stays a member of the course.
  if not exists (
    select 1
      from public.section_enrollments se
      join public.course_sections cs on cs.id = se.section_id
     where se.profile_id = p_profile_id and cs.course_id = p_course_id
  ) then
    delete from public.course_memberships
     where profile_id = p_profile_id and course_id = p_course_id;
  end if;

  -- Only orphan profiles go: someone enrolled in another course keeps theirs.
  if not exists (
    select 1 from public.course_memberships where profile_id = p_profile_id
  ) and not exists (
    select 1 from public.section_enrollments where profile_id = p_profile_id
  ) then
    delete from public.profiles where id = p_profile_id;
  end if;
end;
$$;

revoke all on function public.reset_section_activity(text, uuid) from anon, authenticated;
revoke all on function public.remove_section_student(text, uuid, uuid) from anon, authenticated;
