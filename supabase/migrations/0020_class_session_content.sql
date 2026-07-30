alter table class_sessions
  add column if not exists content_item_id uuid
  references content_items(id) on delete set null;

create index if not exists class_sessions_content_item_idx
  on class_sessions(content_item_id);

create or replace function public.start_class_session_atomic(
  p_session_id uuid,
  p_course_id text,
  p_actor_profile_id uuid
)
returns public.class_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_state text;
  started_session public.class_sessions%rowtype;
begin
  select state
    into previous_state
    from public.class_sessions
    where id = p_session_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'Class session not found.';
  end if;

  if previous_state not in ('planned', 'open', 'continued') then
    raise exception 'Transition from % to live is not allowed.', previous_state;
  end if;

  update public.class_sessions
    set state = 'live',
        actual_start_at = now(),
        join_code = coalesce(
          join_code,
          upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
        ),
        updated_at = now()
    where id = p_session_id
      and course_id = p_course_id
    returning * into started_session;

  insert into public.audit_log (
    course_id,
    actor_profile_id,
    target_type,
    target_id,
    action,
    metadata
  )
  values (
    p_course_id,
    p_actor_profile_id,
    'class_session',
    p_session_id,
    'session_state_changed',
    jsonb_build_object(
      'old_state', previous_state,
      'new_state', 'live',
      'reason', null
    )
  );

  return started_session;
end;
$$;

revoke all on function public.start_class_session_atomic(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.start_class_session_atomic(uuid, text, uuid)
  to service_role;
