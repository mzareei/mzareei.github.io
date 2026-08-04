# Backend handoff

The complete product handoff lives in the frontend repository:
`course-platform/docs/PROJECT-HANDOFF.md`.

This repository contains the Supabase migrations and Edge Functions for the
TC2007B teaching platform. Supabase project ref: `ojmbupftdikwmlqvibwt`.

Current deployed backend commit: `4d3125b`.

Recently deployed:

- Migration `0028_class_presentation_state.sql`.
- Edge Function `course-presentation`.

Before changing or deleting production data, read the frontend handoff plus
`docs/superpowers/specs/2026-07-30-production-data-reset-design.md` and
`docs/superpowers/plans/2026-07-30-production-data-reset.md`. The historical
data reset is intentionally still pending and must be previewed with counts
before execution.

Functions deploy explicitly; Git push alone does not deploy them:

```bash
npx supabase db push --include-all --yes
npx supabase functions deploy <function-name> --project-ref ojmbupftdikwmlqvibwt
```
