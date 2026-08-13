-- The lockout in 0051 never engaged. Fixed here.
--
-- 0051 incremented `pin_failed_attempts` and then raised `pin_invalid` from the
-- same function. A raised exception aborts the transaction, so Postgres rolled
-- the increment back with it: the counter was always zero, the lock never
-- armed, and six wrong PINs in a row left the account wide open. Verified
-- against the deployed function — five deliberate wrong attempts, then the
-- correct PIN, which still signed in.
--
-- That was not a cosmetic bug. Six digits is a million combinations, student IDs
-- are semi-public, and throttling is the only thing standing between the two.
-- Unthrottled, this scheme was weaker than the emailed codes it replaces.
--
-- The fix is structural rather than a patch: these functions no longer raise for
-- an expected outcome. They return a `result` code, the caller maps it, and the
-- writes commit. Exceptions are now reserved for genuine faults.
--
-- Rule worth keeping: never record a failed attempt and then raise in the same
-- transaction. The record is the point; the raise destroys it.

drop function if exists public.verify_student_pin(text, text, text);
drop function if exists public.claim_student_pin(text, text, text, text);

create or replace function public.verify_student_pin(
  p_course_id text,
  p_student_identifier text,
  p_pin text
)
returns table (result text, profile_id uuid, institutional_email text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_max_attempts constant integer := 5;
  v_lock_minutes constant integer := 15;
  v_enrolled boolean;
begin
  select * into v_profile
    from public.profiles
   where lower(student_identifier) = lower(trim(p_student_identifier))
   limit 1;

  -- Unknown student and wrong PIN are deliberately indistinguishable. Telling an
  -- attacker which student IDs exist hands them half the credential.
  if v_profile.id is null then
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  if v_profile.pin_locked_until is not null and v_profile.pin_locked_until > now() then
    return query select 'locked'::text, null::uuid, null::text;
    return;
  end if;

  if v_profile.pin_hash is null then
    return query select 'not_set'::text, null::uuid, null::text;
    return;
  end if;

  if v_profile.status not in ('active', 'invited') then
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  select exists (
    select 1
      from public.section_enrollments se
      join public.course_sections cs on cs.id = se.section_id
     where se.profile_id = v_profile.id
       and se.role = 'student'
       and se.status = 'active'
       and cs.course_id = p_course_id
  ) into v_enrolled;
  if not v_enrolled then
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  if crypt(p_pin, v_profile.pin_hash) <> v_profile.pin_hash then
    -- Commits, because nothing is raised after it.
    update public.profiles
       set pin_failed_attempts = pin_failed_attempts + 1,
           pin_locked_until = case
             when pin_failed_attempts + 1 >= v_max_attempts
               then now() + make_interval(mins => v_lock_minutes)
             else pin_locked_until
           end,
           updated_at = now()
     where id = v_profile.id;
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  update public.profiles
     set pin_failed_attempts = 0,
         pin_locked_until = null,
         status = case when status = 'invited' then 'active' else status end,
         updated_at = now()
   where id = v_profile.id;

  return query select 'ok'::text, v_profile.id, v_profile.institutional_email;
end;
$$;

create or replace function public.claim_student_pin(
  p_course_id text,
  p_student_identifier text,
  p_join_code text,
  p_pin text
)
returns table (result text, profile_id uuid, institutional_email text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_session public.class_sessions%rowtype;
  v_enrolled boolean;
begin
  if p_pin !~ '^[0-9]{6}$' then
    return query select 'pin_format'::text, null::uuid, null::text;
    return;
  end if;

  select * into v_session
    from public.class_sessions
   where upper(join_code) = upper(trim(p_join_code))
     and course_id = p_course_id
   limit 1;
  if v_session.id is null then
    return query select 'join_invalid'::text, null::uuid, null::text;
    return;
  end if;
  -- Live only. A closed or planned class is not a room anyone is standing in,
  -- so it cannot vouch for who is claiming.
  if v_session.state <> 'live' then
    return query select 'join_not_live'::text, null::uuid, null::text;
    return;
  end if;

  select * into v_profile
    from public.profiles
   where lower(student_identifier) = lower(trim(p_student_identifier))
   limit 1;
  if v_profile.id is null or v_profile.status not in ('active', 'invited') then
    return query select 'student_unknown'::text, null::uuid, null::text;
    return;
  end if;

  if v_profile.pin_hash is not null then
    return query select 'pin_already_set'::text, null::uuid, null::text;
    return;
  end if;

  select exists (
    select 1
      from public.section_enrollments se
     where se.profile_id = v_profile.id
       and se.section_id = v_session.section_id
       and se.role = 'student'
       and se.status = 'active'
  ) into v_enrolled;
  if not v_enrolled then
    return query select 'not_in_this_class'::text, null::uuid, null::text;
    return;
  end if;

  update public.profiles
     set pin_hash = crypt(p_pin, gen_salt('bf', 10)),
         pin_set_at = now(),
         pin_failed_attempts = 0,
         pin_locked_until = null,
         status = case when status = 'invited' then 'active' else status end,
         updated_at = now()
   where id = v_profile.id;

  return query select 'ok'::text, v_profile.id, v_profile.institutional_email;
end;
$$;

revoke all on function public.verify_student_pin(text, text, text) from public, anon, authenticated;
revoke all on function public.claim_student_pin(text, text, text, text) from public, anon, authenticated;
