# Deploying Edge Functions

Migrations run in the Supabase SQL editor. Edge Functions do not — they are code, and they
are pushed from your machine with the Supabase CLI. This page is the short version; the
full launch sequence is in `supabase-launch-checklist.md`.

## One-time setup

You need Node.js installed. Check with:

```powershell
node --version
```

Then, from the repository root:

```powershell
cd "C:\Users\L03082445\Claude\Projects\My Personal Page"
npx supabase login
```

That opens a browser to authorise the CLI. Then link the repository to the project:

```powershell
npx supabase link --project-ref ojmbupftdikwmlqvibwt
```

The project reference is the subdomain of the project URL in `platform-config.js`. Linking
is remembered, so you only do this once per machine.

## Deploying

```powershell
.\tools\deploy-course-functions.ps1
```

That deploys the functions that share the sign-in guard. Options:

```powershell
.\tools\deploy-course-functions.ps1 -All                          # every course function
.\tools\deploy-course-functions.ps1 -Only course-auth-context     # just one
```

Equivalent by hand, one line per function:

```powershell
npx supabase functions deploy course-auth-context
```

## When to redeploy

| You changed | Redeploy |
| --- | --- |
| One function's `index.ts` | That function |
| `supabase/functions/_shared/*` | Every function that imports it — the script's default set |
| A secret (`supabase secrets set …`) | Every function that reads it |
| Only SQL, HTML, CSS, or JS under `assets/` | Nothing — those are not Edge Functions |

Deploy the shared-guard set together. A function still running older code will not
recognise external access grants, so a guest account would sign in and then fail on the
next request, which is a confusing state to debug.

## If something goes wrong

**`npx: command not found`** — Node.js is not installed or not on PATH. Install the LTS
build from nodejs.org and reopen PowerShell.

**`Access to the path … is denied` or a script-execution error** — PowerShell is blocking
local scripts. Either run the `npx supabase functions deploy` lines by hand, or allow
local scripts for the current session only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**A Docker error** — some CLI versions bundle functions locally. Either start Docker
Desktop, or ask the CLI to bundle server-side:

```powershell
npx supabase functions deploy course-auth-context --use-api
```

**`Project not linked`** — run the `link` command above.

## Confirming it worked

In the Supabase dashboard, open **Edge Functions**. Each deployed function shows a fresh
"Last deployed" timestamp.

Then test in the app: sign in with an institutional address to confirm nothing broke, and
add a person from **Course Roster → Add one person** using an address outside the approved
domains. If that address can sign in and reach the student dashboard, the new guard is
live everywhere.

If the sign-in email sends but loading the course context then fails with
`Institutional email domain is not approved for this course.`, at least one function is
still on the old code — redeploy the full set.
