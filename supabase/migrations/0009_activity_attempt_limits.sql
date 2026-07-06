alter table public.student_attempts
  add column if not exists attempt_number int not null default 1 check (attempt_number between 1 and 20);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_attempts'::regclass
      and conname = 'student_attempts_activity_instance_id_profile_id_key'
  ) then
    alter table public.student_attempts
      drop constraint student_attempts_activity_instance_id_profile_id_key;
  end if;
end $$;

create unique index if not exists student_attempts_activity_profile_attempt_idx
on public.student_attempts(activity_instance_id, profile_id, attempt_number);

create index if not exists student_attempts_activity_profile_status_idx
on public.student_attempts(activity_instance_id, profile_id, status, started_at desc);
