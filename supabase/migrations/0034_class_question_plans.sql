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
  unique (checkpoint_id, question_id),
  unique (checkpoint_id, position)
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

create or replace function public.replace_class_question_plan_candidates(
  p_checkpoint_id uuid,
  p_question_bank_id uuid,
  p_question_ids uuid[],
  p_updated_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_checkpoint_id uuid;
begin
  select id
    into locked_checkpoint_id
    from public.class_question_plan_checkpoints
    where id = p_checkpoint_id
    for update;

  if not found then
    raise exception 'class_question_plan_checkpoint_not_found';
  end if;

  delete from public.class_question_plan_candidates
    where checkpoint_id = locked_checkpoint_id;

  insert into public.class_question_plan_candidates (
    checkpoint_id,
    question_bank_id,
    question_id,
    position,
    updated_by
  )
  select
    locked_checkpoint_id,
    p_question_bank_id,
    question_id,
    position::int,
    p_updated_by
  from unnest(p_question_ids) with ordinality as candidates(question_id, position);
end;
$$;

revoke all on function public.replace_class_question_plan_candidates(uuid, uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.replace_class_question_plan_candidates(uuid, uuid, uuid[], uuid)
  to service_role;
