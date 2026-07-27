-- Storage-backed course content.
-- Lecture decks and missions move out of the public repository into the private
-- 'course-content' bucket. A content item points at its object with
-- source_kind = 'storage_object' and source_ref = the bucket-relative path,
-- e.g. 'courses/tc2007b/items/<slug>/deck.html'. The browser never reads the
-- bucket directly: course-content-access checks the release gate, then mints a
-- short-lived signed URL.

alter table public.content_items drop constraint if exists content_items_source_kind_check;
alter table public.content_items add constraint content_items_source_kind_check
  check (source_kind in ('static_path', 'supabase_record', 'external_url', 'storage_object'));

-- Private bucket. Storage RLS follows the platform's zero-policy stance: no
-- policies are added, so anon/authenticated get nothing and only service-role
-- code (edge functions) can read or write objects.
insert into storage.buckets (id, name, public)
values ('course-content', 'course-content', false)
on conflict (id) do nothing;
