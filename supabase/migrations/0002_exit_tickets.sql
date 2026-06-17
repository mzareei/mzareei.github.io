create table if not exists public.course_exit_tickets (
  id uuid primary key default gen_random_uuid(),
  course_id text not null default 'tc2007b',
  lecture_id text not null,
  lecture_title text not null,
  student_name text check (length(student_name) <= 120),
  student_identifier text check (length(student_identifier) <= 80),
  confidence int not null check (confidence between 1 and 5),
  one_thing text not null check (length(one_thing) between 1 and 500),
  muddy_point text not null check (length(muddy_point) between 1 and 500),
  next_action text not null default 'review_mission' check (length(next_action) between 1 and 40),
  created_at timestamptz not null default now()
);

create index if not exists course_exit_tickets_course_lecture_created_idx
on public.course_exit_tickets(course_id, lecture_id, created_at desc);

alter table public.course_exit_tickets enable row level security;
revoke all on public.course_exit_tickets from anon, authenticated;
