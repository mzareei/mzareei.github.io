// Signing in is the claim.
//
// A rostered student exists as a `profiles` row long before they ever sign in,
// with no `auth_user_id` and `status = 'invited'`. Linking that row to the auth
// account, and promoting it to `active`, is what turns an invitation into a
// usable identity — and every student endpoint requires the result.
//
// This lived inside course-auth-context, which meant the *only* way to become
// active was to load the course context first. A student who scanned the class
// QR code on their very first sign-in reached course-session-join before that
// ever ran and was refused, with a message about being in the wrong group. That
// was every student in the first real class. Any endpoint a student can arrive
// at before the app has loaded its context must claim through this.
import { assertCourseEmailAllowed, assertProfileMatchesAuthEmail } from "./identity.ts";

const PROFILE_COLUMNS =
  "id, auth_user_id, institutional_email, student_identifier, full_name, preferred_name, status";

export async function loadOrClaimProfile(
  // deno-lint-ignore no-explicit-any
  db: any,
  user: { id: string; email: string }
) {
  const { data: linkedProfile, error: linkedError } = await db
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (linkedError) throw linkedError;
  if (linkedProfile) {
    assertProfileMatchesAuthEmail(linkedProfile, user.email);
    // A profile can be linked but still 'invited' (e.g. a roster correction set the
    // status without touching the link). Signing in is the claim, so promote it —
    // otherwise student endpoints that require an active profile reject the account.
    if (linkedProfile.status === "invited") {
      const { data: activated, error: activateError } = await db
        .from("profiles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", linkedProfile.id)
        .eq("status", "invited")
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (activateError) throw activateError;
      if (activated) return { ...activated, claimed_by_email: false };
    }
    return { ...linkedProfile, claimed_by_email: false };
  }

  const email = String(user.email || "").trim().toLowerCase();
  await assertCourseEmailAllowed(db, email);
  if (!email) return null;

  const { data: rosterProfile, error: rosterError } = await db
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("institutional_email", email)
    .maybeSingle();
  if (rosterError) throw rosterError;
  if (!rosterProfile || !["invited", "active"].includes(rosterProfile.status)) return null;
  // Two guards, and both are load-bearing: this one refuses a profile another
  // auth account already holds, and `.is("auth_user_id", null)` on the update
  // below makes the claim itself lose a race rather than overwrite the winner.
  if (rosterProfile.auth_user_id && rosterProfile.auth_user_id !== user.id) return null;
  assertProfileMatchesAuthEmail(rosterProfile, email);

  const { data: claimedProfile, error: claimError } = await db
    .from("profiles")
    .update({
      auth_user_id: user.id,
      status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("id", rosterProfile.id)
    .is("auth_user_id", null)
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  if (claimError) throw claimError;
  return claimedProfile ? { ...claimedProfile, claimed_by_email: true } : null;
}
