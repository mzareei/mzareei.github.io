-- Compose class-management features safely across normal lifecycle changes.
-- This migration is additive because 0024-0026 have already been deployed.

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

  if locked_session.content_item_id is null then
    raise exception 'A class session needs lecture content before it can be released for review.';
  end if;

  previous_session_state := locked_session.state;
  normalized_reason := left(nullif(btrim(coalesce(p_reason, '')), ''), 1000);

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

create or replace function public.update_class_session_atomic(
  p_session_id uuid,
  p_course_id text,
  p_actor_profile_id uuid,
  p_section_id uuid,
  p_title text,
  p_planned_date date,
  p_content_item_id uuid
)
returns public.class_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_session public.class_sessions%rowtype;
  before_session public.class_sessions%rowtype;
  target_section public.course_sections%rowtype;
  target_sequence_number integer;
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

  if locked_session.state not in ('planned', 'open', 'continued')
     or locked_session.actual_start_at is not null then
    raise exception 'Only planned, open, or continued sessions that have not started can be edited.';
  end if;

  -- Serialise moves into the same group before choosing its next sequence.
  select *
    into target_section
    from public.course_sections
    where id = p_section_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'That section is not part of this course.';
  end if;

  if p_content_item_id is not null
     and not exists (
       select 1
         from public.content_items
         where id = p_content_item_id
           and course_id = p_course_id
           and content_type = 'lecture'
     ) then
    raise exception 'Choose a lecture from this course.';
  end if;

  before_session := locked_session;
  target_sequence_number := locked_session.sequence_number;

  if p_section_id <> locked_session.section_id
     and exists (
       select 1
         from public.class_sessions
         where section_id = p_section_id
           and sequence_number = locked_session.sequence_number
     ) then
    select coalesce(max(sequence_number), 0) + 1
      into target_sequence_number
      from public.class_sessions
      where section_id = p_section_id;
  end if;

  loop
    begin
      update public.class_sessions
        set section_id = p_section_id,
            sequence_number = target_sequence_number,
            title = p_title,
            planned_date = p_planned_date,
            content_item_id = p_content_item_id,
            updated_at = now()
        where id = locked_session.id
        returning * into locked_session;
      exit;
    exception
      when unique_violation then
        -- A concurrent class insert can race the earlier MAX even while class
        -- moves are serialised by the target-section lock. Re-read and retry
        -- inside this transaction instead of leaking 23505 to the professor.
        select coalesce(max(sequence_number), 0) + 1
          into target_sequence_number
          from public.class_sessions
          where section_id = p_section_id;
    end;
  end loop;

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
    'class_session_updated',
    jsonb_build_object(
      'before', jsonb_build_object(
        'section_id', before_session.section_id,
        'sequence_number', before_session.sequence_number,
        'title', before_session.title,
        'planned_date', before_session.planned_date,
        'content_item_id', before_session.content_item_id
      ),
      'after', jsonb_build_object(
        'section_id', locked_session.section_id,
        'sequence_number', locked_session.sequence_number,
        'title', locked_session.title,
        'planned_date', locked_session.planned_date,
        'content_item_id', locked_session.content_item_id
      )
    )
  );

  return locked_session;
end;
$$;

revoke all on function public.update_class_session_atomic(uuid, text, uuid, uuid, text, date, uuid)
  from public, anon, authenticated;
grant execute on function public.update_class_session_atomic(uuid, text, uuid, uuid, text, date, uuid)
  to service_role;

create or replace function public.create_class_student_note_atomic(
  p_class_session_id uuid,
  p_course_id text,
  p_profile_id uuid,
  p_author_profile_id uuid,
  p_note_text text,
  p_needs_follow_up boolean
)
returns public.class_student_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_session public.class_sessions%rowtype;
  created_note public.class_student_notes%rowtype;
begin
  select *
    into locked_session
    from public.class_sessions
    where id = p_class_session_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'Class session not found.';
  end if;

  -- A normal group move preserves the old enrollment as dropped. That row is
  -- the historical proof that this student belonged to this class group.
  if not exists (
    select 1
      from public.profiles profile
      join public.section_enrollments enrollment
        on enrollment.profile_id = profile.id
      join public.course_memberships membership
        on membership.profile_id = profile.id
       and membership.course_id = locked_session.course_id
      where profile.id = p_profile_id
        and profile.status = 'active'
        and membership.role = 'student'
        and membership.status = 'active'
        and enrollment.section_id = locked_session.section_id
        and enrollment.role = 'student'
        and enrollment.status in ('active', 'dropped')
  ) then
    raise exception 'That student has no enrollment history for this class group.';
  end if;

  insert into public.class_student_notes (
    course_id,
    class_session_id,
    profile_id,
    author_profile_id,
    note_text,
    needs_follow_up
  )
  values (
    locked_session.course_id,
    locked_session.id,
    p_profile_id,
    p_author_profile_id,
    p_note_text,
    p_needs_follow_up
  )
  returning * into created_note;

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
    p_author_profile_id,
    'class_student_note',
    created_note.id,
    'class_student_note_created',
    jsonb_build_object(
      'class_session_id', locked_session.id,
      'profile_id', p_profile_id,
      'needs_follow_up', created_note.needs_follow_up
    )
  );

  return created_note;
end;
$$;

revoke all on function public.create_class_student_note_atomic(uuid, text, uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.create_class_student_note_atomic(uuid, text, uuid, uuid, text, boolean)
  to service_role;

create or replace function public.resolve_class_student_note_atomic(
  p_note_id uuid,
  p_course_id text,
  p_actor_profile_id uuid
)
returns public.class_student_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_note public.class_student_notes%rowtype;
  locked_session public.class_sessions%rowtype;
begin
  select *
    into locked_note
    from public.class_student_notes
    where id = p_note_id
    for update;

  if not found then
    raise exception 'Class student note not found.';
  end if;

  select *
    into locked_session
    from public.class_sessions
    where id = locked_note.class_session_id
      and course_id = locked_note.course_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'Class student note is not linked to its session course.';
  end if;

  if locked_note.resolved_at is not null then
    return locked_note;
  end if;

  if not exists (
    select 1
      from public.section_enrollments enrollment
      where enrollment.profile_id = locked_note.profile_id
        and enrollment.section_id = locked_session.section_id
        and enrollment.role = 'student'
        and enrollment.status in ('active', 'dropped')
  ) then
    raise exception 'That student has no enrollment history for this class group.';
  end if;

  update public.class_student_notes
    set resolved_at = now(),
        resolved_by = p_actor_profile_id
    where id = locked_note.id
    returning * into locked_note;

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
    'class_student_note',
    locked_note.id,
    'class_student_note_resolved',
    jsonb_build_object(
      'class_session_id', locked_session.id,
      'profile_id', locked_note.profile_id,
      'resolved_at', locked_note.resolved_at
    )
  );

  return locked_note;
end;
$$;

revoke all on function public.resolve_class_student_note_atomic(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_class_student_note_atomic(uuid, text, uuid)
  to service_role;
