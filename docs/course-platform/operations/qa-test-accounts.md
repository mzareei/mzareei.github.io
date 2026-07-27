# External Access And QA Test Accounts

The course app normally accepts only institutional addresses (`tec.mx`, `itesm.mx`). That
is right for students, but it blocks two legitimate cases:

- **QA testing.** Every course staff address is already a teacher account, so there is no
  way to walk the student experience without a second address.
- **Guests.** A visiting professor, an external collaborator, or an industry reviewer may
  not hold an institutional address at all.

An **external access grant** is an exact-address exception to the domain check, recorded
by an instructor from the roster panel. It is an address exception, never a domain
exception: allowing `gmail.com` would open the course to any Gmail user, while a grant
opens it to exactly one mailbox.

## What a grant does and does not do

A grant only opens the sign-in door. Everything else is unchanged:

- The address still needs a roster profile and an active enrollment.
- It sees only what its section has been released.
- Its role comes from the roster row: `student`, `teaching_assistant`, `instructor`, or
  `observer`.
- Its work is stored under its own profile and appears in the gradebook and audit log.

That is what makes a QA test account useful — it experiences the platform exactly as a
student does.

## Adding someone from the panel

**Course App → Course Roster → Add one person.**

1. Enter the email, full name, and optional student or staff ID.
2. Pick a section and a role.
3. For an institutional address, press **Add person** and you are done.
4. For an address outside the approved domains, a **reason** field appears. Fill it in and
   press **Add person** again. The reason is stored as the access grant and written to the
   audit log alongside who approved it.

This is the normal path for adding a guest professor: enter their address, choose
`instructor`, and give the reason.

Grants appear in the **External access** table below the form, with a **Revoke** button.
Revoking asks for a reason, records it, and blocks that address at the next request. It
deliberately leaves the roster profile and the person's work in place — remove course
access by setting the profile inactive, which is a separate, reversible step.

## Setting up a QA test account

Same flow, with two extra habits:

- Give the test account an obviously non-personal name (`QA Test Student`) and a
  recognisable ID, so it is easy to spot and exclude when reading the gradebook.
- Use a separate browser profile, container tab, or private window for it. Teacher and
  student sessions share the same Supabase storage keys per browser profile, so signing in
  as the test student in your normal window signs your teacher account out.

## The COURSE_TEST_EMAILS fallback

There is also a server-side allowlist read from the `COURSE_TEST_EMAILS` secret. It exists
for the bootstrap case — before any instructor account exists to record a grant — and for
recovering access if the panel itself is broken.

```bash
supabase secrets set COURSE_TEST_EMAILS="qa.address@example.com"
```

Multiple addresses are comma separated. Changing the secret requires redeploying the
functions that read it (see `deploying-edge-functions.md`, or run
`.\tools\deploy-course-functions.ps1`):

```bash
supabase functions deploy course-auth-context
supabase functions deploy course-content-access
supabase functions deploy course-activity-attempt
supabase functions deploy course-exit-ticket
supabase functions deploy course-portfolio-entry
supabase functions deploy course-student-progress
supabase functions deploy course-identity-confirmation
supabase functions deploy course-roster-management
```

Prefer panel grants for day-to-day work: they are audited, revocable in one click, and
need no redeploy.

## Addresses are never committed

`platform-config.js` is served publicly from the GitHub Pages site, and this repository is
public, so an address placed in either is permanently public. Grants live in the database
and the fallback list lives in a secret. `allowedTestEmails` in `platform-config.js` ships
empty and `tools/verify-auth-qa-test-accounts.js` fails the build if a personal mailbox
address is ever committed to the public sources.

The browser also keeps a per-device unlock so the sign-in form will accept a
non-institutional address before the server has been asked. Open the app once as
`…/app/?test-access=<email>`; the address is stored under the `tc2007b.test-access-emails`
localStorage key and the parameter is stripped from the URL. Clear it with
`localStorage.removeItem("tc2007b.test-access-emails")`.

This is a convenience check only and grants no access on its own. The server is the real
gate, and it fails closed — an address with no grant and no secret entry is rejected even
if the browser lets the form submit.

## Removing access

| Goal | Action |
| --- | --- |
| Block an address at sign-in | Revoke its grant in the External access table |
| Remove someone from the course but keep their work | Set the roster profile inactive |
| Retire a bootstrap address | Update `COURSE_TEST_EMAILS` and redeploy |
| Tidy a testing device | `localStorage.removeItem("tc2007b.test-access-emails")` |

Revoking the grant is what actually revokes access.

## Where this is implemented

| Layer | File | Role |
| --- | --- | --- |
| Schema | `supabase/migrations/0011_external_access_grants.sql` | `external_access_grants` table |
| Shared guard | `supabase/functions/_shared/identity.ts` | `assertCourseEmailAllowed`: domain, then secret, then grant |
| Roster function | `supabase/functions/course-roster-management/index.ts` | `add_person`, grant/revoke actions, audit entries |
| Panel | `assets/course-materials/information-security/app/roster.html` / `roster.js` | Add-one-person form and External access table |
| Browser helpers | `assets/course-materials/information-security/app/auth-api.js` | Per-device unlock, `?test-access=` capture |
| Config | `assets/course-materials/information-security/platform-config.js` | `allowedTestEmails` (kept empty) and the storage key |

Verify the wiring with:

```bash
node tools/verify-auth-qa-test-accounts.js
```
