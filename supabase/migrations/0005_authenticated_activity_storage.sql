create extension if not exists pgcrypto;

create table if not exists public.activity_templates (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  activity_type text not null check (activity_type in ('quiz', 'mission', 'exit_ticket', 'case_file', 'portfolio', 'participation_pulse')),
  grading_mode text not null default 'completion' check (grading_mode in ('completion', 'correctness', 'rubric', 'participation', 'manual')),
  max_score numeric not null default 0 check (max_score >= 0),
  weight_category text check (weight_category is null or length(weight_category) <= 80),
  instructions text check (instructions is null or length(instructions) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_item_id, activity_type)
);

create table if not exists public.activity_instances (
  id uuid primary key default gen_random_uuid(),
  activity_template_id uuid not null references public.activity_templates(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  class_session_id uuid references public.class_sessions(id) on delete set null,
  state text not null default 'planned' check (state in ('planned', 'open', 'live', 'paused', 'closed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  time_limit_seconds int check (time_limit_seconds is null or time_limit_seconds between 30 and 14400),
  randomization_policy text not null default 'none' check (randomization_policy in ('none', 'shuffle_questions', 'shuffle_options', 'shuffle_questions_and_options', 'random_bank_sample')),
  question_count int check (question_count is null or question_count between 1 and 100),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  title text not null check (length(title) between 1 and 180),
  bank_type text not null default 'practice' check (bank_type in ('practice', 'graded', 'exam_prep', 'diagnostic')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references public.question_banks(id) on delete cascade,
  prompt text not null check (length(prompt) between 1 and 4000),
  question_type text not null default 'single_choice' check (question_type in ('single_choice', 'multiple_choice', 'short_text', 'reflection', 'rubric')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  topic_tags text[] not null default '{}',
  points numeric not null default 1 check (points >= 0),
  explanation text check (explanation is null or length(explanation) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null check (length(option_text) between 1 and 2000),
  is_correct boolean not null default false,
  position int not null default 0 check (position >= 0),
  feedback text check (feedback is null or length(feedback) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_attempts (
  id uuid primary key default gen_random_uuid(),
  activity_instance_id uuid not null references public.activity_instances(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'started' check (status in ('started', 'submitted', 'late', 'excused', 'missing', 'locked')),
  score_raw numeric,
  score_percent numeric check (score_percent is null or score_percent between 0 and 100),
  speed_bonus numeric not null default 0 check (speed_bonus >= 0),
  score_final numeric,
  grading_version text not null default 'v1' check (length(grading_version) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_instance_id, profile_id)
);

create table if not exists public.student_responses (
  id uuid primary key default gen_random_uuid(),
  student_attempt_id uuid not null references public.student_attempts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete restrict,
  response_json jsonb not null default '{}'::jsonb check (jsonb_typeof(response_json) = 'object'),
  selected_option_id uuid references public.question_options(id) on delete restrict,
  is_correct boolean,
  points_awarded numeric not null default 0 check (points_awarded >= 0),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_attempt_id, question_id)
);

create index if not exists activity_templates_content_idx
on public.activity_templates(content_item_id, activity_type);

create index if not exists activity_instances_section_state_idx
on public.activity_instances(section_id, state, starts_at);

create index if not exists question_banks_course_status_idx
on public.question_banks(course_id, status, bank_type);

create index if not exists questions_bank_status_idx
on public.questions(question_bank_id, status, difficulty);

create index if not exists question_options_question_position_idx
on public.question_options(question_id, position);

create index if not exists student_attempts_profile_idx
on public.student_attempts(profile_id, section_id, status, started_at desc);

create index if not exists student_attempts_activity_idx
on public.student_attempts(activity_instance_id, status, submitted_at desc);

create index if not exists student_responses_attempt_idx
on public.student_responses(student_attempt_id, answered_at);

alter table public.activity_templates enable row level security;
alter table public.activity_instances enable row level security;
alter table public.question_banks enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.student_attempts enable row level security;
alter table public.student_responses enable row level security;

revoke all on public.activity_templates from anon, authenticated;
revoke all on public.activity_instances from anon, authenticated;
revoke all on public.question_banks from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.question_options from anon, authenticated;
revoke all on public.student_attempts from anon, authenticated;
revoke all on public.student_responses from anon, authenticated;
