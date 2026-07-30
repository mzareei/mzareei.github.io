alter table public.question_banks
  add column if not exists checkpoint_preparation_state text not null default 'none',
  add column if not exists checkpoint_preparation_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'question_banks_checkpoint_preparation_state_check'
        and conrelid = 'public.question_banks'::regclass
  ) then
    alter table public.question_banks
      add constraint question_banks_checkpoint_preparation_state_check
      check (checkpoint_preparation_state in ('none', 'pending_upload', 'ready'));
  end if;
end;
$$;

create or replace function public.begin_question_bank_checkpoint_preparation(
  p_course_id text,
  p_bank_id uuid,
  p_mappings jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  active_question_count integer;
  mapped_question_count integer;
  distinct_question_count integer;
  matched_question_count integer;
  updated_question_count integer;
  preparation_state text;
begin
  select checkpoint_preparation_state
    into preparation_state
    from public.question_banks
    where id = p_bank_id
      and course_id = p_course_id
      and status = 'active'
    for update;

  if not found then
    raise exception 'Active question bank not found.';
  end if;
  if preparation_state <> 'none' then
    raise exception 'Checkpoint preparation has already started for this bank.';
  end if;
  if coalesce(jsonb_typeof(p_mappings), 'null') <> 'array' then
    raise exception 'Checkpoint mappings must be an array.';
  end if;
  if jsonb_array_length(p_mappings) <> 18 then
    raise exception 'Checkpoint preparation requires exactly 18 mappings.';
  end if;

  select count(*)
    into active_question_count
    from public.questions
    where question_bank_id = p_bank_id
      and status = 'active';
  if active_question_count <> 18 then
    raise exception 'Checkpoint preparation requires exactly 18 active questions.';
  end if;
  if exists (
    select 1
      from public.questions
      where question_bank_id = p_bank_id
        and status = 'active'
        and (
          segment_key is not null
          or coalesce(cardinality(source_slide_numbers), 0) > 0
          or source_slide_start is not null
          or source_slide_end is not null
          or checkpoint_after_slide is not null
        )
  ) then
    raise exception 'Checkpoint metadata is not completely empty.';
  end if;

  with supplied as (
    select
      value,
      value ->> 'question_id' as question_id
    from jsonb_array_elements(p_mappings)
  )
  select
    count(*),
    count(distinct question_id),
    count(q.id)
    into mapped_question_count, distinct_question_count, matched_question_count
    from supplied
    left join public.questions q
      on q.id::text = supplied.question_id
     and q.question_bank_id = p_bank_id
     and q.status = 'active';

  if mapped_question_count <> 18
     or distinct_question_count <> 18
     or matched_question_count <> 18 then
    raise exception 'Mappings must identify every active bank question exactly once.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_mappings) supplied(value)
      where jsonb_typeof(value) <> 'object'
        or jsonb_typeof(value -> 'question_id') <> 'string'
        or jsonb_typeof(value -> 'segment_key') <> 'string'
        or jsonb_typeof(value -> 'source_slide_numbers') <> 'array'
        or jsonb_typeof(value -> 'source_slide_start') <> 'number'
        or jsonb_typeof(value -> 'source_slide_end') <> 'number'
        or jsonb_typeof(value -> 'checkpoint_after_slide') <> 'number'
  ) then
    raise exception 'A checkpoint mapping has an invalid shape.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_mappings) supplied(value)
      where jsonb_array_length(value -> 'source_slide_numbers') < 1
        or (value ->> 'segment_key') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        or (value ->> 'source_slide_start') !~ '^[1-9][0-9]*$'
        or (value ->> 'source_slide_end') !~ '^[1-9][0-9]*$'
        or (value ->> 'checkpoint_after_slide') !~ '^[1-9][0-9]*$'
        or exists (
          select 1
            from jsonb_array_elements_text(value -> 'source_slide_numbers')
              as slide(slide_number)
            where slide_number !~ '^[1-9][0-9]*$'
        )
  ) then
    raise exception 'A checkpoint mapping contains invalid metadata.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_mappings) supplied(value)
      where (value ->> 'source_slide_end')::integer
          < (value ->> 'source_slide_start')::integer
        or (value ->> 'checkpoint_after_slide')::integer
          < (value ->> 'source_slide_end')::integer
  ) then
    raise exception 'A checkpoint mapping contains an invalid slide range.';
  end if;

  with supplied as (
    select
      (value ->> 'question_id')::uuid as question_id,
      value ->> 'segment_key' as segment_key,
      array(
        select slide_number::integer
          from jsonb_array_elements_text(value -> 'source_slide_numbers')
            as slide(slide_number)
      ) as source_slide_numbers,
      (value ->> 'source_slide_start')::integer as source_slide_start,
      (value ->> 'source_slide_end')::integer as source_slide_end,
      (value ->> 'checkpoint_after_slide')::integer as checkpoint_after_slide
    from jsonb_array_elements(p_mappings)
  )
  update public.questions q
    set segment_key = supplied.segment_key,
        source_slide_numbers = supplied.source_slide_numbers,
        source_slide_start = supplied.source_slide_start,
        source_slide_end = supplied.source_slide_end,
        checkpoint_after_slide = supplied.checkpoint_after_slide
    from supplied
    where q.id = supplied.question_id
      and q.question_bank_id = p_bank_id
      and q.status = 'active';
  get diagnostics updated_question_count = row_count;

  if updated_question_count <> 18 then
    raise exception 'Checkpoint metadata could not be committed for all questions.';
  end if;

  update public.question_banks
    set checkpoint_preparation_state = 'pending_upload',
        checkpoint_preparation_updated_at = now(),
        updated_at = now()
    where id = p_bank_id
      and course_id = p_course_id;

  return 'pending_upload';
end;
$$;

create or replace function public.complete_question_bank_checkpoint_preparation(
  p_course_id text,
  p_bank_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  preparation_state text;
begin
  select checkpoint_preparation_state
    into preparation_state
    from public.question_banks
    where id = p_bank_id
      and course_id = p_course_id
      and status = 'active'
    for update;

  if not found then
    raise exception 'Active question bank not found.';
  end if;
  if preparation_state = 'none' then
    raise exception 'Checkpoint preparation has not started for this bank.';
  end if;
  if preparation_state = 'pending_upload' then
    update public.question_banks
      set checkpoint_preparation_state = 'ready',
          checkpoint_preparation_updated_at = now(),
          updated_at = now()
      where id = p_bank_id
        and course_id = p_course_id;
  end if;

  return 'ready';
end;
$$;

revoke all on function public.begin_question_bank_checkpoint_preparation(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.begin_question_bank_checkpoint_preparation(text, uuid, jsonb)
  to service_role;

revoke all on function public.complete_question_bank_checkpoint_preparation(text, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_question_bank_checkpoint_preparation(text, uuid)
  to service_role;
