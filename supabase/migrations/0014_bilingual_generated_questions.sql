-- Bilingual, generated question banks.
--
-- Questions are produced from the course content of a specific class, never typed
-- by the instructor. The platform is bilingual, so a question carries both
-- languages; a student reading in Spanish must not hit an English stem.
--
-- Provenance matters because these are generated: we record what they were
-- generated from, so a regenerated deck can replace its own bank without touching
-- anything an instructor edited by hand.

alter table public.questions
  add column if not exists prompt_es text check (prompt_es is null or length(prompt_es) between 1 and 4000);
alter table public.questions
  add column if not exists explanation_es text check (explanation_es is null or length(explanation_es) <= 4000);
alter table public.questions
  add column if not exists source text not null default 'authored'
  check (source in ('authored', 'generated', 'generated_edited'));
-- Stable per-bank identifier for a generated question, so re-importing the same
-- bank updates rows instead of duplicating them.
alter table public.questions add column if not exists generation_key text;

alter table public.question_options
  add column if not exists option_text_es text check (option_text_es is null or length(option_text_es) between 1 and 2000);
alter table public.question_options
  add column if not exists feedback_es text check (feedback_es is null or length(feedback_es) <= 2000);

create unique index if not exists questions_bank_generation_key
  on public.questions (question_bank_id, generation_key) where generation_key is not null;
create index if not exists questions_bank_difficulty_idx
  on public.questions (question_bank_id, difficulty, status);

-- One generated bank per content item, so "the bank for week 2's lecture" is
-- unambiguous and regeneration is idempotent.
create unique index if not exists question_banks_content_generated
  on public.question_banks (course_id, content_item_id, bank_type)
  where content_item_id is not null;
