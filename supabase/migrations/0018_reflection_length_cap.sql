-- The reflection's real bound is 50-100 words, enforced server-side in
-- course-exit-ticket. The original one_thing check (length between 1 and 500
-- characters) predates that and is tighter than a genuine 100-word paragraph
-- needs — average English word length alone puts 100 words past 500
-- characters, so legitimate submissions were being rejected by the database
-- after passing the app's own word-count validation. Raise the character cap
-- to a generous backstop instead of a real limit.

alter table public.exit_tickets drop constraint exit_tickets_one_thing_check;
alter table public.exit_tickets add constraint exit_tickets_one_thing_check
  check (length(one_thing) between 1 and 1500);
