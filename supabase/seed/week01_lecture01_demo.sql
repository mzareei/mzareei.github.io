insert into public.quiz_courses (id, title)
values ('tc2007b', 'Security in Applications and Networks')
on conflict (id) do update set title = excluded.title;

insert into public.quiz_lectures (id, course_id, title, week_number, lecture_number)
values ('tc2007b-w1-l1', 'tc2007b', 'Introduction to Cybersecurity', 1, 1)
on conflict (id) do update set title = excluded.title;

do $$
declare
  qid uuid;
begin
  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'Which three goals make up the CIA triad?', 'easy', array['cia'], 'The CIA triad is confidentiality, integrity, and availability.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Confidentiality, integrity, availability', true, 1),
    (qid, 'Control, identity, authorization', false, 2),
    (qid, 'Cryptography, isolation, auditing', false, 3),
    (qid, 'Compliance, inspection, access', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'A denial-of-service attack primarily violates which requirement?', 'easy', array['cia','availability'], 'DoS attacks try to make a system unusable, so they target availability.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Integrity', false, 1),
    (qid, 'Availability', true, 2),
    (qid, 'Confidentiality', false, 3),
    (qid, 'Accountability', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'An unauthorized change to a bank balance is mainly an attack on what?', 'easy', array['cia','integrity'], 'Integrity is about guarding against unauthorized or incorrect changes.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Availability', false, 1),
    (qid, 'Confidentiality', false, 2),
    (qid, 'Integrity', true, 3),
    (qid, 'Authentication', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'A leaked password file is mainly a failure of what?', 'easy', array['cia','confidentiality'], 'Confidentiality fails when secrets are disclosed to unauthorized people.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Confidentiality', true, 1),
    (qid, 'Availability', false, 2),
    (qid, 'Integrity', false, 3),
    (qid, 'Non-repudiation', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'The lecture frames a security problem as the combination of which two ideas?', 'medium', array['risk'], 'A security problem exists when something valuable faces a meaningful risk.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Policy and mechanism', false, 1),
    (qid, 'Value and risk', true, 2),
    (qid, 'Privacy and law', false, 3),
    (qid, 'Hardware and software', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'What does phishing usually try to make the victim do?', 'easy', array['attacks'], 'Phishing tricks a person into revealing sensitive information or taking a harmful action.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Increase system availability', false, 1),
    (qid, 'Give up sensitive information', true, 2),
    (qid, 'Patch a vulnerability', false, 3),
    (qid, 'Encrypt a database', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'Spoofing is best described as what?', 'easy', array['attacks'], 'Spoofing disguises identity, source, or origin.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Disguising the source or identity', true, 1),
    (qid, 'Repairing damaged data', false, 2),
    (qid, 'Blocking all network traffic', false, 3),
    (qid, 'Measuring password strength', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'Least privilege means giving a user or component what level of access?', 'medium', array['design'], 'Least privilege grants only the access required to do the job.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Administrator access by default', false, 1),
    (qid, 'Only the access it needs', true, 2),
    (qid, 'Temporary access to everything', false, 3),
    (qid, 'Access based on seniority', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'Open design says security should not depend on what?', 'medium', array['design'], 'Open design says the system should remain secure even if the design is known.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'The attacker being slow', false, 1),
    (qid, 'The design remaining secret', true, 2),
    (qid, 'Users choosing strong passwords', false, 3),
    (qid, 'Backups being available', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'Which sequence matches the defense lifecycle from the lecture?', 'medium', array['defense'], 'The lecture sequence is prevention, detection, response, and recovery.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'Detect, prevent, recover, respond', false, 1),
    (qid, 'Prevent, detect, respond, recover', true, 2),
    (qid, 'Recover, detect, prevent, respond', false, 3),
    (qid, 'Respond, prevent, recover, detect', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'In security design, policy is the what. What is mechanism?', 'medium', array['design'], 'Mechanism is the technical how: the way a policy is enforced.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'The budget', false, 1),
    (qid, 'The course rule', false, 2),
    (qid, 'The technical how', true, 3),
    (qid, 'The attacker motive', false, 4);

  insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
  values ('tc2007b-w1-l1', 'Why does the lecture say we balance CIA rather than maximize all three?', 'medium', array['cia','tradeoffs'], 'Improving one CIA property can sometimes hurt another, so security is a balancing act.')
  returning id into qid;
  insert into public.quiz_options (question_id, option_text, is_correct, position) values
    (qid, 'They can pull against each other', true, 1),
    (qid, 'They are legally optional', false, 2),
    (qid, 'Only confidentiality matters', false, 3),
    (qid, 'They are the same property', false, 4);
end $$;
