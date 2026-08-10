-- Real hard-delete actions for clearing accumulated test/QA data. Both
-- functions here run under `for update` locks and re-check state before
-- deleting, then let Postgres's own restrict-FK constraints do the real
-- safety checking: a foreign_key_violation (23503) means the target has
-- real recorded activity and the whole delete is refused, not partially
-- applied — the calling edge function translates that into a clear message.

create or replace function public.delete_class_session_atomic(
  p_session_id uuid,
  p_course_id text
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

  -- pulse_rounds.class_session_id is ON DELETE CASCADE (0013_live_pulses.sql),
  -- so it does NOT get the same restrict-FK protection that
  -- plan_checkpoint_id gets below — a session pushed through the legacy
  -- deck-checkpoint flow (plan_checkpoint_id null) has real pulse rounds and
  -- answers that would otherwise cascade away silently. Block explicitly.
  if exists (
    select 1 from public.pulse_rounds where class_session_id = p_session_id
  ) then
    raise exception 'class_session_has_pulse_activity';
  end if;

  -- class_question_plans has no ON DELETE clause against class_sessions
  -- (defaults to NO ACTION), so it must go first. This cascades to its own
  -- checkpoints and candidates. If any checkpoint here was ever actually
  -- sent live (pulse_rounds.plan_checkpoint_id is ON DELETE RESTRICT), this
  -- statement itself raises a real foreign_key_violation and the whole
  -- transaction rolls back — deliberately not caught here.
  delete from public.class_question_plans
    where class_session_id = p_session_id;

  -- Cascades: pulse_rounds, class_student_notes, class_presentation_state.
  -- Sets null: content_releases, activity_instances, participation_events,
  -- exit_tickets, and any class_sessions.continued_from_session_id pointing
  -- at this row — all per the existing schema, untouched by this function.
  delete from public.class_sessions
    where id = p_session_id;
end;
$$;

revoke all on function public.delete_class_session_atomic(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_class_session_atomic(uuid, text)
  to service_role;
