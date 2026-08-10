-- Informal, professor-authored hints carried from an imported JSON file's
-- covers_up_to_slide/topic. Deliberately separate from segment_key /
-- source_slide_start/end / checkpoint_after_slide, which stay reserved for
-- checkpoints verified against a real platform-generated deck. These two
-- columns are never validated against any deck — they exist so a Class
-- Question Plan can auto-build its checkpoints from a bank that has no deck
-- at all.
alter table public.questions
  add column if not exists suggested_slide_hint integer
    check (suggested_slide_hint is null or suggested_slide_hint >= 1),
  add column if not exists suggested_topic text
    check (suggested_topic is null or length(trim(suggested_topic)) <= 160);
