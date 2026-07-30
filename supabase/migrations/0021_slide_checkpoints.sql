alter table questions
  add column if not exists segment_key text,
  add column if not exists source_slide_numbers integer[] not null default '{}',
  add column if not exists source_slide_start integer,
  add column if not exists source_slide_end integer,
  add column if not exists checkpoint_after_slide integer;

alter table questions
  add constraint questions_slide_range_check
  check (
    (source_slide_start is null and source_slide_end is null and checkpoint_after_slide is null)
    or (
      source_slide_start >= 1
      and source_slide_end >= source_slide_start
      and checkpoint_after_slide >= source_slide_end
    )
  );

create index if not exists questions_checkpoint_idx
  on questions(question_bank_id, checkpoint_after_slide)
  where checkpoint_after_slide is not null and status = 'active';
