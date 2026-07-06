create table if not exists public.profile_identity_confirmations (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'reported_issue')),
  issue_note text check (issue_note is null or length(issue_note) <= 1000),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, profile_id),
  check (status <> 'confirmed' or confirmed_at is not null),
  check (status <> 'reported_issue' or (issue_note is not null and length(issue_note) >= 5))
);

create index if not exists profile_identity_confirmations_profile_idx
on public.profile_identity_confirmations(profile_id, course_id, status);

alter table public.profile_identity_confirmations enable row level security;

revoke all on public.profile_identity_confirmations from anon, authenticated;
