-- Content ownership, sharing-by-copy, publish version history, and a guard
-- against deleting a content item that still owns an active question bank.
--
-- Additive only. Nothing here deletes, truncates, or rewrites existing rows.
-- In particular it does NOT assign ownership to the existing TC2007B items —
-- that backfill is a separate, separately approved step, kept out of this
-- migration so the two are distinguishable in the migration ledger and so
-- this file can be applied without changing what anyone can currently see.
--
-- Until that backfill runs, owner_profile_id is null on every existing item.
-- Every consumer must therefore treat a null owner as "unowned legacy
-- content, visible to course instructors as before". Deploying an owner
-- filter that hides null-owner items before the backfill would empty the
-- professor's own Content screen.

-- ---------------------------------------------------------------- ownership
alter table public.content_items
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists visibility text not null default 'owner_private',
  add column if not exists forked_from_content_item_id uuid references public.content_items(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'content_items_visibility_check'
       and conrelid = 'public.content_items'::regclass
  ) then
    alter table public.content_items
      add constraint content_items_visibility_check
      check (visibility in ('owner_private', 'course_shared'));
  end if;
end;
$$;

create index if not exists content_items_owner_idx
  on public.content_items(course_id, owner_profile_id);

-- ------------------------------------------------------------------ sharing
-- A share makes an item visible to the instructors of one group. It never
-- grants edit: a receiving instructor takes a copy, which becomes a new item
-- they own (forked_from_content_item_id records the provenance). The owner's
-- later improvements deliberately do not propagate to copies.
create table if not exists public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  section_id uuid not null references public.course_sections(id) on delete cascade,
  can_release boolean not null default true,
  can_copy boolean not null default true,
  shared_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_item_id, section_id)
);

create index if not exists content_shares_section_idx
  on public.content_shares(section_id);

-- ----------------------------------------------------------------- versions
-- Publishing overwrites the live object at a stable path, because
-- content_items.source_ref points at it and the gated chain resolves it.
-- The previous bytes are copied into a .versions/ sibling first, and this
-- table is the index of those copies. Rollback is "publish version n-1",
-- which runs the same validation gates — there is no separate rollback path.
create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  version int not null check (version >= 1),
  storage_path text not null check (length(storage_path) between 1 and 500),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  content_bytes bigint check (content_bytes is null or content_bytes >= 0),
  published_by uuid references public.profiles(id) on delete set null,
  published_from text not null default 'cli'
    check (published_from in ('cli', 'github_action', 'generation')),
  source_commit text check (source_commit is null or length(source_commit) <= 80),
  note text check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (content_item_id, version)
);

create index if not exists content_versions_item_idx
  on public.content_versions(content_item_id, version desc);

-- ------------------------------------------------------------- delete guard
-- question_banks.content_item_id is `on delete set null`. Deleting a content
-- item therefore succeeds quietly and orphans its bank and every question in
-- it. Nothing in the application deletes content items, but a hand-written
-- statement would, so refuse it at the table.
--
-- Archive the bank first if an item genuinely has to go.
create or replace function public.guard_content_item_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_bank_count integer;
begin
  select count(*)
    into active_bank_count
    from public.question_banks
   where content_item_id = old.id
     and status = 'active';

  if active_bank_count > 0 then
    raise exception
      'Content item % still has % active question bank(s). Archive them before deleting it.',
      old.id, active_bank_count
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists guard_content_item_delete_trigger on public.content_items;
create trigger guard_content_item_delete_trigger
  before delete on public.content_items
  for each row execute function public.guard_content_item_delete();

revoke all on function public.guard_content_item_delete() from public, anon, authenticated;
