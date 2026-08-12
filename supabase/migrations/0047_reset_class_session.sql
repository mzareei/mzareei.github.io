-- Rehearsing a class consumes it. Polls get marked sent, students get marked
-- present, a quiz gets attempted, a grade gets posted — and the second run of
-- the same lecture starts from a used-up session. Deleting the session is not
-- the answer: it takes the schedule entry, the lecture link, and the question
-- plan with it, all of which the professor wants to keep.
--
-- This clears the *activity* of one class session and leaves the class itself
-- standing: same date, same section, same lecture, same six planned polls, all
-- back to unasked.
--
-- Deliberately narrower than public.delete_class_session_atomic (0037), which
-- removes the session outright and refuses when pulse activity exists. Here
-- pulse activity is exactly what we are here to remove.

create or replace function public.reset_class_session_atomic(
  p_session_id uuid,
  p_course_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_state text;
  removed jsonb;
  n_rounds int := 0;
  n_answers int := 0;
  n_attendance int := 0;
  n_attempts int := 0;
  n_instances int := 0;
  n_tickets int := 0;
  n_events int := 0;
  n_scores int := 0;
  n_overrides int := 0;
  n_checkpoints int := 0;
begin
  select state
    into locked_state
    from public.class_sessions
    where id = p_session_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'class_session_not_found';
  end if;

  -- A live class must not have the floor pulled out from under it. End it
  -- first; reopening afterwards is one click.
  if locked_state = 'live' then
    raise exception 'class_session_reset_state_invalid';
  end if;

  -- Answers cascade from their rounds, but count them before they vanish so the
  -- professor is told what this actually destroyed.
  select count(*)
    into n_answers
    from public.pulse_answers a
    join public.pulse_rounds r on r.id = a.round_id
    where r.class_session_id = p_session_id;

  -- Rounds must go before the plan checkpoints they point at:
  -- pulse_rounds.plan_checkpoint_id is ON DELETE RESTRICT, so a checkpoint
  -- cannot be touched while a round still references it.
  with deleted as (
    delete from public.pulse_rounds
      where class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_rounds from deleted;

  -- The plan itself survives. Only the record of having asked is undone, so the
  -- same polls are armed again for the next run.
  with reset_checkpoints as (
    update public.class_question_plan_checkpoints c
      set state = 'planned',
          updated_at = now()
      from public.class_question_plans p
      where c.plan_id = p.id
        and p.class_session_id = p_session_id
        and c.state <> 'planned'
      returning 1
  )
  select count(*) into n_checkpoints from reset_checkpoints;

  -- Quiz attempts cascade from their instance; count first, as with answers.
  select count(*)
    into n_attempts
    from public.student_attempts s
    join public.activity_instances i on i.id = s.activity_instance_id
    where i.class_session_id = p_session_id;

  with deleted as (
    delete from public.activity_instances
      where class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_instances from deleted;

  with deleted as (
    delete from public.exit_tickets
      where class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_tickets from deleted;

  with deleted as (
    delete from public.participation_events
      where class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_events from deleted;

  -- The class grade for this session, and any hand override of it.
  with deleted as (
    delete from public.gradebook_scores s
      using public.gradebook_items i
      where s.gradebook_item_id = i.id
        and i.class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_scores from deleted;

  with deleted as (
    delete from public.class_grade_overrides
      where class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_overrides from deleted;

  -- Last, because everything above is keyed to students who were in the room.
  with deleted as (
    delete from public.class_attendance
      where class_session_id = p_session_id
      returning 1
  )
  select count(*) into n_attendance from deleted;

  -- Back to a class that has not happened yet. `planned` is the only state the
  -- normal start flow accepts from scratch.
  update public.class_sessions
    set state = 'planned',
        actual_start_at = null,
        actual_end_at = null,
        updated_at = now()
    where id = p_session_id;

  removed := jsonb_build_object(
    'pulse_rounds', n_rounds,
    'pulse_answers', n_answers,
    'plan_checkpoints_reset', n_checkpoints,
    'quiz_instances', n_instances,
    'quiz_attempts', n_attempts,
    'reflections', n_tickets,
    'participation_events', n_events,
    'class_scores', n_scores,
    'grade_overrides', n_overrides,
    'attendance', n_attendance
  );

  return removed;
end;
$$;

revoke all on function public.reset_class_session_atomic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reset_class_session_atomic(uuid, text)
  to service_role;
