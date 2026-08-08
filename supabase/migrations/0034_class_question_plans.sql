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
create unique index if not exists pulse_rounds_plan_checkpoint_id_unique_idx
  on public.pulse_rounds(plan_checkpoint_id)
  where plan_checkpoint_id is not null;

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
  locked_checkpoint_state text;
begin
  select id, state
    into locked_checkpoint_id, locked_checkpoint_state
    from public.class_question_plan_checkpoints
    where id = p_checkpoint_id
    for update;

  if not found then
    raise exception 'class_question_plan_checkpoint_not_found';
  end if;

  if locked_checkpoint_state <> 'planned'
    or exists (
      select 1
        from public.pulse_rounds
        where plan_checkpoint_id = locked_checkpoint_id
    ) then
    raise exception 'class_question_plan_checkpoint_locked';
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

create or replace function public.push_class_question_plan_round(
  p_course_id text,
  p_class_session_id uuid,
  p_section_id uuid,
  p_question_id uuid,
  p_plan_checkpoint_id uuid,
  p_prompt_snapshot jsonb,
  p_points numeric,
  p_answer_points numeric,
  p_time_limit_seconds int,
  p_opened_at timestamptz,
  p_ends_at timestamptz,
  p_created_by uuid
)
returns public.pulse_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_checkpoint_id uuid;
  locked_checkpoint_state text;
  locked_plan_session_id uuid;
  locked_plan_question_bank_id uuid;
  inserted_round public.pulse_rounds%rowtype;
begin
  select
    checkpoint.id,
    checkpoint.state,
    plan.class_session_id,
    plan.question_bank_id
    into
      locked_checkpoint_id,
      locked_checkpoint_state,
      locked_plan_session_id,
      locked_plan_question_bank_id
    from public.class_question_plan_checkpoints checkpoint
    join public.class_question_plans plan
      on plan.id = checkpoint.plan_id
    where checkpoint.id = p_plan_checkpoint_id
    for update of checkpoint;

  if not found or locked_plan_session_id <> p_class_session_id then
    raise exception 'class_question_plan_checkpoint_not_found';
  end if;

  if locked_checkpoint_state <> 'planned'
    or exists (
      select 1
        from public.pulse_rounds
        where plan_checkpoint_id = locked_checkpoint_id
    ) then
    raise exception 'class_question_plan_checkpoint_locked';
  end if;

  if not exists (
    select 1
      from public.class_question_plan_candidates candidate
      where candidate.checkpoint_id = locked_checkpoint_id
        and candidate.question_id = p_question_id
        and (
          locked_plan_question_bank_id is null
          or candidate.question_bank_id = locked_plan_question_bank_id
        )
  ) then
    raise exception 'class_question_plan_question_not_candidate';
  end if;

  update public.pulse_rounds
    set state = 'closed',
        closed_at = coalesce(p_opened_at, now())
    where class_session_id = p_class_session_id
      and state = 'open';

  insert into public.pulse_rounds (
    course_id,
    class_session_id,
    section_id,
    question_id,
    plan_checkpoint_id,
    prompt_snapshot,
    state,
    points,
    answer_points,
    time_limit_seconds,
    opened_at,
    ends_at,
    created_by
  )
  values (
    p_course_id,
    p_class_session_id,
    p_section_id,
    p_question_id,
    p_plan_checkpoint_id,
    p_prompt_snapshot,
    'open',
    p_points,
    p_answer_points,
    p_time_limit_seconds,
    p_opened_at,
    p_ends_at,
    p_created_by
  )
  returning *
    into inserted_round;

  update public.class_question_plan_checkpoints
    set state = 'sent',
        updated_by = p_created_by,
        updated_at = coalesce(p_opened_at, now())
    where id = locked_checkpoint_id;

  return inserted_round;
end;
$$;

revoke all on function public.push_class_question_plan_round(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  numeric,
  numeric,
  int,
  timestamptz,
  timestamptz,
  uuid
)
  from public, anon, authenticated;
grant execute on function public.push_class_question_plan_round(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  numeric,
  numeric,
  int,
  timestamptz,
  timestamptz,
  uuid
)
  to service_role;
