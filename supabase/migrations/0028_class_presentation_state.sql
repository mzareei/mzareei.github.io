-- Store the latest synchronized classroom presentation position.
-- Session, pulse, and quiz records remain authoritative for teaching activity.

create table public.class_presentation_state (
  class_session_id uuid primary key references public.class_sessions(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  requested_slide integer not null default 1 check (requested_slide >= 1),
  acknowledged_slide integer not null default 1 check (acknowledged_slide >= 1),
  phase text not null default 'lecture'
    check (phase in ('lecture', 'pulse', 'quiz', 'podium', 'reflection', 'closed')),
  checkpoint_key text,
  checkpoint_after_slide integer
    check (checkpoint_after_slide is null or checkpoint_after_slide >= 1),
  projector_seen_at timestamptz,
  controller_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.class_presentation_state is
  'Latest synchronized presentation state for one class session; edge functions enforce the controller/projector boundary.';
comment on column public.class_presentation_state.revision is
  'Monotonic controller-owned revision for control changes.';
comment on column public.class_presentation_state.requested_slide is
  'Controller-owned teaching-slide target.';
comment on column public.class_presentation_state.phase is
  'Controller-owned classroom display phase.';
comment on column public.class_presentation_state.acknowledged_slide is
  'Projector telemetry reporting the last applied teaching slide.';
comment on column public.class_presentation_state.checkpoint_key is
  'Projector telemetry identifying the latest authored checkpoint reached.';
comment on column public.class_presentation_state.checkpoint_after_slide is
  'Projector telemetry identifying the checkpoint teaching-slide boundary.';
comment on column public.class_presentation_state.projector_seen_at is
  'Projector heartbeat telemetry; it is not a control field.';
comment on column public.class_presentation_state.controller_seen_at is
  'Controller heartbeat metadata; it is not a classroom command.';

alter table public.class_presentation_state enable row level security;

revoke all on table public.class_presentation_state
  from public, anon, authenticated;

create or replace function public.course_presentation_control(
  p_class_session_id uuid,
  p_expected_revision bigint,
  p_requested_slide integer default null,
  p_phase text default null
)
returns public.class_presentation_state
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state public.class_presentation_state;
begin
  if p_expected_revision < 0 then
    raise exception 'The expected revision must be non-negative.';
  end if;
  if p_requested_slide is not null and p_requested_slide < 1 then
    raise exception 'The requested slide must be positive.';
  end if;
  if p_phase is not null and p_phase not in ('lecture', 'pulse', 'quiz', 'podium', 'reflection', 'closed') then
    raise exception 'The presentation phase is invalid.';
  end if;

  insert into public.class_presentation_state (class_session_id)
  values (p_class_session_id)
  on conflict (class_session_id) do nothing;

  select * into current_state
  from public.class_presentation_state
  where class_session_id = p_class_session_id
  for update;

  if current_state.revision > p_expected_revision then
    if (p_requested_slide is null or current_state.requested_slide = p_requested_slide)
      and (p_phase is null or current_state.phase = p_phase) then
      return current_state;
    end if;
    raise exception 'The presentation revision is stale.';
  end if;
  if current_state.revision <> p_expected_revision then
    raise exception 'The presentation revision is invalid.';
  end if;

  update public.class_presentation_state
  set revision = revision + 1,
      requested_slide = coalesce(p_requested_slide, requested_slide),
      phase = coalesce(p_phase, phase),
      checkpoint_key = null,
      checkpoint_after_slide = null,
      controller_seen_at = now(),
      updated_at = now()
  where class_session_id = p_class_session_id
  returning * into current_state;
  return current_state;
end;
$$;

create or replace function public.course_presentation_telemetry(
  p_class_session_id uuid,
  p_revision bigint,
  p_acknowledged_slide integer default null,
  p_checkpoint_key text default null,
  p_checkpoint_after_slide integer default null,
  p_surface text default 'projector'
)
returns public.class_presentation_state
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state public.class_presentation_state;
begin
  if p_revision < 0 then
    raise exception 'The presentation revision must be non-negative.';
  end if;
  if p_acknowledged_slide is not null and p_acknowledged_slide < 1 then
    raise exception 'The acknowledged slide must be positive.';
  end if;
  if p_checkpoint_after_slide is not null and p_checkpoint_after_slide < 1 then
    raise exception 'The checkpoint slide must be positive.';
  end if;
  if p_surface not in ('projector', 'controller') then
    raise exception 'The presentation surface is invalid.';
  end if;

  insert into public.class_presentation_state (class_session_id)
  values (p_class_session_id)
  on conflict (class_session_id) do nothing;

  select * into current_state
  from public.class_presentation_state
  where class_session_id = p_class_session_id
  for update;

  -- Acknowledgements and checkpoints apply only to the exact current command.
  -- Stale/future reports are safe idempotent no-ops and return current state.
  if current_state.revision <> p_revision then
    return current_state;
  end if;
  if p_acknowledged_slide is not null
    and p_acknowledged_slide <> current_state.requested_slide then
    return current_state;
  end if;
  if (p_checkpoint_key is null) <> (p_checkpoint_after_slide is null) then
    raise exception 'Checkpoint key and slide must be supplied together.';
  end if;
  if p_checkpoint_key is not null and nullif(trim(p_checkpoint_key), '') is null then
    raise exception 'Checkpoint key must not be empty.';
  end if;
  if p_checkpoint_after_slide is not null
    and (
      p_checkpoint_after_slide <> current_state.requested_slide
      or p_checkpoint_after_slide <> current_state.acknowledged_slide
    ) then
    return current_state;
  end if;

  update public.class_presentation_state
  set acknowledged_slide = coalesce(p_acknowledged_slide, acknowledged_slide),
      checkpoint_key = coalesce(nullif(trim(p_checkpoint_key), ''), checkpoint_key),
      checkpoint_after_slide = coalesce(p_checkpoint_after_slide, checkpoint_after_slide),
      projector_seen_at = case when p_surface = 'projector' then now() else projector_seen_at end,
      controller_seen_at = case when p_surface = 'controller' then now() else controller_seen_at end,
      updated_at = now()
  where class_session_id = p_class_session_id
  returning * into current_state;
  return current_state;
end;
$$;

revoke all on function public.course_presentation_control(uuid, bigint, integer, text)
  from public, anon, authenticated;
revoke all on function public.course_presentation_telemetry(uuid, bigint, integer, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.course_presentation_control(uuid, bigint, integer, text)
  to service_role;
grant execute on function public.course_presentation_telemetry(uuid, bigint, integer, text, integer, text)
  to service_role;
