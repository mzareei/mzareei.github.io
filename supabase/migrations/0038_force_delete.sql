-- Force-delete support: bypass ONLY the historical-activity refusals added
-- in 0037 (recorded pulse activity for a session; recorded student answers
-- or live-sent checkpoints for a bank), gated behind an explicit p_force
-- flag the edge functions only set after the instructor types "DELETE" to
-- confirm on the frontend. Never bypasses a "this is happening right now"
-- guard (session/bank state, live-class usage) — those keep refusing
-- regardless of p_force.
--
-- Both functions below change their parameter list, which Postgres treats
-- as a new overload rather than a replacement — the old 2-arg signature is
-- dropped explicitly so it doesn't linger as dead, callable code.

drop function if exists public.delete_class_session_atomic(uuid, text);

create or replace function public.delete_class_session_atomic(
  p_session_id uuid,
  p_course_id text,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_state text;
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

  if locked_state not in ('planned', 'cancelled', 'closed') then
    raise exception 'class_session_delete_state_invalid';
  end if;

  if not p_force then
    if exists (
      select 1 from public.pulse_rounds where class_session_id = p_session_id
    ) then
      raise exception 'class_session_has_pulse_activity';
    end if;
  else
    -- Force mode: explicitly clear pulse_rounds first. Deleting
    -- class_question_plans below cascades to its checkpoints, and
    -- pulse_rounds.plan_checkpoint_id is ON DELETE RESTRICT — if this
    -- session's own pulse rounds weren't already gone, that restrict would
    -- still fire even though those very rows are about to be removed a step
    -- later by the session's own cascade. This permanently destroys the
    -- session's recorded live-question activity.
    delete from public.pulse_rounds where class_session_id = p_session_id;
  end if;

  delete from public.class_question_plans
    where class_session_id = p_session_id;

  delete from public.class_sessions
    where id = p_session_id;
end;
$$;

revoke all on function public.delete_class_session_atomic(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.delete_class_session_atomic(uuid, text, boolean)
  to service_role;

drop function if exists public.delete_question_bank_atomic(uuid, text);

create or replace function public.delete_question_bank_atomic(
  p_bank_id uuid,
  p_course_id text,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
    from public.question_banks
    where id = p_bank_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'question_bank_not_found';
  end if;

  -- Liveness guard stays absolute — force never bypasses "this bank is in
  -- use by a class happening right now".
  if exists (
    select 1
    from public.class_question_plans plan
    join public.class_sessions session on session.id = plan.class_session_id
    where plan.question_bank_id = p_bank_id
      and session.state in ('open', 'live', 'paused', 'continued')
  ) then
    raise exception 'question_bank_in_use_by_live_class';
  end if;

  if p_force then
    -- Force mode: explicitly clear the two sets of rows genuinely protected
    -- by a real ON DELETE RESTRICT — student_responses against this bank's
    -- questions, and any pulse_rounds pointing at a checkpoint belonging to
    -- a plan built from this bank. Both are permanently, irreversibly
    -- destroyed by this branch.
    delete from public.pulse_rounds
      where plan_checkpoint_id in (
        select checkpoint.id
        from public.class_question_plan_checkpoints checkpoint
        join public.class_question_plans plan on plan.id = checkpoint.plan_id
        where plan.question_bank_id = p_bank_id
      );
    delete from public.student_responses
      where question_id in (
        select id from public.questions where question_bank_id = p_bank_id
      );
  end if;

  delete from public.class_question_plans
    where question_bank_id = p_bank_id;

  delete from public.question_banks
    where id = p_bank_id;
end;
$$;

revoke all on function public.delete_question_bank_atomic(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.delete_question_bank_atomic(uuid, text, boolean)
  to service_role;
