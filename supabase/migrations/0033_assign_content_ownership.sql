-- D3 — assign every existing TC2007B content item to the platform owner.
--
-- Approved by the professor on 2026-08-05: "all existing ones are mine".
--
-- This is a data migration, and it is the only production write in the
-- ownership work. Migration 0032 deliberately left it out so the schema change
-- and the data change stay separate entries in the ledger and can be reviewed,
-- applied, and reasoned about independently.
--
-- Confirmed from production on 2026-08-06 (audit queries 1-5):
--   * 27 content items in tc2007b
--   * created_by is null on all 27 — register_item never set it, so there is
--     no author data to recover and ownership has to be asserted
--   * 0 items are released to students, so this changes nothing anyone can see
--
-- What this migration will NOT do:
--   * guess. If there is not exactly one active platform owner it aborts.
--   * touch created_by. "Who owns this now" and "who created this" are
--     different questions; the second has no answer in the data, and writing
--     one would be fabricating history to make a column look populated.
--   * reassign an item that already has an owner. Re-running is safe even
--     after a lecture has been deliberately handed to another professor.
--   * touch question banks, questions, releases, sessions or profiles.

do $$
declare
  owner_count integer;
  owner_profile uuid;
  unowned_before integer;
  assigned_count integer;
  unowned_after integer;
begin
  -- Precondition: exactly one active platform owner. Zero means the migration
  -- has nothing meaningful to assign; more than one means picking a winner,
  -- which would silently hand the entire course library to an arbitrary
  -- account. Refuse both.
  select count(*), min(p.id)
    into owner_count, owner_profile
    from public.course_memberships cm
    join public.profiles p on p.id = cm.profile_id
   where cm.course_id = 'tc2007b'
     and cm.role = 'platform_owner'
     and cm.status = 'active'
     and p.status = 'active';

  if owner_count <> 1 then
    raise exception
      'Expected exactly one active platform owner for tc2007b, found %. Refusing to guess an owner for the course library.',
      owner_count;
  end if;

  select count(*)
    into unowned_before
    from public.content_items
   where course_id = 'tc2007b'
     and owner_profile_id is null;

  -- Only fill what is empty. An item whose owner was deliberately set later
  -- must survive a re-run of this migration untouched.
  update public.content_items
     set owner_profile_id = owner_profile,
         updated_at = now()
   where course_id = 'tc2007b'
     and owner_profile_id is null;
  get diagnostics assigned_count = row_count;

  -- Postcondition: nothing in this course is left unowned. If any row survived
  -- the update, the filter and the assertion disagree and the whole
  -- transaction should roll back rather than leave a half-owned library.
  select count(*)
    into unowned_after
    from public.content_items
   where course_id = 'tc2007b'
     and owner_profile_id is null;

  if unowned_after <> 0 then
    raise exception
      'Ownership backfill left % tc2007b content item(s) unowned.', unowned_after;
  end if;

  if assigned_count <> unowned_before then
    raise exception
      'Ownership backfill assigned % item(s) but % were unowned.',
      assigned_count, unowned_before;
  end if;

  insert into public.audit_log (
    course_id, actor_profile_id, target_type, target_id, action, metadata
  )
  values (
    'tc2007b',
    owner_profile,
    'content_item',
    null,
    'content_ownership_backfilled',
    jsonb_build_object(
      'assigned', assigned_count,
      'unowned_before', unowned_before,
      'owner_profile_id', owner_profile,
      'migration', '0033_assign_content_ownership'
    )
  );

  raise notice 'Assigned % tc2007b content item(s) to profile %.', assigned_count, owner_profile;
end;
$$;
