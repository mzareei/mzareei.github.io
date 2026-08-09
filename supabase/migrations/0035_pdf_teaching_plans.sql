-- PDF teaching-plan snapshots and source-grounding state. Existing jobs retain
-- the legacy deck-and-bank behavior until a new plan is approved.
alter table public.generation_jobs
  add column if not exists generation_mode text not null default 'deck_and_bank'
    check (generation_mode in ('deck_and_bank', 'bank_only')),
  add column if not exists teaching_brief jsonb,
  add column if not exists proposed_plan jsonb,
  add column if not exists approved_plan jsonb,
  add column if not exists grounding_status text not null default 'pending'
    check (grounding_status in ('pending', 'passed', 'failed'));

alter table public.generation_jobs
  drop constraint if exists generation_jobs_status_check,
  add constraint generation_jobs_status_check check (status in (
    'queued', 'extracting', 'outlining', 'ready_for_plan_review',
    'generating_deck', 'generating_questions', 'grounding', 'assembling',
    'ready_for_review', 'approved', 'failed'
  ));

alter table public.question_banks
  add column if not exists generation_validation_profile text not null default 'legacy'
    check (generation_validation_profile in ('legacy', 'flexible'));

alter table public.questions
  add column if not exists source_pdf_pages integer[];

-- Finalize a grounded generation bundle in one database transaction. The deck
-- bytes already exist at a per-job immutable path; this function is the only
-- operation that changes content_items.source_ref to that path. If any bank,
-- question, option, version, upload, or job write fails, PostgreSQL rolls the
-- pointer change back with the rest of the transaction.
create or replace function public.finalize_pdf_generation_bundle(
  p_job_id uuid,
  p_staging_deck_path text,
  p_questions jsonb,
  p_prior_version jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  generation_job public.generation_jobs%rowtype;
  content_item public.content_items%rowtype;
  question_bank public.question_banks%rowtype;
  question_value jsonb;
  option_value jsonb;
  inserted_question_id uuid;
  question_index integer := 0;
  option_index integer;
  next_version integer;
  expected_deck_prefix text;
begin
  select *
    into generation_job
    from public.generation_jobs
   where id = p_job_id
   for update;

  if not found then
    raise exception 'Generation job not found.';
  end if;

  -- A concurrent retry that waited for the first finalizer is harmless.
  if generation_job.status = 'ready_for_review'
     and generation_job.question_bank_id is not null then
    return jsonb_build_object(
      'content_item_id', generation_job.content_item_id,
      'question_bank_id', generation_job.question_bank_id
    );
  end if;

  if generation_job.status <> 'assembling' then
    raise exception 'Generation job is not ready for assembly.';
  end if;
  if generation_job.grounding_status <> 'passed'
     or generation_job.approved_plan is null then
    raise exception 'Generation job has not passed grounded plan review.';
  end if;
  if coalesce(jsonb_typeof(p_questions), 'null') <> 'array'
     or jsonb_array_length(p_questions) = 0 then
    raise exception 'Generated questions must be a non-empty array.';
  end if;

  if generation_job.generation_mode = 'deck_and_bank' then
    expected_deck_prefix := 'courses/' || generation_job.course_id
      || '/generation/' || generation_job.id || '/';
    if p_staging_deck_path is null
       or p_staging_deck_path not like expected_deck_prefix || '%' then
      raise exception 'The generated deck path is outside its immutable job prefix.';
    end if;

    select *
      into content_item
      from public.content_items
     where course_id = generation_job.course_id
       and slug = generation_job.lecture_slug
     for update;

    if found then
      if content_item.owner_profile_id is not null
         and generation_job.created_by is not null
         and content_item.owner_profile_id <> generation_job.created_by then
        raise exception 'generation_slug_not_owned';
      end if;

      if content_item.source_ref <> p_staging_deck_path then
        if p_prior_version is null
           or p_prior_version ->> 'source_ref' <> content_item.source_ref
           or coalesce(p_prior_version ->> 'storage_path', '') = ''
           or coalesce(p_prior_version ->> 'content_sha256', '') !~ '^[0-9a-f]{64}$'
           or coalesce(p_prior_version ->> 'content_bytes', '') !~ '^[0-9]+$' then
          raise exception 'A verified snapshot of the currently served deck is required.';
        end if;

        select coalesce(max(version), 0) + 1
          into next_version
          from public.content_versions
         where content_item_id = content_item.id;

        insert into public.content_versions (
          content_item_id,
          version,
          storage_path,
          content_sha256,
          content_bytes,
          published_by,
          published_from,
          note
        ) values (
          content_item.id,
          next_version,
          p_prior_version ->> 'storage_path',
          p_prior_version ->> 'content_sha256',
          (p_prior_version ->> 'content_bytes')::bigint,
          generation_job.created_by,
          'generation',
          'Snapshot taken before grounded PDF regeneration.'
        );
      end if;

      update public.content_items
         set title = generation_job.lecture_title,
             owner_profile_id = generation_job.created_by,
             content_type = 'lecture',
             source_kind = 'storage_object',
             source_ref = p_staging_deck_path,
             generation_job_id = generation_job.id,
             updated_at = now()
       where id = content_item.id
       returning * into content_item;
    else
      insert into public.content_items (
        course_id,
        slug,
        title,
        owner_profile_id,
        content_type,
        source_kind,
        source_ref,
        generation_job_id,
        updated_at
      ) values (
        generation_job.course_id,
        generation_job.lecture_slug,
        generation_job.lecture_title,
        generation_job.created_by,
        'lecture',
        'storage_object',
        p_staging_deck_path,
        generation_job.id,
        now()
      )
      returning * into content_item;
    end if;

    insert into public.question_banks (
      course_id,
      content_item_id,
      title,
      bank_type,
      status,
      generation_job_id,
      generation_validation_profile,
      updated_at
    ) values (
      generation_job.course_id,
      content_item.id,
      generation_job.lecture_title || ' — Question bank',
      'graded',
      'draft',
      generation_job.id,
      'flexible',
      now()
    )
    on conflict (course_id, content_item_id, bank_type) do update
      set title = excluded.title,
          status = 'draft',
          generation_job_id = excluded.generation_job_id,
          generation_validation_profile = 'flexible',
          updated_at = now()
    returning * into question_bank;
  else
    if coalesce(p_staging_deck_path, '') <> '' then
      raise exception 'Bank-only generation cannot publish a deck path.';
    end if;

    insert into public.question_banks (
      course_id,
      content_item_id,
      title,
      bank_type,
      status,
      generation_job_id,
      generation_validation_profile,
      updated_at
    ) values (
      generation_job.course_id,
      null,
      generation_job.lecture_title || ' — Question bank',
      'graded',
      'draft',
      generation_job.id,
      'flexible',
      now()
    )
    returning * into question_bank;
  end if;

  delete from public.questions
   where question_bank_id = question_bank.id
     and generation_job_id = generation_job.id;

  for question_value in
    select value from jsonb_array_elements(p_questions)
  loop
    question_index := question_index + 1;
    insert into public.questions (
      question_bank_id,
      prompt,
      prompt_es,
      question_type,
      difficulty,
      topic_tags,
      points,
      explanation,
      explanation_es,
      status,
      source,
      generation_key,
      generation_job_id,
      source_pdf_pages,
      segment_key,
      source_slide_numbers,
      source_slide_start,
      source_slide_end,
      checkpoint_after_slide
    ) values (
      question_bank.id,
      question_value ->> 'prompt',
      question_value ->> 'prompt_es',
      'single_choice',
      question_value ->> 'difficulty',
      array(select jsonb_array_elements_text(coalesce(question_value -> 'topic_tags', '[]'::jsonb))),
      1,
      nullif(question_value ->> 'explanation', ''),
      nullif(question_value ->> 'explanation_es', ''),
      'draft',
      'generated',
      generation_job.lecture_slug || '-gen-' || question_index,
      generation_job.id,
      array(select value::integer from jsonb_array_elements_text(question_value -> 'source_pdf_pages')),
      question_value ->> 'segment_key',
      case when generation_job.generation_mode = 'deck_and_bank'
        then array(select value::integer from jsonb_array_elements_text(question_value -> 'source_slide_numbers'))
        else '{}'::integer[] end,
      case when generation_job.generation_mode = 'deck_and_bank'
        then (question_value ->> 'source_slide_start')::integer else null end,
      case when generation_job.generation_mode = 'deck_and_bank'
        then (question_value ->> 'source_slide_end')::integer else null end,
      case when generation_job.generation_mode = 'deck_and_bank'
        then (question_value ->> 'checkpoint_after_slide')::integer else null end
    )
    returning id into inserted_question_id;

    option_index := 0;
    for option_value in
      select value from jsonb_array_elements(question_value -> 'options')
    loop
      insert into public.question_options (
        question_id,
        option_text,
        option_text_es,
        is_correct,
        position
      ) values (
        inserted_question_id,
        option_value ->> 'option_text',
        option_value ->> 'option_text_es',
        (option_value ->> 'is_correct')::boolean,
        option_index
      );
      option_index := option_index + 1;
    end loop;
  end loop;

  update public.content_uploads
     set status = 'done', updated_at = now()
   where id = generation_job.content_upload_id;

  update public.generation_jobs
     set content_item_id = case when generation_job.generation_mode = 'deck_and_bank'
          then content_item.id else null end,
         question_bank_id = question_bank.id,
         status = 'ready_for_review',
         error = null,
         attempt_count = 0,
         step_state = generation_job.step_state || jsonb_build_object(
           'assembled_at', now(),
           'deck_storage_path', case when generation_job.generation_mode = 'deck_and_bank'
             then p_staging_deck_path else null end
         ),
         updated_at = now()
   where id = generation_job.id;

  return jsonb_build_object(
    'content_item_id', case when generation_job.generation_mode = 'deck_and_bank'
      then content_item.id else null end,
    'question_bank_id', question_bank.id
  );
end;
$$;

revoke all on function public.finalize_pdf_generation_bundle(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_pdf_generation_bundle(uuid, text, jsonb, jsonb)
  to service_role;
