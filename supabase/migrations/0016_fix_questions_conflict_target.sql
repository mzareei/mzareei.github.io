-- Same issue as 0015: a partial unique index cannot be an ON CONFLICT target
-- for a plain-column upsert. generation_key is only ever set on generated
-- questions, and a plain unique constraint still permits unlimited NULLs
-- (authored questions), so this is a safe, strict replacement.

drop index if exists public.questions_bank_generation_key;

alter table public.questions
  add constraint questions_bank_generation_key_key
  unique (question_bank_id, generation_key);
