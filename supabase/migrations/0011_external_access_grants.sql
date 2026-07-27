-- Sign-in normally requires an institutional email domain. An external access grant is an
-- exact-address exception recorded by an instructor from the roster panel, so guest
-- professors, collaborators, and QA test accounts can be added without a redeploy.
--
-- A grant only opens the sign-in door. Course memberships and section enrollments still
-- decide what the account can actually see.
create table if not exists public.external_access_grants (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  email text not null check (
    email = lower(email)
    and email like '%@%'
    and length(email) between 5 and 200
  ),
  status text not null default 'active' check (status in ('active', 'revoked')),
  reason text not null check (length(reason) between 3 and 400),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, email),
  check (status <> 'revoked' or revoked_at is not null)
);

create index if not exists external_access_grants_email_idx
on public.external_access_grants(email, status);

alter table public.external_access_grants enable row level security;

revoke all on public.external_access_grants from anon, authenticated;
