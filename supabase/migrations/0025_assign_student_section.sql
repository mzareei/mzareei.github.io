-- Move an existing student between course groups without deleting enrollment
-- history. The lock, validation, membership repair, enrollment changes, and
-- audit entry share one transaction through this RPC.

create or replace function public.assign_student_section_atomic(
  p_course_id text,
  p_actor_profile_id uuid,
  p_profile_id uuid,
  p_section_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_profile public.profiles%rowtype;
  target_section public.course_sections%rowtype;
  before_section_ids uuid[];
  changed_at timestamptz := now();
begin
  if p_actor_profile_id = p_profile_id then
    raise exception 'You cannot change your own group.';
  end if;

  select *
    into locked_profile
    from public.profiles
    where id = p_profile_id
      and status = 'active'
    for update;

  if not found then
    raise exception 'Only an active student profile can be assigned to a group.';
  end if;

  select *
    into target_section
    from public.course_sections
    where id = p_section_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'That group is not part of this course.';
  end if;

  perform id
    from public.course_memberships
    where course_id = p_course_id
      and profile_id = p_profile_id
    for update;

  if not exists (
    select 1
      from public.course_memberships
      where course_id = p_course_id
        and profile_id = p_profile_id
        and role = 'student'
  ) then
    raise exception 'Only students can be assigned to a group.';
  end if;

  if exists (
    select 1
      from public.course_memberships
      where course_id = p_course_id
        and profile_id = p_profile_id
        and status = 'active'
        and role <> 'student'
  ) then
    raise exception 'Instructor, assistant, and observer profiles cannot be moved as students.';
  end if;

  perform enrollment.id
    from public.section_enrollments as enrollment
    join public.course_sections as section
      on section.id = enrollment.section_id
     and section.course_id = p_course_id
    where enrollment.profile_id = p_profile_id
      and enrollment.role = 'student'
    for update of enrollment;

  select coalesce(array_agg(enrollment.section_id order by enrollment.section_id), '{}'::uuid[])
    into before_section_ids
    from public.section_enrollments as enrollment
    join public.course_sections as section
      on section.id = enrollment.section_id
     and section.course_id = p_course_id
    where enrollment.profile_id = p_profile_id
      and enrollment.role = 'student'
      and enrollment.status = 'active';

  update public.section_enrollments
    set status = 'dropped',
        dropped_at = changed_at,
        updated_at = changed_at
    where profile_id = p_profile_id
      and role = 'student'
      and status = 'active'
      and section_id <> p_section_id
      and section_id in (
        select id
          from public.course_sections
          where course_id = p_course_id
      );

  insert into public.section_enrollments (
    section_id,
    profile_id,
    role,
    status,
    dropped_at,
    updated_at
  )
  values (
    p_section_id,
    p_profile_id,
    'student',
    'active',
    null,
    changed_at
  )
  on conflict (section_id, profile_id, role)
  do update
    set status = 'active',
        dropped_at = null,
        updated_at = excluded.updated_at;

  update public.course_memberships
    set status = 'active',
        updated_at = changed_at
    where course_id = p_course_id
      and profile_id = p_profile_id
      and role = 'student';

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
    'profile',
    p_profile_id,
    'student_section_assigned',
    jsonb_build_object(
      'before_section_ids', before_section_ids,
      'target_section_id', target_section.id
    )
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'before_section_ids', before_section_ids,
    'target_section_id', target_section.id,
    'target_section_code', target_section.section_code
  );
end;
$$;

revoke all on function public.assign_student_section_atomic(text, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_student_section_atomic(text, uuid, uuid, uuid)
  to service_role;
