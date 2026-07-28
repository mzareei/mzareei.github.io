-- The partial unique index from 0014 cannot be used as an ON CONFLICT target by
-- PostgREST/Supabase upserts (they infer a plain column-list conflict, which
-- Postgres only matches against a full index, not a partial one). Replace it
-- with a plain unique constraint scoped to rows that actually have a content
-- item — which is every generated bank.

drop index if exists public.question_banks_content_generated;

alter table public.question_banks
  add constraint question_banks_content_generated_key
  unique (course_id, content_item_id, bank_type);
