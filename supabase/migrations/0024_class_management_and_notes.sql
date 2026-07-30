alter table public.class_sessions
  add constraint class_sessions_course_id_id_key
  unique (course_id, id);

create table public.class_student_notes (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  class_session_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  note_text text not null check (length(note_text) between 1 and 4000),
  needs_follow_up boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((resolved_at is null) = (resolved_by is null)),
  foreign key (course_id, class_session_id)
    references public.class_sessions(course_id, id)
    on delete cascade
);

create index class_student_notes_session_profile_created_idx
  on public.class_student_notes(class_session_id, profile_id, created_at desc);

alter table public.class_student_notes enable row level security;
revoke all on public.class_student_notes from anon, authenticated;

alter table public.content_releases
  add constraint content_releases_content_section_session_key
  unique (content_item_id, section_id, class_session_id);

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

  if not exists (
    select 1
      from public.course_sections
      where id = p_section_id
        and course_id = p_course_id
  ) then
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

  update public.class_sessions
    set section_id = p_section_id,
        title = p_title,
        planned_date = p_planned_date,
        content_item_id = p_content_item_id,
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
    'class_session_updated',
    jsonb_build_object(
      'before', jsonb_build_object(
        'section_id', before_session.section_id,
        'title', before_session.title,
        'planned_date', before_session.planned_date,
        'content_item_id', before_session.content_item_id
      ),
      'after', jsonb_build_object(
        'section_id', locked_session.section_id,
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

  if not exists (
    select 1
      from public.profiles profile
      join public.section_enrollments enrollment
        on enrollment.profile_id = profile.id
      where profile.id = p_profile_id
        and profile.status = 'active'
        and enrollment.section_id = locked_session.section_id
        and enrollment.role = 'student'
        and enrollment.status = 'active'
  ) then
    raise exception 'That student is not active in this class group.';
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
    raise exception 'This class student note is already resolved.';
  end if;

  if not exists (
    select 1
      from public.profiles profile
      join public.section_enrollments enrollment
        on enrollment.profile_id = profile.id
      where profile.id = locked_note.profile_id
        and profile.status = 'active'
        and enrollment.section_id = locked_session.section_id
        and enrollment.role = 'student'
        and enrollment.status = 'active'
  ) then
    raise exception 'That student is not active in this class group.';
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
