-- Reported 2026-08-11: a student's Review screen showed the same lecture
-- (Week 1 Lecture 1, section 401) three times, and the live end-of-class quiz
-- refused every attempt with "Activity is not allowed for this section" even
-- though the class was genuinely live (that half is fixed separately in
-- course-activity-attempt's resolveAttemptRelease, deployed alongside this
-- migration).
--
-- Root cause of the triple: close_class_session_with_review's reuse lookup
-- and its insert's ON CONFLICT target both keyed on
-- (content_item_id, section_id, class_session_id) — the same three columns
-- as the content_releases_content_section_session_key constraint (0024).
-- Every session that closes with a lecture attached has its own, never-
-- before-seen class_session_id, so the "on conflict ... do update" can only
-- ever help a genuine retry of closing that exact same session again
-- (already handled earlier by this function's own idempotent-close check).
-- Any other session closing against the same lecture in the same section —
-- including a QA rehearsal one class-day apart, which is exactly what
-- happened here on 2026-08-07, 2026-08-09 and 2026-08-11 — always inserts a
-- brand new row instead of reusing the one already there. Nothing merges
-- them back: loadVisibleReleases (course-auth-context) lists every visible
-- release with no de-dup by content item, so the student sees one card per
-- row. course-release-management's own create_release already documents the
-- intended model directly in its comment — "Reuse a release with the same
-- scope rather than accumulating rows — an item showing two releases for the
-- same audience is unreadable" — and moveReleasesToContinuation already
-- reassigns class_session_id on an existing row rather than minting a new
-- one. close_class_session_with_review's scope key was just narrower than
-- that model: class_session_id described *who last touched it*, not part of
-- *what audience it's for*, and section_id already answers the audience
-- question on its own.
--
-- Fix: reuse by (content_item_id, section_id) only — section_id compared
-- with IS NOT DISTINCT FROM so a whole-course release (section_id null)
-- still matches itself — and let class_session_id follow the closing
-- session on that one row. Implemented as an explicit locked
-- select-then-branch instead of ON CONFLICT, since ON CONFLICT needs a real
-- unique constraint/index on exactly those columns (pitfall #6) and the
-- existing triple-column constraint is left untouched — other writers
-- (course-release-management, course-generation) already reuse correctly
-- within their own single, currently-exercised scope and are out of scope
-- for this fix.
--
-- Known, accepted gap: two DIFFERENT sessions closing against the same
-- lecture+section at the literal same instant could still race past the
-- locked select and both insert (the old triple-key constraint never
-- prevented this either, since their class_session_id would differ). Not
-- reachable in real use — a section runs one live class at a time — and not
-- worth a partial-unique-index/two-statement-ON-CONFLICT split for a race
-- that was never actually guarded against.

-- One-time consolidation of the duplicates this already produced: keep the
-- most recently updated row per (content_item_id, section_id) and drop the
-- rest. release_events.content_release_id is ON DELETE CASCADE (0004), so
-- their audit trail is removed with them — it describes a row a student can
-- no longer see, not real class activity.
with ranked as (
  select id,
         row_number() over (
           partition by content_item_id, section_id
           order by updated_at desc, created_at desc
         ) as rn
  from public.content_releases
)
delete from public.content_releases
where id in (select id from ranked where rn > 1);

create or replace function public.close_class_session_with_review(
  p_session_id uuid,
  p_course_id text,
  p_actor_profile_id uuid,
  p_reason text
)
returns public.class_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_session public.class_sessions%rowtype;
  previous_session_state text;
  previous_release_state text;
  review_release_id uuid;
  event_type text;
  normalized_reason text;
begin
  select *
    into locked_session
    from public.class_sessions
    where id = p_session_id
      and course_id = p_course_id
    for update;

  if not found then
    raise exception 'Class session not found.';
  end if;

  -- The close, review release, release event, and audit record were committed
  -- together. A retry only needs the existing session so the edge function can
  -- finish closing pulse/activity rows after an earlier cleanup failure.
  if locked_session.state = 'closed' then
    return locked_session;
  end if;

  if locked_session.state not in ('live', 'paused') then
    raise exception 'Transition from % to closed is not allowed.', locked_session.state;
  end if;

  previous_session_state := locked_session.state;
  normalized_reason := left(nullif(btrim(coalesce(p_reason, '')), ''), 1000);

  if locked_session.content_item_id is null then
    update public.class_sessions
      set state = 'closed',
          actual_end_at = now(),
          updated_at = now()
      where id = locked_session.id
      returning * into locked_session;

    insert into public.audit_log (
      course_id,
      actor_profile_id,
      target_type,
      target_id,
      action,
      metadata
    )
    values (
      locked_session.course_id,
      p_actor_profile_id,
      'class_session',
      locked_session.id,
      'session_closed_without_content',
      jsonb_build_object(
        'old_state', previous_session_state,
        'new_state', 'closed',
        'reason', normalized_reason
      )
    );

    return locked_session;
  end if;

  select id, state
    into review_release_id, previous_release_state
    from public.content_releases
    where content_item_id = locked_session.content_item_id
      and section_id is not distinct from locked_session.section_id
    for update;

  update public.class_sessions
    set state = 'closed',
        actual_end_at = now(),
        updated_at = now()
    where id = locked_session.id
    returning * into locked_session;

  if review_release_id is not null then
    update public.content_releases
      set state = 'review_only',
          class_session_id = locked_session.id,
          opens_at = now(),
          closes_at = null,
          review_opens_at = now(),
          review_closes_at = null,
          updated_by = p_actor_profile_id,
          updated_at = now()
      where id = review_release_id;
  else
    insert into public.content_releases (
      content_item_id,
      course_id,
      section_id,
      class_session_id,
      state,
      opens_at,
      closes_at,
      review_opens_at,
      review_closes_at,
      created_by,
      updated_by,
      updated_at
    )
    values (
      locked_session.content_item_id,
      locked_session.course_id,
      locked_session.section_id,
      locked_session.id,
      'review_only',
      now(),
      null,
      now(),
      null,
      p_actor_profile_id,
      p_actor_profile_id,
      now()
    )
    returning id into review_release_id;
  end if;

  event_type := case
    when previous_release_state is null then 'created'
    else 'reopened'
  end;

  insert into public.release_events (
    content_release_id,
    actor_profile_id,
    event_type,
    old_state,
    new_state,
    reason
  )
  values (
    review_release_id,
    p_actor_profile_id,
    event_type,
    previous_release_state,
    'review_only',
    normalized_reason
  );

  insert into public.audit_log (
    course_id,
    actor_profile_id,
    target_type,
    target_id,
    action,
    metadata
  )
  values (
    locked_session.course_id,
    p_actor_profile_id,
    'class_session',
    locked_session.id,
    'session_closed_with_review',
    jsonb_build_object(
      'old_state', previous_session_state,
      'new_state', 'closed',
      'reason', normalized_reason,
      'review_release_id', review_release_id,
      'review_release_old_state', previous_release_state,
      'section_id', locked_session.section_id
    )
  );

  return locked_session;
end;
$$;

revoke all on function public.close_class_session_with_review(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.close_class_session_with_review(uuid, text, uuid, text)
  to service_role;
