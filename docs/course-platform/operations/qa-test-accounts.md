# QA Test Accounts

The course app normally accepts only institutional addresses (`tec.mx`, `itesm.mx`).
That guard makes it impossible for the teaching team to walk the student experience,
because every course staff address is already a teacher account.

A QA test account is a specific, fully-spelled email address outside the institutional
domains that is allowed to sign in anyway. It is an exact-address exception, never a
domain exception: adding `gmail.com` as an allowed domain would open the course to any
Gmail user, while a QA test account opens it to exactly one mailbox.

Test addresses are **never committed to this repository.** `platform-config.js` is served
publicly from the GitHub Pages site, and the repository itself is public, so an address
placed there is permanently public. Instead the address lives in two private places: a
Supabase secret on the server, and per-device browser storage on the machine doing the
testing.

## What a QA test account can and cannot do

A test account is only an exception to the *email domain* check. Everything else applies
unchanged:

- It still needs a roster profile and an active enrollment, exactly like a real student.
- It sees only what its section has been released.
- Its role comes from the roster row, so it can be a `student`, `teaching_assistant`, or
  `observer` like anyone else.
- Its work is stored under its own profile and appears in the gradebook and audit log.

That is the point: the test account experiences the platform exactly as a student does.

## Setting one up

### 1. Register the address server side

The trusted edge functions read the allowlist from the `COURSE_TEST_EMAILS` secret. It
takes one or more addresses separated by commas.

```bash
supabase secrets set COURSE_TEST_EMAILS="qa.address@example.com"
```

For more than one:

```bash
supabase secrets set COURSE_TEST_EMAILS="qa.one@example.com,qa.two@example.com"
```

Redeploy the functions that read it so they pick up the new secret:

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

Without this step the browser will send a sign-in email, but loading the course context
afterwards fails with `Institutional email domain is not approved for this course.`

### 2. Enrol the address in the roster

Open **Course App → Course Roster** and import a row for it, the same way as any student:

```csv
institutional_email,full_name,student_identifier,section_code,role
qa.address@example.com,QA Test Student,QA0000001,A,student
```

Registered test addresses bypass the *Allowed domains* field on that page, so leave the
field at `tec.mx, itesm.mx`. Preview the rows, then apply the accepted ones.

### 3. Unlock the sign-in form on the testing device

The browser refuses to send a sign-in email to a non-institutional address. Unlock the
device once by opening the app with the address in the query string:

```
https://mzareei.github.io/assets/course-materials/information-security/app/?test-access=qa.address@example.com
```

The app stores the address under the `tc2007b.test-access-emails` localStorage key, strips
the parameter from the URL, and prefills the sign-in box. The unlock is per browser
profile, so it does not affect students and does not follow the account to other devices.

This step only relaxes a client-side convenience check. It grants no access on its own —
an address that is not in `COURSE_TEST_EMAILS` and not on the roster is still rejected by
the server after sign-in.

### 4. Sign in and test

Send the sign-in email, open the link (or type the six digit code) and the account lands
in the student dashboard.

Use a separate browser profile, container tab, or private window for the test account.
Teacher and student sessions share the same Supabase storage keys per browser profile, so
signing in as the test student in the same window signs the teacher account out.

## Removing a test account

Three independent steps, in whichever order suits:

- Server: `supabase secrets unset COURSE_TEST_EMAILS` (or set it to the remaining
  addresses) and redeploy the functions listed above.
- Roster: set the profile's status to inactive from the roster page, so its enrollment and
  its work are retained but it can no longer participate.
- Device: run `localStorage.removeItem("tc2007b.test-access-emails")` in the browser
  console, or clear site data.

Removing the server secret is the one that actually revokes access.

## Where this is implemented

| Layer | File | Role |
| --- | --- | --- |
| Shared guard | `supabase/functions/_shared/identity.ts` | Reads `COURSE_TEST_EMAILS`, exempts listed addresses in `assertInstitutionalEmailAllowed` |
| Roster import | `supabase/functions/course-roster-management/index.ts` | Accepts listed addresses in roster rows and profile corrections |
| Browser helpers | `assets/course-materials/information-security/app/auth-api.js` | Per-device storage, `?test-access=` capture |
| Sign-in form | `assets/course-materials/information-security/app/app.js` | `isAllowedInstitutionalEmail` consults the test list first |
| Config | `assets/course-materials/information-security/platform-config.js` | `allowedTestEmails` (kept empty) and the storage key |

Verify the wiring with:

```bash
node tools/verify-auth-qa-test-accounts.js
```
