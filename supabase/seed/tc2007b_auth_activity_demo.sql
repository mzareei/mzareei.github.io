insert into public.activity_templates (content_item_id, activity_type, grading_mode, max_score, weight_category, instructions)
select item.id, 'quiz', 'correctness', 2, 'practice', 'Low-stakes authenticated Week 1 practice activity.'
from public.content_items item
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and not exists (
    select 1
    from public.activity_templates existing
    where existing.content_item_id = item.id
      and existing.activity_type = 'quiz'
  );

insert into public.activity_instances (
  activity_template_id,
  section_id,
  state,
  starts_at,
  ends_at,
  time_limit_seconds,
  randomization_policy,
  question_count
)
select template.id, section.id, 'open', now() - interval '1 day', now() + interval '30 days', 600, 'shuffle_questions_and_options', 2
from public.activity_templates template
join public.content_items item on item.id = template.content_item_id
join public.course_sections section on section.course_id = item.course_id
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and section.section_code in ('A', 'B')
  and not exists (
    select 1
    from public.activity_instances existing
    where existing.activity_template_id = template.id
      and existing.section_id = section.id
  );

insert into public.gradebook_categories (course_id, name, weight_percent, drop_lowest_count, status)
select 'tc2007b', 'Practice', 0, 0, 'active'
where not exists (
  select 1
  from public.gradebook_categories existing
  where existing.course_id = 'tc2007b'
    and existing.name = 'Practice'
);

insert into public.gradebook_items (course_id, category_id, activity_template_id, title, max_score, status)
select item.course_id, category.id, template.id, 'Week 1 Practice', template.max_score, 'published'
from public.activity_templates template
join public.content_items item on item.id = template.content_item_id
join public.gradebook_categories category on category.course_id = item.course_id
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and category.name = 'Practice'
  and not exists (
    select 1
    from public.gradebook_items existing
    where existing.activity_template_id = template.id
      and existing.title = 'Week 1 Practice'
  );

insert into public.question_banks (course_id, content_item_id, title, bank_type, status)
select item.course_id, item.id, 'Week 1 Authenticated Practice Bank', 'practice', 'active'
from public.content_items item
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and not exists (
    select 1
    from public.question_banks existing
    where existing.course_id = item.course_id
      and existing.content_item_id = item.id
      and existing.title = 'Week 1 Authenticated Practice Bank'
  );

insert into public.questions (question_bank_id, prompt, question_type, difficulty, topic_tags, points, explanation, status)
select bank.id, 'Which CIA property is most affected when a service is unreachable?', 'single_choice', 'easy', array['cia', 'availability'], 1, 'Availability is about being able to use the service when needed.', 'active'
from public.question_banks bank
join public.content_items item on item.id = bank.content_item_id
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and not exists (
    select 1 from public.questions existing
    where existing.question_bank_id = bank.id
      and existing.prompt = 'Which CIA property is most affected when a service is unreachable?'
  );

insert into public.questions (question_bank_id, prompt, question_type, difficulty, topic_tags, points, explanation, status)
select bank.id, 'What is the best description of phishing?', 'single_choice', 'easy', array['social-engineering', 'phishing'], 1, 'Phishing tricks a person into revealing information or taking an unsafe action.', 'active'
from public.question_banks bank
join public.content_items item on item.id = bank.content_item_id
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and not exists (
    select 1 from public.questions existing
    where existing.question_bank_id = bank.id
      and existing.prompt = 'What is the best description of phishing?'
  );

insert into public.question_options (question_id, option_text, is_correct, position)
select question.id, option.option_text, option.is_correct, option.position
from public.questions question
join public.question_banks bank on bank.id = question.question_bank_id
join public.content_items item on item.id = bank.content_item_id
cross join lateral (
  values
    ('Confidentiality', false, 1),
    ('Integrity', false, 2),
    ('Availability', true, 3),
    ('Non-repudiation', false, 4)
) as option(option_text, is_correct, position)
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and question.prompt = 'Which CIA property is most affected when a service is unreachable?'
  and not exists (
    select 1 from public.question_options existing
    where existing.question_id = question.id
      and existing.option_text = option.option_text
  );

insert into public.question_options (question_id, option_text, is_correct, position)
select question.id, option.option_text, option.is_correct, option.position
from public.questions question
join public.question_banks bank on bank.id = question.question_bank_id
join public.content_items item on item.id = bank.content_item_id
cross join lateral (
  values
    ('A backup strategy for databases', false, 1),
    ('A trick that pushes people to reveal information or take unsafe action', true, 2),
    ('A firewall rule that blocks all traffic', false, 3),
    ('A cryptographic hash collision', false, 4)
) as option(option_text, is_correct, position)
where item.course_id = 'tc2007b'
  and item.slug = 'week-01-mission-01'
  and question.prompt = 'What is the best description of phishing?'
  and not exists (
    select 1 from public.question_options existing
    where existing.question_id = question.id
      and existing.option_text = option.option_text
  );
