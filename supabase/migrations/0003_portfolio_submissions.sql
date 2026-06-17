create table if not exists public.course_portfolio_submissions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null default 'tc2007b',
  student_name text check (length(student_name) <= 120),
  student_identifier text check (length(student_identifier) <= 80),
  overall_percent int not null default 0 check (overall_percent between 0 and 100),
  mission_average int not null default 0 check (mission_average between 0 and 100),
  quiz_average int not null default 0 check (quiz_average between 0 and 100),
  case_completed int not null default 0 check (case_completed between 0 and 5),
  attack_chain_percent int not null default 0 check (attack_chain_percent between 0 and 100),
  concept_map_percent int not null default 0 check (concept_map_percent between 0 and 100),
  review_cards int not null default 0 check (review_cards between 0 and 500),
  reflections int not null default 0 check (reflections between 0 and 500),
  portfolio jsonb not null check (jsonb_typeof(portfolio) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists course_portfolio_submissions_course_created_idx
on public.course_portfolio_submissions(course_id, created_at desc);

create index if not exists course_portfolio_submissions_student_idx
on public.course_portfolio_submissions(course_id, student_identifier, created_at desc);

alter table public.course_portfolio_submissions enable row level security;
revoke all on public.course_portfolio_submissions from anon, authenticated;
