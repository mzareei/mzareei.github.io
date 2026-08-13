-- Claim, verify and reset a student's sign-in PIN.
--
-- All three live in the database rather than an edge function so the PIN and its
-- hash never travel: the plaintext arrives as an argument, is compared by
-- pgcrypto inside Postgres, and the hash is never selected out. The edge
-- function learns only whether it matched.
--
-- `search_path` includes `extensions` deliberately. Supabase installs pgcrypto
-- there, and a security-definer function pinned to `public` alone fails at
-- runtime with "function gen_random_bytes does not exist" even though the
-- migration applies cleanly — see pitfall #35, which cost real time once.

-- How many wrong PINs before a student is locked out, and for how long. Six
-- digits is a million combinations; unthrottled, that is guessable by a patient
-- classmate who already knows the student ID. Throttled, it is not.
create or replace function public.verify_student_pin(
  p_course_id text,
  p_student_identifier text,
  p_pin text
)
returns table (profile_id uuid, institutional_email text)
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

  -- Deliberately the same error for "no such student" and "wrong PIN". Telling
  -- an attacker which student IDs exist hands them half the credential.
  if v_profile.id is null then
    raise exception 'pin_invalid';
  end if;

  if v_profile.pin_locked_until is not null and v_profile.pin_locked_until > now() then
    raise exception 'pin_locked';
  end if;

  if v_profile.pin_hash is null then
    raise exception 'pin_not_set';
  end if;

  if v_profile.status not in ('active', 'invited') then
    raise exception 'pin_invalid';
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
    raise exception 'pin_invalid';
  end if;

  if crypt(p_pin, v_profile.pin_hash) <> v_profile.pin_hash then
    update public.profiles
       set pin_failed_attempts = pin_failed_attempts + 1,
           pin_locked_until = case
             when pin_failed_attempts + 1 >= v_max_attempts
               then now() + make_interval(mins => v_lock_minutes)
             else pin_locked_until
           end,
           updated_at = now()
     where id = v_profile.id;
    raise exception 'pin_invalid';
  end if;

  update public.profiles
     set pin_failed_attempts = 0,
         pin_locked_until = null,
         -- Signing in is the claim, same rule as every other door.
         status = case when status = 'invited' then 'active' else status end,
         updated_at = now()
   where id = v_profile.id;

  return query select v_profile.id, v_profile.institutional_email;
end;
$$;

-- Setting a PIN for the first time. Requires the join code of a class that is
-- live right now, which is what puts the student physically in the room.
create or replace function public.claim_student_pin(
  p_course_id text,
  p_student_identifier text,
  p_join_code text,
  p_pin text
)
returns table (profile_id uuid, institutional_email text)
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
    raise exception 'pin_format';
  end if;

  select * into v_session
    from public.class_sessions
   where upper(join_code) = upper(trim(p_join_code))
     and course_id = p_course_id
   limit 1;
  if v_session.id is null then
    raise exception 'join_invalid';
  end if;
  -- Live only. A closed or planned class is not a room anyone is standing in,
  -- so it cannot vouch for who is claiming.
  if v_session.state <> 'live' then
    raise exception 'join_not_live';
  end if;

  select * into v_profile
    from public.profiles
   where lower(student_identifier) = lower(trim(p_student_identifier))
   limit 1;
  if v_profile.id is null then
    raise exception 'student_unknown';
  end if;
  if v_profile.status not in ('active', 'invited') then
    raise exception 'student_unknown';
  end if;

  -- Already claimed. The professor resets it; a second claim must never
  -- silently take over an account that is already in use.
  if v_profile.pin_hash is not null then
    raise exception 'pin_already_set';
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
    raise exception 'not_in_this_class';
  end if;

  update public.profiles
     set pin_hash = crypt(p_pin, gen_salt('bf', 10)),
         pin_set_at = now(),
         pin_failed_attempts = 0,
         pin_locked_until = null,
         status = case when status = 'invited' then 'active' else status end,
         updated_at = now()
   where id = v_profile.id;

  return query select v_profile.id, v_profile.institutional_email;
end;
$$;

-- The professor's reset. Clears the PIN and nothing else: attendance, answers,
-- quiz attempts, reflections and grades are untouched, so a forgotten PIN never
-- costs a student their record.
create or replace function public.reset_student_pin(
  p_course_id text,
  p_profile_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.profiles
     set pin_hash = null,
         pin_set_at = null,
         pin_failed_attempts = 0,
         pin_locked_until = null,
         updated_at = now()
   where id = p_profile_id;

  insert into public.audit_log (course_id, actor_profile_id, target_type, target_id, action, metadata)
  values (
    p_course_id, p_actor_profile_id, 'profile', p_profile_id, 'student_pin_reset',
    jsonb_build_object('note', 'PIN cleared; student sets a new one at the next class QR scan.')
  );
end;
$$;

revoke all on function public.verify_student_pin(text, text, text) from public, anon, authenticated;
revoke all on function public.claim_student_pin(text, text, text, text) from public, anon, authenticated;
revoke all on function public.reset_student_pin(text, uuid, uuid) from public, anon, authenticated;
