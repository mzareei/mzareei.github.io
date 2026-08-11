-- A class session can be started with no lecture attached — Run Class shows
-- "No lecture selected for this class. The class can still start, but
-- checkpoints and the final quiz need a lecture selected" and
-- start_class_session_atomic has no content requirement. But
-- close_class_session_with_review (0027) unconditionally required
-- content_item_id, so a session started that way could never be closed.
--
-- That left it permanently stuck: live can't transition to cancelled
-- (allowedSessionTransitions only allows live -> paused|closed), and
-- delete_class_session_atomic refuses any state other than
-- planned/cancelled/closed even with p_force (0038) — force only bypasses
-- the pulse-activity check, deliberately never the "this is happening right
-- now" state guard. Three real sessions (Malware, mal code, mal v2, all
-- content_item_id null) hit exactly this dead end on 2026-08-11.
--
-- Fix: when there is no lecture attached, there is nothing to release for
-- review, so skip the content_releases/release_events write instead of
-- refusing to close. The session still transitions to closed with a plain
-- audit record. Behavior for sessions that do have a lecture is unchanged.

create or replace function public.close_class_session_with_review(
  p_session_id uuid,
  p_course_id text,
  p_actor_profile_id uuid,
  p_reason text
)
returns public.class_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_session public.class_sessions%rowtype;
  previous_session_state text;
  previous_release_state text;
  review_release_id uuid;
  event_type text;
  normalized_reason text;
begin
  select *
    into locked_session
    from public.class_sessions
    where id = p_session_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'Class session not found.';
  end if;

  -- The close, review release, release event, and audit record were committed
  -- together. A retry only needs the existing session so the edge function can
  -- finish closing pulse/activity rows after an earlier cleanup failure.
  if locked_session.state = 'closed' then
    return locked_session;
  end if;

  if locked_session.state not in ('live', 'paused') then
    raise exception 'Transition from % to closed is not allowed.', locked_session.state;
  end if;

  previous_session_state := locked_session.state;
  normalized_reason := left(nullif(btrim(coalesce(p_reason, '')), ''), 1000);

  if locked_session.content_item_id is null then
    update public.class_sessions
      set state = 'closed',
          actual_end_at = now(),
          updated_at = now()
      where id = locked_session.id
      returning * into locked_session;

    insert into public.audit_log (
      course_id,
      actor_profile_id,
      target_type,
      target_id,
      action,
      metadata
    )
    values (
      locked_session.course_id,
      p_actor_profile_id,
      'class_session',
      locked_session.id,
      'session_closed_without_content',
      jsonb_build_object(
        'old_state', previous_session_state,
        'new_state', 'closed',
        'reason', normalized_reason
      )
    );

    return locked_session;
  end if;

  select state
    into previous_release_state
    from public.content_releases
    where content_item_id = locked_session.content_item_id
      and section_id = locked_session.section_id
      and class_session_id = locked_session.id
    for update;

  update public.class_sessions
    set state = 'closed',
        actual_end_at = now(),
        updated_at = now()
    where id = locked_session.id
    returning * into locked_session;

  insert into public.content_releases (
    content_item_id,
    course_id,
    section_id,
    class_session_id,
    state,
    opens_at,
    closes_at,
    review_opens_at,
    review_closes_at,
    created_by,
    updated_by,
    updated_at
  )
  values (
    locked_session.content_item_id,
    locked_session.course_id,
    locked_session.section_id,
    locked_session.id,
    'review_only',
    now(),
    null,
    now(),
    null,
    p_actor_profile_id,
    p_actor_profile_id,
    now()
  )
  on conflict (content_item_id, section_id, class_session_id)
  do update set
    state = 'review_only',
    opens_at = excluded.opens_at,
    closes_at = null,
    review_opens_at = excluded.review_opens_at,
    review_closes_at = null,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning id into review_release_id;

  event_type := case
    when previous_release_state is null then 'created'
    else 'reopened'
  end;

  insert into public.release_events (
    content_release_id,
    actor_profile_id,
    event_type,
    old_state,
    new_state,
    reason
  )
  values (
    review_release_id,
    p_actor_profile_id,
    event_type,
    previous_release_state,
    'review_only',
    normalized_reason
  );

  insert into public.audit_log (
    course_id,
    actor_profile_id,
    target_type,
    target_id,
    action,
    metadata
  )
  values (
    locked_session.course_id,
    p_actor_profile_id,
    'class_session',
    locked_session.id,
    'session_closed_with_review',
    jsonb_build_object(
      'old_state', previous_session_state,
      'new_state', 'closed',
      'reason', normalized_reason,
      'review_release_id', review_release_id,
      'review_release_old_state', previous_release_state,
      'section_id', locked_session.section_id
    )
  );

  return locked_session;
end;
$$;

revoke all on function public.close_class_session_with_review(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.close_class_session_with_review(uuid, text, uuid, text)
  to service_role;
