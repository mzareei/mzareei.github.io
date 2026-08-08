create table if not exists public.class_question_plans (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id),
  question_bank_id uuid references public.question_banks(id),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id)
);

create table if not exists public.class_question_plan_checkpoints (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.class_question_plans(id) on delete cascade,
  position int not null check (position >= 1),
  topic text not null check (length(trim(topic)) between 1 and 160),
  slide_hint int check (slide_hint is null or slide_hint >= 1),
  notes text check (notes is null or length(notes) <= 1000),
  state text not null default 'planned' check (state in ('planned', 'sent', 'skipped')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, position)
);

create table if not exists public.class_question_plan_candidates (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.class_question_plan_checkpoints(id) on delete cascade,
  question_bank_id uuid references public.question_banks(id),
  question_id uuid not null references public.questions(id),
  position int not null check (position >= 1),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkpoint_id, question_id)
);

alter table public.pulse_rounds
  add column if not exists plan_checkpoint_id uuid references public.class_question_plan_checkpoints(id) on delete restrict;

create index if not exists class_question_plans_class_session_id_idx on public.class_question_plans(class_session_id);

create index if not exists class_question_plan_candidates_checkpoint_id_idx on public.class_question_plan_candidates(checkpoint_id);
create index if not exists pulse_rounds_plan_checkpoint_id_idx on public.pulse_rounds(plan_checkpoint_id);

alter table public.class_question_plans enable row level security;
alter table public.class_question_plan_checkpoints enable row level security;
alter table public.class_question_plan_candidates enable row level security;

revoke all on table public.class_question_plans
  from public, anon, authenticated;
revoke all on table public.class_question_plan_checkpoints
  from public, anon, authenticated;
revoke all on table public.class_question_plan_candidates
  from public, anon, authenticated;
