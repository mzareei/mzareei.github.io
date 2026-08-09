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
