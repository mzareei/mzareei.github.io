-- Reset a course back to "nothing has happened yet".
--
-- Written for the moment a professor finishes rehearsing with invented students
-- and wants the real semester to start from zero. It deletes what STUDENTS did
-- and leaves what the PROFESSOR built: lectures, question banks, the schedule,
-- sections, the roster, and the gradebook's category structure all survive.
--
-- Everything happens in one function so it is one transaction. A reset that
-- half-succeeds — pulse answers gone, quiz attempts still there — would leave
-- grades that look real and are not, which is worse than either extreme.
--
-- Removing the invented student accounts themselves is deliberately NOT done
-- here. Nothing in the schema reliably distinguishes a test profile from a real
-- one, so that choice belongs to a human picking names off a list; the edge
-- function does it one profile at a time and reports whichever it could not.

create or replace function public.reset_course_activity(p_course_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  counts jsonb := '{}'::jsonb;
  n bigint;
  section_ids uuid[];
  session_ids uuid[];
begin
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'course_not_found';
  end if;

  select coalesce(array_agg(id), '{}') into section_ids
    from public.course_sections where course_id = p_course_id;
  select coalesce(array_agg(id), '{}') into session_ids
    from public.class_sessions where course_id = p_course_id;

  -- ---------------------------------------------------------- live class data
  delete from public.pulse_answers
    where round_id in (select id from public.pulse_rounds where course_id = p_course_id);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('pulse_answers', n);

  -- Frees the ON DELETE RESTRICT that a sent checkpoint holds over the
  -- professor's question plan, which is why the plans themselves can survive.
  delete from public.pulse_rounds where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('pulse_rounds', n);

  delete from public.class_attendance where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_attendance', n);

  -- ----------------------------------------------------------- quiz attempts
  delete from public.student_responses
    where student_attempt_id in (
      select sa.id from public.student_attempts sa
       where sa.section_id = any(section_ids)
    );
  get diagnostics n = row_count; counts := counts || jsonb_build_object('student_responses', n);

  delete from public.student_attempts where section_id = any(section_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('student_attempts', n);

  -- Instances are per-run, not content: starting a quiz makes a new one.
  delete from public.activity_instances where section_id = any(section_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('activity_instances', n);

  -- ------------------------------------------------------ written submissions
  delete from public.exit_tickets where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('exit_tickets', n);

  delete from public.portfolio_entries where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('portfolio_entries', n);

  -- ------------------------------------------------------------------ grading
  delete from public.class_grade_overrides where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_grade_overrides', n);

  -- Cascades to gradebook_scores and their grade_adjustments. Items are
  -- recreated automatically the next time grades are posted; the CATEGORIES
  -- they hang off are kept, because their weights may have been set by hand.
  delete from public.gradebook_items where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('gradebook_items', n);

  delete from public.participation_events where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('participation_events', n);

  -- --------------------------------------------------------- per-class notes
  delete from public.class_student_notes where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_student_notes', n);

  delete from public.class_presentation_state where class_session_id = any(session_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_presentation_state', n);

  -- ------------------------------------------------- the sessions themselves
  -- Kept, but rewound. A rehearsed class left 'closed' with a spent join code
  -- would otherwise still look like it had happened.
  update public.class_sessions
     set state = 'planned',
         actual_start_at = null,
         actual_end_at = null,
         join_code = null,
         updated_at = now()
   where course_id = p_course_id
     and (state <> 'planned' or actual_start_at is not null or join_code is not null);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('class_sessions_rewound', n);

  -- ------------------------------------------------------- frozen Gen-1 pilot
  -- Student submissions from the pre-v2 apps. Their question content
  -- (quiz_lectures, quiz_questions, quiz_options) is left alone.
  delete from public.quiz_attempts
    where session_id in (
      select qs.id from public.quiz_sessions qs
       join public.quiz_lectures ql on ql.id = qs.lecture_id
      where ql.course_id = p_course_id
    );
  get diagnostics n = row_count; counts := counts || jsonb_build_object('quiz_attempts', n);

  delete from public.quiz_sessions
    where lecture_id in (select id from public.quiz_lectures where course_id = p_course_id);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('quiz_sessions', n);

  delete from public.course_exit_tickets where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('course_exit_tickets', n);

  delete from public.course_portfolio_submissions where course_id = p_course_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('course_portfolio_submissions', n);

  return counts;
end;
$$;

-- Removes one student and everything that belongs to them, or refuses. Kept
-- separate from the reset so that one undeletable profile cannot roll back the
-- whole wipe — the caller loops and reports which names it could not remove.
create or replace function public.remove_course_student(
  p_course_id text,
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
  -- A teacher is never removable through this path, whatever the caller sends.
  -- The professor deleting their own account mid-semester is not a recoverable
  -- mistake, and no UI should be able to cause it.
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
    where profile_id = p_profile_id
      and section_id in (select id from public.course_sections where course_id = p_course_id);

  delete from public.course_memberships
    where profile_id = p_profile_id and course_id = p_course_id;

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

revoke all on function public.reset_course_activity(text) from anon, authenticated;
revoke all on function public.remove_course_student(text, uuid) from anon, authenticated;
