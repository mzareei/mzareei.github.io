-- Creates the first teacher account for the course.
--
-- The foundation seed creates the course, sections, and content, but no people. Until this
-- runs, signing in with an institutional address succeeds and then lands on the
-- "enrollment required" screen, because the account has no profile and no membership.
--
-- Edit the three values below, then run the whole file in the Supabase SQL editor.
-- Safe to run more than once.

do $$
declare
  owner_email   text := 'm.zareei@tec.mx';
  owner_name    text := 'Mahdi Zareei';
  target_course text := 'tc2007b';
  owner_profile uuid;
begin
  insert into public.profiles (institutional_email, full_name, status)
  values (lower(trim(owner_email)), owner_name, 'invited')
  on conflict (institutional_email) do update
    set full_name = excluded.full_name,
        updated_at = now()
  returning id into owner_profile;

  -- platform_owner carries the administrative rights; instructor is what the teacher
  -- dashboards and the roster panel check for.
  insert into public.course_memberships (course_id, profile_id, role, status)
  values
    (target_course, owner_profile, 'platform_owner', 'active'),
    (target_course, owner_profile, 'instructor', 'active')
  on conflict (course_id, profile_id, role) do update
    set status = 'active',
        updated_at = now();

  -- Assign to every section of the course, so section-scoped teacher views have context.
  insert into public.section_enrollments (section_id, profile_id, role, status)
  select section.id, owner_profile, 'instructor', 'active'
  from public.course_sections section
  where section.course_id = target_course
  on conflict (section_id, profile_id, role) do update
    set status = 'active',
        updated_at = now();

  raise notice 'Course owner ready: % (profile %)', owner_email, owner_profile;
end $$;

-- Confirm the result:
--
--   select p.institutional_email, m.role, m.status
--   from public.profiles p
--   join public.course_memberships m on m.profile_id = p.id
--   where p.institutional_email = 'm.zareei@tec.mx';
