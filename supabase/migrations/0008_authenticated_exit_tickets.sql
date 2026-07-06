create extension if not exists pgcrypto;

create table if not exists public.exit_tickets (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  class_session_id uuid references public.class_sessions(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  confidence int not null check (confidence between 1 and 5),
  one_thing text not null check (length(one_thing) between 1 and 500),
  muddy_point text not null check (length(muddy_point) between 1 and 500),
  next_action text not null default 'review_mission' check (length(next_action) between 1 and 40),
  created_at timestamptz not null default now()
);

create index if not exists exit_tickets_course_section_created_idx
on public.exit_tickets(course_id, section_id, created_at desc);

create index if not exists exit_tickets_profile_created_idx
on public.exit_tickets(profile_id, course_id, created_at desc);

create index if not exists exit_tickets_session_created_idx
on public.exit_tickets(class_session_id, created_at desc)
where class_session_id is not null;

alter table public.exit_tickets enable row level security;

revoke all on public.exit_tickets from anon, authenticated;
