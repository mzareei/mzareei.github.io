create extension if not exists pgcrypto;

create table if not exists public.quiz_courses (
  id text primary key,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_lectures (
  id text primary key,
  course_id text not null references public.quiz_courses(id) on delete cascade,
  title text not null,
  week_number int,
  lecture_number int,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lecture_id text not null references public.quiz_lectures(id) on delete cascade,
  prompt text not null,
  prompt_es text,
  question_type text not null default 'single_choice',
  difficulty text not null default 'medium',
  topic text[] not null default '{}',
  points numeric not null default 1 check (points > 0),
  active boolean not null default true,
  explanation text,
  explanation_es text,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_text text not null,
  option_text_es text,
  is_correct boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  session_code text not null unique,
  lecture_id text not null references public.quiz_lectures(id) on delete cascade,
  title text not null,
  question_count int not null default 10 check (question_count between 1 and 30),
  starts_at timestamptz not null default now(),
  closes_at timestamptz,
  show_explanations boolean not null default false,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  student_name text not null check (length(student_name) between 1 and 120),
  student_identifier text not null check (length(student_identifier) between 1 and 80),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  total numeric,
  created_at timestamptz not null default now()
);

create unique index if not exists quiz_attempts_one_identifier_per_session
on public.quiz_attempts(session_id, lower(student_identifier));

create table if not exists public.quiz_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete restrict,
  position int not null,
  option_order uuid[] not null,
  points numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  unique (attempt_id, position)
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_question_id uuid not null unique references public.quiz_attempt_questions(id) on delete cascade,
  selected_option_id uuid references public.quiz_options(id) on delete restrict,
  is_correct boolean not null default false,
  points_awarded numeric not null default 0,
  answered_at timestamptz not null default now()
);

alter table public.quiz_courses enable row level security;
alter table public.quiz_lectures enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_questions enable row level security;
alter table public.quiz_answers enable row level security;

revoke all on public.quiz_courses from anon, authenticated;
revoke all on public.quiz_lectures from anon, authenticated;
revoke all on public.quiz_questions from anon, authenticated;
revoke all on public.quiz_options from anon, authenticated;
revoke all on public.quiz_sessions from anon, authenticated;
revoke all on public.quiz_attempts from anon, authenticated;
revoke all on public.quiz_attempt_questions from anon, authenticated;
revoke all on public.quiz_answers from anon, authenticated;
