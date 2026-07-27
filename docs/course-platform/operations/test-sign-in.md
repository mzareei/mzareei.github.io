# Test Sign-In (Verification Disabled)

Supabase's built-in email service is rate limited to a handful of messages per hour. That
is fine for a class of students signing in once, but it makes testing impossible: a few
sign-in attempts exhaust the quota and the rest silently fail.

Test sign-in solves that for the testing period. With it on, a rostered address signs in by
pressing a button — no email, no code, no waiting.

## Read this before enabling

**While test sign-in is on, anyone who knows a rostered email address can sign in as that
person.** There is no proof of mailbox ownership. The course app is publicly reachable, so
this is a real exposure, not a theoretical one.

It is a testing mode, not a login method. Do not enable it during a graded activity, and
turn it off before the semester starts.

Four rails limit the damage:

1. **It expires by itself.** The mode is off unless `COURSE_TEST_SIGNIN_UNTIL` names a
   future date, so forgetting to disable it is not enough to leave it on.
2. **Roster only.** The address must already have a profile and an active course
   membership. It cannot be used to self-register.
3. **No instructor accounts.** `instructor` and `platform_owner` are refused, so the
   accounts that can change releases and grades always need a real verification email.
4. **Audited.** Every issued session is written to `audit_log` as `test_signin_issued`,
   with the address, its roles, and the expiry that was in force.

## Enabling

Pick the last day you want it to work, then set the secret and deploy:

```powershell
npx supabase secrets set COURSE_TEST_SIGNIN_UNTIL="2026-08-31"
npx supabase functions deploy course-test-signin
```

A bare date means end of that day, UTC. A full timestamp (`2026-08-31T18:00:00Z`) works
too. Keep the window short — extending it later is one command.

The button also needs `testSignIn: true` in
`assets/course-materials/information-security/platform-config.js`. It ships enabled during
this testing period. That flag only shows the button; the server decides whether it works.

## Using it

1. Add the person on **Course Roster → Add one person** as usual.
2. Open the Course App, type their address into the email box.
3. Press **Sign in without email (testing)**.

You are signed in as that person immediately. Use a private window or a separate browser
profile, or you will sign your own teacher account out.

The roster is still what grants access. An address that is not rostered is refused, with a
message saying so.

## Disabling — do this before launch

Two independent switches. Do both:

```powershell
npx supabase secrets unset COURSE_TEST_SIGNIN_UNTIL
npx supabase functions deploy course-test-signin
```

Then set `testSignIn: false` in `platform-config.js`, commit, and push, so the button
disappears from the page.

Either one alone stops sign-ins working. Doing both also removes the affordance and the
warning banner, which is what you want on a page students will see.

To confirm nothing is left behind, check who used it:

```sql
select created_at, metadata ->> 'email' as email, metadata ->> 'roles' as roles
from public.audit_log
where action = 'test_signin_issued'
order by created_at desc;
```

## How it works

The function never bypasses Supabase Auth. It uses the admin API to generate a one-time
token for the address — `generateLink` creates the token without sending mail — and returns
it to the browser, which redeems it through the normal `verifyOtp` path. The result is an
ordinary Supabase session, so every downstream function, guard, and policy behaves exactly
as it does for an emailed sign-in. The only step removed is the proof that the person can
read the mailbox.

| Layer | File |
| --- | --- |
| Function | `supabase/functions/course-test-signin/index.ts` |
| Browser call | `assets/course-materials/information-security/app/auth-api.js` (`testSignIn`) |
| Button and banner | `app/index.html`, `app/app.js`, `app/app.css` |
| Flag | `platform-config.js` (`testSignIn`) |

Verify the wiring with:

```bash
node tools/verify-auth-test-sign-in.js
```
