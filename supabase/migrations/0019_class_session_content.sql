alter table class_sessions
  add column if not exists content_item_id uuid
  references content_items(id) on delete set null;

create index if not exists class_sessions_content_item_idx
  on class_sessions(content_item_id);
