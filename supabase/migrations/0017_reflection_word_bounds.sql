-- Simplify the exit ticket into the single reflection paragraph the professor
-- asked for: 50-100 words on what was learned that class. The old
-- multi-field ticket (confidence slider, muddy point, next action) is no
-- longer collected from students; the columns stay for existing rows and for
-- any future use, but muddy_point and next_action are no longer required, and
-- confidence gets a bookkeeping default instead of a UI control.

alter table public.exit_tickets alter column muddy_point drop not null;
alter table public.exit_tickets alter column next_action drop not null;
alter table public.exit_tickets alter column confidence set default 3;
