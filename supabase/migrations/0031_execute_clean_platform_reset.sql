-- One-shot production finalization for the guarded TC2007B reset.
--
-- This migration is intentionally separate from 0030 so the preview can be
-- reviewed before the destructive transaction is applied. The function
-- validates retained-asset fingerprints and post-reset zero-row invariants,
-- then is removed so it cannot be called again accidentally.
do $$
declare reset_result jsonb;
begin
  select public.clean_tc2007b_platform(true) into reset_result;
  raise notice 'TC2007B clean reset complete: %', reset_result;
end
$$;

drop function public.clean_tc2007b_platform(boolean);
