-- The piñata race. Attempts carry a secret racer identity and two progress
-- integers (fed by fire-and-forget pings; grading never reads them), and
-- cheers from finished students to running ones get their own tiny table.

alter table public.student_attempts add column if not exists racer_name text;
alter table public.student_attempts add column if not exists racer_emoji text;
alter table public.student_attempts add column if not exists progress_position int not null default 0;
alter table public.student_attempts add column if not exists progress_answered int not null default 0;

-- Two students starting in the same second must not draw the same name; the
-- retry loop in course-activity-attempt leans on this index.
create unique index if not exists student_attempts_racer_name_key
  on public.student_attempts (activity_instance_id, racer_name)
  where racer_name is not null;

create table if not exists public.quiz_cheers (
  id uuid primary key default gen_random_uuid(),
  activity_instance_id uuid not null references public.activity_instances(id) on delete cascade,
  from_attempt_id uuid not null references public.student_attempts(id) on delete cascade,
  to_attempt_id uuid not null references public.student_attempts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists quiz_cheers_instance_created_idx
  on public.quiz_cheers (activity_instance_id, created_at);

-- Same posture as every other table: RLS on, no policies, service role only.
alter table public.quiz_cheers enable row level security;
revoke all on public.quiz_cheers from anon, authenticated;
