-- Guarded, one-shot production reset for the TC2007B teaching platform.
-- Preview mode is read-only. Execute mode is intended to be called by the
-- migration runner/service role inside a transaction after the final QA pass.
create or replace function public.clean_tc2007b_platform(p_execute boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_profile_id uuid;
  owner_auth_user_id uuid;
  owner_email text;
  owner_full_name text;
  group_401_id uuid;
  owner_count integer;
  auth_count integer;
  before_fingerprint jsonb;
  after_fingerprint jsonb;
  operational_counts jsonb;
  retained_tables text[] := array[
    'content_items', 'activity_templates', 'question_banks', 'questions',
    'question_options', 'content_uploads', 'generation_jobs',
    'quiz_courses', 'quiz_lectures', 'quiz_questions', 'quiz_options'
  ];
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Only the database owner or service role may execute the production reset.';
  end if;

  select count(*) into owner_count
  from public.course_memberships cm
  join public.courses c on c.id = cm.course_id
  join public.profiles p on p.id = cm.profile_id
  where c.id = 'tc2007b'
    and cm.role = 'platform_owner'
    and cm.status = 'active'
    and p.status = 'active';
  if owner_count <> 1 then
    raise exception 'Precondition failed: exactly one active TC2007B platform owner is required (found %).', owner_count;
  end if;

  select p.id, p.auth_user_id, p.institutional_email, p.full_name
    into owner_profile_id, owner_auth_user_id, owner_email, owner_full_name
  from public.course_memberships cm
  join public.courses c on c.id = cm.course_id
  join public.profiles p on p.id = cm.profile_id
  where c.id = 'tc2007b'
    and cm.role = 'platform_owner'
    and cm.status = 'active'
    and p.status = 'active';
  if owner_auth_user_id is null then
    raise exception 'Precondition failed: the retained platform owner must have an auth user.';
  end if;
  if not exists (select 1 from auth.users where id = owner_auth_user_id) then
    raise exception 'Precondition failed: the retained owner auth user is missing.';
  end if;

  if not exists (select 1 from public.courses where id = 'tc2007b') then
    raise exception 'Precondition failed: TC2007B course row is missing.';
  end if;
  if exists (select 1 from public.content_items where course_id <> 'tc2007b')
     or exists (select 1 from public.question_banks where course_id <> 'tc2007b')
     or exists (select 1 from public.content_uploads where course_id <> 'tc2007b')
     or exists (select 1 from public.generation_jobs where course_id <> 'tc2007b') then
    raise exception 'Precondition failed: retained assets reference another course.';
  end if;
  if exists (select 1 from public.quiz_lectures where course_id <> 'tc2007b') then
    raise exception 'Precondition failed: legacy question library references another course.';
  end if;

  before_fingerprint := jsonb_build_object(
    'content_items', jsonb_build_object('count', (select count(*) from public.content_items), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.content_items), ''))),
    'activity_templates', jsonb_build_object('count', (select count(*) from public.activity_templates), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.activity_templates), ''))),
    'question_banks', jsonb_build_object('count', (select count(*) from public.question_banks), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.question_banks), ''))),
    'questions', jsonb_build_object('count', (select count(*) from public.questions), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.questions), ''))),
    'question_options', jsonb_build_object('count', (select count(*) from public.question_options), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.question_options), ''))),
    'content_uploads', jsonb_build_object('count', (select count(*) from public.content_uploads), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.content_uploads), ''))),
    'generation_jobs', jsonb_build_object('count', (select count(*) from public.generation_jobs), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.generation_jobs), ''))),
    'quiz_courses', jsonb_build_object('count', (select count(*) from public.quiz_courses where id = 'tc2007b'), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_courses where id = 'tc2007b'), ''))),
    'quiz_lectures', jsonb_build_object('count', (select count(*) from public.quiz_lectures), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_lectures), ''))),
    'quiz_questions', jsonb_build_object('count', (select count(*) from public.quiz_questions), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_questions), ''))),
    'quiz_options', jsonb_build_object('count', (select count(*) from public.quiz_options), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_options), '')))
  );

  operational_counts := jsonb_build_object(
    'class_sessions', (select count(*) from public.class_sessions),
    'class_presentation_state', (select count(*) from public.class_presentation_state),
    'class_student_notes', (select count(*) from public.class_student_notes),
    'content_releases', (select count(*) from public.content_releases),
    'release_events', (select count(*) from public.release_events),
    'activity_instances', (select count(*) from public.activity_instances),
    'student_attempts', (select count(*) from public.student_attempts),
    'student_responses', (select count(*) from public.student_responses),
    'pulse_rounds', (select count(*) from public.pulse_rounds),
    'pulse_answers', (select count(*) from public.pulse_answers),
    'exit_tickets', (select count(*) from public.exit_tickets),
    'course_exit_tickets', (select count(*) from public.course_exit_tickets),
    'portfolio_entries', (select count(*) from public.portfolio_entries),
    'course_portfolio_submissions', (select count(*) from public.course_portfolio_submissions),
    'gradebook_categories', (select count(*) from public.gradebook_categories),
    'gradebook_items', (select count(*) from public.gradebook_items),
    'gradebook_scores', (select count(*) from public.gradebook_scores),
    'grade_adjustments', (select count(*) from public.grade_adjustments),
    'participation_events', (select count(*) from public.participation_events),
    'roster_imports', (select count(*) from public.roster_imports),
    'profile_identity_confirmations', (select count(*) from public.profile_identity_confirmations),
    'external_access_grants', (select count(*) from public.external_access_grants),
    'audit_log', (select count(*) from public.audit_log),
    'quiz_sessions', (select count(*) from public.quiz_sessions),
    'quiz_attempts', (select count(*) from public.quiz_attempts),
    'quiz_attempt_questions', (select count(*) from public.quiz_attempt_questions),
    'quiz_answers', (select count(*) from public.quiz_answers)
  );

  select count(*) into auth_count from auth.users;
  if p_execute is false then
    return jsonb_build_object(
      'mode', 'preview',
      'owner_profile_count', owner_count,
      'owner_auth_user_count', 1,
      'auth_user_count', auth_count,
      'retained_tables', to_jsonb(retained_tables),
      'retained_fingerprint', before_fingerprint,
      'operational_counts', operational_counts
    );
  end if;

  -- Delete dependent operational data before identities, sections, or courses.
  delete from public.quiz_answers;
  delete from public.quiz_attempt_questions;
  delete from public.quiz_attempts;
  delete from public.quiz_sessions;
  delete from public.grade_adjustments;
  delete from public.gradebook_scores;
  delete from public.gradebook_items;
  delete from public.gradebook_categories;
  delete from public.student_responses;
  delete from public.student_attempts;
  delete from public.activity_instances;
  delete from public.pulse_answers;
  delete from public.pulse_rounds;
  delete from public.class_student_notes;
  delete from public.exit_tickets;
  delete from public.portfolio_entries;
  delete from public.course_exit_tickets;
  delete from public.course_portfolio_submissions;
  delete from public.participation_events;
  delete from public.release_events;
  delete from public.content_releases;
  delete from public.profile_identity_confirmations;
  delete from public.external_access_grants;
  delete from public.roster_imports;
  delete from public.class_presentation_state;
  delete from public.class_sessions;
  delete from public.section_enrollments;
  delete from public.course_sections;
  delete from public.audit_log;

  delete from public.course_memberships;
  delete from public.profiles where id <> owner_profile_id;
  delete from auth.users where id <> owner_auth_user_id;

  delete from public.quiz_courses where id <> 'tc2007b';
  delete from public.courses where id <> 'tc2007b';
  update public.courses
     set code = 'TC2007B', title = 'Information Security',
         term_label = 'Current semester', status = 'active', updated_at = now()
   where id = 'tc2007b';
  update public.quiz_courses
     set title = 'TC2007B Question Library'
   where id = 'tc2007b';

  insert into public.course_memberships (course_id, profile_id, role, status)
  values ('tc2007b', owner_profile_id, 'platform_owner', 'active'),
         ('tc2007b', owner_profile_id, 'instructor', 'active');

  insert into public.course_sections (course_id, section_code, section_name, status)
  values ('tc2007b', '401', 'Group 401', 'active')
  returning id into group_401_id;
  insert into public.course_sections (course_id, section_code, section_name, status)
  values ('tc2007b', '402', 'Group 402', 'planned'),
         ('tc2007b', '501', 'Group 501', 'planned'),
         ('tc2007b', '502', 'Group 502', 'planned');
  insert into public.section_enrollments (section_id, profile_id, role, status)
  values (group_401_id, owner_profile_id, 'instructor', 'active');

  after_fingerprint := jsonb_build_object(
    'content_items', jsonb_build_object('count', (select count(*) from public.content_items), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.content_items), ''))),
    'activity_templates', jsonb_build_object('count', (select count(*) from public.activity_templates), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.activity_templates), ''))),
    'question_banks', jsonb_build_object('count', (select count(*) from public.question_banks), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.question_banks), ''))),
    'questions', jsonb_build_object('count', (select count(*) from public.questions), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.questions), ''))),
    'question_options', jsonb_build_object('count', (select count(*) from public.question_options), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.question_options), ''))),
    'content_uploads', jsonb_build_object('count', (select count(*) from public.content_uploads), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.content_uploads), ''))),
    'generation_jobs', jsonb_build_object('count', (select count(*) from public.generation_jobs), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.generation_jobs), ''))),
    'quiz_courses', jsonb_build_object('count', (select count(*) from public.quiz_courses where id = 'tc2007b'), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_courses where id = 'tc2007b'), ''))),
    'quiz_lectures', jsonb_build_object('count', (select count(*) from public.quiz_lectures), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_lectures), ''))),
    'quiz_questions', jsonb_build_object('count', (select count(*) from public.quiz_questions), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_questions), ''))),
    'quiz_options', jsonb_build_object('count', (select count(*) from public.quiz_options), 'ids_md5', md5(coalesce((select string_agg(id::text, ',' order by id::text) from public.quiz_options), '')))
  );
  if after_fingerprint <> before_fingerprint then
    raise exception 'Retained asset fingerprint changed during reset.';
  end if;
  if (select count(*) from public.courses) <> 1
     or (select count(*) from public.profiles) <> 1
     or (select count(*) from public.course_memberships) <> 2
     or (select count(*) from public.course_sections) <> 4
     or (select count(*) from public.section_enrollments) <> 1
     or exists (select 1 from public.course_sections where section_code not in ('401','402','501','502'))
     or exists (select 1 from public.class_sessions)
     or exists (select 1 from public.audit_log)
     or exists (select 1 from public.quiz_sessions)
     or exists (select 1 from public.quiz_attempts)
     or exists (select 1 from public.pulse_rounds)
     or exists (select 1 from public.pulse_answers)
     or exists (select 1 from public.student_attempts)
     or exists (select 1 from public.student_responses)
     or exists (select 1 from public.gradebook_scores)
     or exists (select 1 from public.class_student_notes)
  then
    raise exception 'Historical rows remain after reset.';
  end if;
  return jsonb_build_object(
    'mode', 'executed',
    'owner_email_fingerprint', md5(owner_email),
    'owner_name_fingerprint', md5(owner_full_name),
    'retained_fingerprint', after_fingerprint,
    'groups', jsonb_build_array('401', '402', '501', '502'),
    'historical_rows', 'zero'
  );
end;
$$;

revoke all on function public.clean_tc2007b_platform(boolean)
  from public, anon, authenticated;
grant execute on function public.clean_tc2007b_platform(boolean)
  to service_role;
