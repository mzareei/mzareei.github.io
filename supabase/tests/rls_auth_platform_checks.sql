-- TC2007B authenticated platform RLS safety checks.
-- Run after all migrations and before grade-bearing classroom use.
-- Expected hardening pattern in migrations:
-- revoke all on public.profiles from anon, authenticated;

do $$
declare
  sensitive_tables text[] := array[
    'profiles',
    'profile_identity_confirmations',
    'courses',
    'course_memberships',
    'course_sections',
    'section_enrollments',
    'roster_imports',
    'class_sessions',
    'content_items',
    'content_releases',
    'release_events',
    'activity_templates',
    'activity_instances',
    'question_banks',
    'questions',
    'question_options',
    'student_attempts',
    'student_responses',
    'exit_tickets',
    'gradebook_categories',
    'gradebook_items',
    'gradebook_scores',
    'grade_adjustments',
    'participation_events',
    'audit_log',
    'portfolio_entries'
  ];
  checked_table text;
  checked_role text;
  checked_privilege text;
  rls_enabled boolean;
begin
  foreach checked_table in array sensitive_tables loop
    select c.relrowsecurity
      into rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = checked_table
       and c.relkind = 'r';

    if rls_enabled is null then
      raise exception 'Missing required table public.%', checked_table;
    end if;

    if rls_enabled is not true then
      raise exception 'Row Level Security is not enabled on public.%', checked_table;
    end if;

    foreach checked_role in array array['anon', 'authenticated'] loop
      foreach checked_privilege in array array['select', 'insert', 'update', 'delete'] loop
        if has_table_privilege(checked_role, format('public.%I', checked_table), checked_privilege) then
          raise exception 'Role % still has % privilege on public.%', checked_role, checked_privilege, checked_table;
        end if;
      end loop;
    end loop;
  end loop;

  raise notice 'TC2007B authenticated platform RLS checks passed for % tables.', array_length(sensitive_tables, 1);
end $$;
