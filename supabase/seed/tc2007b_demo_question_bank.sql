-- TC2007B demo question bank for all active lecture quizzes.
-- Run after migrations/0001_quiz_pilot.sql. This seed is idempotent by lecture prompt.
-- It inserts only questions that do not already exist, so it is safe to re-run for setup.

insert into public.quiz_courses (id, title)
values ('tc2007b', 'Security in Applications and Networks')
on conflict (id) do update set title = excluded.title;

insert into public.quiz_lectures (id, course_id, title, week_number, lecture_number)
values
  ('tc2007b-w1-l1', 'tc2007b', 'Introduction to Cybersecurity', 1, 1),
  ('tc2007b-w1-l2', 'tc2007b', 'Legal and Ethical Aspects', 1, 2),
  ('tc2007b-w2-l1', 'tc2007b', 'Authentication', 2, 1),
  ('tc2007b-w2-l2', 'tc2007b', 'Access Control', 2, 2),
  ('tc2007b-w3-l1', 'tc2007b', 'Database and Application Security', 3, 1),
  ('tc2007b-w4-bridge', 'tc2007b', 'Week 4 Bridge · Secure Coding and Release Risk', 4, 0),
  ('tc2007b-w5-l1', 'tc2007b', 'Asymmetric Encryption', 5, 1),
  ('tc2007b-w6-bridge', 'tc2007b', 'Week 6 Bridge · Symmetric Crypto and Key Handling', 6, 0),
  ('tc2007b-w7-l1', 'tc2007b', 'Security Protocols and Hash Functions', 7, 1),
  ('tc2007b-w8-bridge', 'tc2007b', 'Week 8 Bridge · TLS and Secure Channels', 8, 0),
  ('tc2007b-w9-l1', 'tc2007b', 'Malicious Code', 9, 1),
  ('tc2007b-w10-l1', 'tc2007b', 'Firewalls', 10, 1),
  ('tc2007b-w11-l1', 'tc2007b', 'Intrusion Detection', 11, 1)
on conflict (id) do update set title = excluded.title, week_number = excluded.week_number, lecture_number = excluded.lecture_number;

do $$
declare
  qid uuid;
begin

  -- Week 1 Lecture 1 · Introduction to Cybersecurity
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'Which three goals make up the CIA triad?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'Which three goals make up the CIA triad?', 'easy', array['cia', 'goals'], 'Correct answer: Confidentiality, integrity, availability. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Confidentiality, integrity, availability', true, 1),
      (qid, 'Control, identity, authorization', false, 2),
      (qid, 'Cryptography, isolation, auditing', false, 3),
      (qid, 'Compliance, inspection, access', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'A denial-of-service attack primarily violates which requirement?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'A denial-of-service attack primarily violates which requirement?', 'easy', array['dos'], 'Correct answer: Availability. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Integrity', false, 1),
      (qid, 'Availability', true, 2),
      (qid, 'Confidentiality', false, 3),
      (qid, 'Accountability', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'An unauthorized change to a bank balance is mainly an attack on what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'An unauthorized change to a bank balance is mainly an attack on what?', 'easy', array['bank', 'balance'], 'Correct answer: Integrity. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Availability', false, 1),
      (qid, 'Confidentiality', false, 2),
      (qid, 'Integrity', true, 3),
      (qid, 'Authentication', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'A leaked password file is mainly a failure of what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'A leaked password file is mainly a failure of what?', 'easy', array['password', 'file'], 'Correct answer: Confidentiality. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Confidentiality', true, 1),
      (qid, 'Availability', false, 2),
      (qid, 'Integrity', false, 3),
      (qid, 'Non-repudiation', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'The lecture frames a security problem as the combination of which two ideas?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'The lecture frames a security problem as the combination of which two ideas?', 'medium', array['value', 'risk'], 'Correct answer: Value and risk. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Policy and mechanism', false, 1),
      (qid, 'Value and risk', true, 2),
      (qid, 'Privacy and law', false, 3),
      (qid, 'Hardware and software', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'What does phishing usually try to make the victim do?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'What does phishing usually try to make the victim do?', 'medium', array['phishing'], 'Correct answer: Give up sensitive information. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Increase system availability', false, 1),
      (qid, 'Give up sensitive information', true, 2),
      (qid, 'Patch a vulnerability', false, 3),
      (qid, 'Encrypt a database', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'Spoofing is best described as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'Spoofing is best described as what?', 'medium', array['spoofing'], 'Correct answer: Disguising the source or identity. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Disguising the source or identity', true, 1),
      (qid, 'Repairing damaged data', false, 2),
      (qid, 'Blocking all network traffic', false, 3),
      (qid, 'Measuring password strength', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'Least privilege means giving a user or component what level of access?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'Least privilege means giving a user or component what level of access?', 'medium', array['least', 'privilege'], 'Correct answer: Only the access it needs. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Administrator access by default', false, 1),
      (qid, 'Only the access it needs', true, 2),
      (qid, 'Temporary access to everything', false, 3),
      (qid, 'Access based on seniority', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'Open design says security should not depend on what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'Open design says security should not depend on what?', 'medium', array['open', 'design'], 'Correct answer: The design remaining secret. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'The attacker being slow', false, 1),
      (qid, 'The design remaining secret', true, 2),
      (qid, 'Users choosing strong passwords', false, 3),
      (qid, 'Backups being available', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'Which sequence matches the defense lifecycle from the lecture?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'Which sequence matches the defense lifecycle from the lecture?', 'challenge', array['defense', 'lifecycle'], 'Correct answer: Prevent, detect, respond, recover. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Detect, prevent, recover, respond', false, 1),
      (qid, 'Prevent, detect, respond, recover', true, 2),
      (qid, 'Recover, detect, prevent, respond', false, 3),
      (qid, 'Respond, prevent, recover, detect', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'In security design, policy is the ''what''. What is mechanism?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'In security design, policy is the ''what''. What is mechanism?', 'challenge', array['policy', 'mechanism'], 'Correct answer: The technical how. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'The budget', false, 1),
      (qid, 'The course rule', false, 2),
      (qid, 'The technical how', true, 3),
      (qid, 'The attacker motive', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l1' and prompt = 'Why does the lecture say we balance CIA rather than maximize all three?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l1', 'Why does the lecture say we balance CIA rather than maximize all three?', 'challenge', array['balance'], 'Correct answer: They can pull against each other. Review the lecture section connected to this concept.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They can pull against each other', true, 1),
      (qid, 'They are legally optional', false, 2),
      (qid, 'Only confidentiality matters', false, 3),
      (qid, 'They are the same property', false, 4);
  end if;

  -- Week 1 Lecture 2 · Legal and Ethical Aspects
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'What is the best description of the relationship between law and ethics?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'What is the best description of the relationship between law and ethics?', 'easy', array['law', 'ethics'], 'Professional ethics can ask for responsible behavior even when the law is incomplete or slow.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They are always identical', false, 1),
      (qid, 'Ethics can guide behavior beyond what law requires', true, 2),
      (qid, 'Ethics matters only when there is no technology', false, 3),
      (qid, 'Law never affects security work', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'Accidentally receiving sensitive health data most directly raises which issue?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'Accidentally receiving sensitive health data most directly raises which issue?', 'easy', array['law', 'privacy'], 'Sensitive personal data creates privacy and legal/ethical handling duties.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Privacy', true, 1),
      (qid, 'Availability only', false, 2),
      (qid, 'Password entropy', false, 3),
      (qid, 'Packet filtering', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'A useful ethical test before accessing data is to ask what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'A useful ethical test before accessing data is to ask what?', 'easy', array['law', 'authorization'], 'Technical ability is not the same as authorization or legitimacy.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Can I technically open it?', false, 1),
      (qid, 'Am I authorized and is there a legitimate purpose?', true, 2),
      (qid, 'Will the file load quickly?', false, 3),
      (qid, 'Can I guess the password?', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'Responsible vulnerability disclosure aims to balance what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'Responsible vulnerability disclosure aims to balance what?', 'easy', array['law', 'disclosure'], 'Responsible disclosure reduces harm while enabling repair.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Public safety and giving maintainers time to fix', true, 1),
      (qid, 'Speed and entertainment', false, 2),
      (qid, 'Secrecy forever and no documentation', false, 3),
      (qid, 'Deleting evidence and moving on', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'Why is consent important in security testing?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'Why is consent important in security testing?', 'medium', array['law', 'consent'], 'Permission and scope are what make testing legitimate.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'It makes attacks impossible', false, 1),
      (qid, 'It separates authorized testing from unauthorized intrusion', true, 2),
      (qid, 'It removes the need for scope', false, 3),
      (qid, 'It guarantees no bugs', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'Finding an exposed database online means you should first do what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'Finding an exposed database online means you should first do what?', 'medium', array['law', 'ownership'], 'Minimize access and report responsibly.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Download all records', false, 1),
      (qid, 'Share screenshots publicly', false, 2),
      (qid, 'Avoid accessing data and report through an appropriate channel', true, 3),
      (qid, 'Try common passwords', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'Data minimization means collecting what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'Data minimization means collecting what?', 'medium', array['law', 'minimization'], 'Collecting less sensitive data reduces risk and supports privacy.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Everything possible', false, 1),
      (qid, 'Only what is needed for the stated purpose', true, 2),
      (qid, 'Only encrypted data with no purpose', false, 3),
      (qid, 'Only passwords', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'Security logs can create privacy risk because they may contain what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'Security logs can create privacy risk because they may contain what?', 'medium', array['law', 'logs'], 'Logs can reveal identities, actions, locations, and timing.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Personal identifiers and behavior traces', true, 1),
      (qid, 'Only random noise', false, 2),
      (qid, 'No useful information', false, 3),
      (qid, 'Only public holidays', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'In an authorized pentest, scope defines what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'In an authorized pentest, scope defines what?', 'medium', array['law', 'scope'], 'Scope prevents testing from becoming unauthorized activity.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'What systems and actions are permitted', true, 1),
      (qid, 'The color of the report', false, 2),
      (qid, 'The student''s grade', false, 3),
      (qid, 'The hashing algorithm only', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w1-l2' and prompt = 'A core ethical principle for security work is to avoid what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w1-l2', 'A core ethical principle for security work is to avoid what?', 'challenge', array['law', 'harm'], 'Security work should reduce harm, not create avoidable damage.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Documenting findings', false, 1),
      (qid, 'Unnecessary harm', true, 2),
      (qid, 'Getting permission', false, 3),
      (qid, 'Reducing risk', false, 4);
  end if;

  -- Week 2 Lecture 1 · Authentication
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Authentication answers which question?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Authentication answers which question?', 'easy', array['auth', 'authn'], 'Authentication verifies identity. Authorization decides allowed actions.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'What are you allowed to do?', false, 1),
      (qid, 'Who are you?', true, 2),
      (qid, 'Was the message modified?', false, 3),
      (qid, 'Is the service online?', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Which option combines two different authentication factors?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Which option combines two different authentication factors?', 'easy', array['auth', 'factors'], 'A password is something you know; an authenticator app code is something you have.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Password and PIN', false, 1),
      (qid, 'Password and security question', false, 2),
      (qid, 'Password and authenticator app code', true, 3),
      (qid, 'Two different passwords', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Why do password hashes need salts?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Why do password hashes need salts?', 'easy', array['auth', 'salt'], 'A unique salt makes precomputed/rainbow-table attacks much less useful.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'To make passwords shorter', false, 1),
      (qid, 'To prevent identical passwords from producing identical stored hashes', true, 2),
      (qid, 'To let users log in without passwords', false, 3),
      (qid, 'To encrypt the database', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Which storage design is safest after a password database leak?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Which storage design is safest after a password database leak?', 'easy', array['auth', 'slowhash'], 'Slow salted password hashing makes offline guessing more expensive.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Plaintext passwords', false, 1),
      (qid, 'Fast unsalted hashes', false, 2),
      (qid, 'Slow salted password hashes', true, 3),
      (qid, 'Encrypted passwords with the key in the same table', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'What is a major risk of relying on biometrics?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'What is a major risk of relying on biometrics?', 'medium', array['auth', 'biometrics'], 'You can change a password, but you cannot easily change your fingerprint or face.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They are easy to rotate after a leak', false, 1),
      (qid, 'They cannot be copied by sensors', false, 2),
      (qid, 'They are hard to change if compromised', true, 3),
      (qid, 'They remove all false positives', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Which MFA method is generally more phishing-resistant?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Which MFA method is generally more phishing-resistant?', 'medium', array['auth', 'mfa', 'phishing'], 'Security keys and passkeys bind authentication to the legitimate site.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'SMS code', false, 1),
      (qid, 'Email code', false, 2),
      (qid, 'Push approval with no context', false, 3),
      (qid, 'Hardware security key / passkey', true, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Current password guidance generally discourages forced periodic password changes because they often cause what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Current password guidance generally discourages forced periodic password changes because they often cause what?', 'medium', array['auth', 'rotation'], 'Forced rotation often pushes users toward predictable patterns.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Better memorization', false, 1),
      (qid, 'Weaker predictable passwords', true, 2),
      (qid, 'More entropy', false, 3),
      (qid, 'Faster hashing', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'A leaked hash file mainly creates what type of attacker opportunity?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'A leaked hash file mainly creates what type of attacker opportunity?', 'medium', array['auth', 'online', 'offline'], 'Attackers can test guesses offline without hitting the login page.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Offline guessing', true, 1),
      (qid, 'Physical tailgating', false, 2),
      (qid, 'DNS spoofing', false, 3),
      (qid, 'Availability failure', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Rate limiting login attempts mainly protects against what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Rate limiting login attempts mainly protects against what?', 'medium', array['auth', 'lockout'], 'Rate limiting slows repeated online guesses.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Stored XSS', false, 1),
      (qid, 'Online brute force', true, 2),
      (qid, 'Disk failure', false, 3),
      (qid, 'Role explosion', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l1' and prompt = 'Why is authentication a usability problem too?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l1', 'Why is authentication a usability problem too?', 'challenge', array['auth', 'usability'], 'If authentication is too painful, people find workarounds that can weaken security.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Users bypass painful systems', true, 1),
      (qid, 'Users never make mistakes', false, 2),
      (qid, 'Security improves when login is confusing', false, 3),
      (qid, 'Usability and security never interact', false, 4);
  end if;

  -- Week 2 Lecture 2 · Access Control
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'Authorization answers which question?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'Authorization answers which question?', 'easy', array['ac', 'authz'], 'Authorization decides whether an authenticated subject may perform an action.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Who are you?', false, 1),
      (qid, 'What are you allowed to do?', true, 2),
      (qid, 'Was the password leaked?', false, 3),
      (qid, 'How fast is the network?', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'In access control, a file, database row, or room is usually called what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'In access control, a file, database row, or room is usually called what?', 'easy', array['ac', 'subject', 'object'], 'Objects are the resources being protected.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Subject', false, 1),
      (qid, 'Object', true, 2),
      (qid, 'Clearance', false, 3),
      (qid, 'Nonce', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'A document owner deciding who can read their file is an example of which model?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'A document owner deciding who can read their file is an example of which model?', 'easy', array['ac', 'dac'], 'Discretionary access control lets the owner make sharing decisions.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'DAC', true, 1),
      (qid, 'MAC', false, 2),
      (qid, 'RBAC', false, 3),
      (qid, 'ABAC', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'Security labels such as Confidential and Secret are most closely associated with which model?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'Security labels such as Confidential and Secret are most closely associated with which model?', 'easy', array['ac', 'mac'], 'Mandatory access control often uses labels and clearances.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'DAC', false, 1),
      (qid, 'MAC', true, 2),
      (qid, 'RBAC', false, 3),
      (qid, 'Password hashing', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'Teaching assistants can grade labs because they hold the TA role. Which model is this?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'Teaching assistants can grade labs because they hold the TA role. Which model is this?', 'medium', array['ac', 'rbac'], 'Role-based access control grants permissions through roles.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'DAC', false, 1),
      (qid, 'RBAC', true, 2),
      (qid, 'XSS', false, 3),
      (qid, 'CAPTCHA', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'A policy that depends on role, device health, time, and location is closest to which model?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'A policy that depends on role, device health, time, and location is closest to which model?', 'medium', array['ac', 'abac'], 'Attribute-based access control uses subject, object, and environment attributes.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'DAC', false, 1),
      (qid, 'MAC only', false, 2),
      (qid, 'ABAC', true, 3),
      (qid, 'Plain ACL', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'Least privilege means access should be what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'Least privilege means access should be what?', 'medium', array['ac', 'least', 'privilege'], 'Least privilege grants the smallest sufficient permission set.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Maximum by default', false, 1),
      (qid, 'Only what the task requires', true, 2),
      (qid, 'Equal for all users', false, 3),
      (qid, 'Hidden from logs', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'An access control list is usually organized around what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'An access control list is usually organized around what?', 'medium', array['ac', 'acl'], 'ACLs live with or describe the object and list who can access it.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'The object/resource', true, 1),
      (qid, 'The password salt', false, 2),
      (qid, 'The IP packet checksum', false, 3),
      (qid, 'The user''s memory', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'A capability is best understood as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'A capability is best understood as what?', 'medium', array['ac', 'capability'], 'Capabilities are unforgeable tokens that carry authority.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A token held by a subject that grants access', true, 1),
      (qid, 'A password complexity rule', false, 2),
      (qid, 'A SQL command', false, 3),
      (qid, 'A biometric false reject', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w2-l2' and prompt = 'Complete mediation requires what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w2-l2', 'Complete mediation requires what?', 'challenge', array['ac', 'complete', 'mediation'], 'Every access must be checked; one unguarded path can defeat the policy.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Checking every access request', true, 1),
      (qid, 'Only checking the first request', false, 2),
      (qid, 'Never logging decisions', false, 3),
      (qid, 'Letting users own all policies', false, 4);
  end if;

  -- Week 3 Lecture 1 · Database and Application Security
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'SQL injection happens when untrusted input is treated as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'SQL injection happens when untrusted input is treated as what?', 'easy', array['app', 'sqli'], 'Injection occurs when data changes the meaning of a command.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Plain text', false, 1),
      (qid, 'Executable query structure', true, 2),
      (qid, 'A backup', false, 3),
      (qid, 'A password salt', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Parameterized queries defend against SQL injection by doing what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Parameterized queries defend against SQL injection by doing what?', 'easy', array['app', 'parameterized'], 'The database receives user input as values, not SQL syntax.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Deleting all input', false, 1),
      (qid, 'Separating code from data', true, 2),
      (qid, 'Hiding error pages only', false, 3),
      (qid, 'Forcing password rotation', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Why is client-side validation alone insufficient?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Why is client-side validation alone insufficient?', 'easy', array['app', 'client', 'validation'], 'The browser is outside your trust boundary.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Browsers cannot show forms', false, 1),
      (qid, 'Attackers can bypass the client and call the server directly', true, 2),
      (qid, 'It prevents all SQL injection', false, 3),
      (qid, 'It encrypts passwords', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Cross-site scripting mainly abuses what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Cross-site scripting mainly abuses what?', 'easy', array['app', 'xss'], 'XSS occurs when untrusted content runs as script in a victim''s browser.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A browser interpreting untrusted content as code', true, 1),
      (qid, 'A database backup schedule', false, 2),
      (qid, 'A biometric scanner', false, 3),
      (qid, 'An offline hash file', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Rendering a user comment with textContent instead of innerHTML helps prevent what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Rendering a user comment with textContent instead of innerHTML helps prevent what?', 'medium', array['app', 'output', 'encoding'], 'textContent treats the comment as text rather than markup.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'SQL injection', false, 1),
      (qid, 'Stored or reflected XSS', true, 2),
      (qid, 'Password reuse', false, 3),
      (qid, 'Packet loss', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Why should an app''s database account have limited privileges?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Why should an app''s database account have limited privileges?', 'medium', array['app', 'least', 'privilege'], 'Least privilege limits blast radius after compromise.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'To limit damage if the app is exploited', true, 1),
      (qid, 'To make queries slower', false, 2),
      (qid, 'To let every user become admin', false, 3),
      (qid, 'To avoid backups', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Detailed database error messages shown to users can help attackers by revealing what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Detailed database error messages shown to users can help attackers by revealing what?', 'medium', array['app', 'errors'], 'Verbose errors can leak table names, fields, and query structure.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Schema and query clues', true, 1),
      (qid, 'The teacher PIN', false, 2),
      (qid, 'The student''s browser theme', false, 3),
      (qid, 'Only the clock time', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'A trust boundary is crossed when data moves between what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'A trust boundary is crossed when data moves between what?', 'medium', array['app', 'trust', 'boundary'], 'Trust boundaries mark places where assumptions and validation requirements change.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Areas with different trust assumptions', true, 1),
      (qid, 'Two CSS files', false, 2),
      (qid, 'Two identical passwords', false, 3),
      (qid, 'A slide and a projector', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'The OWASP Top 10 is best used as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'The OWASP Top 10 is best used as what?', 'medium', array['app', 'owasp'], 'OWASP Top 10 helps frame common web application risk categories.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A web application risk awareness guide', true, 1),
      (qid, 'A replacement for testing', false, 2),
      (qid, 'A password manager', false, 3),
      (qid, 'A database engine', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w3-l1' and prompt = 'Which combination best reflects defense in depth for app security?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w3-l1', 'Which combination best reflects defense in depth for app security?', 'challenge', array['app', 'defense', 'depth'], 'Layered defenses reduce the chance that one mistake becomes a breach.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Client checks only', false, 1),
      (qid, 'Parameters, server validation, output encoding, and least privilege', true, 2),
      (qid, 'Hiding the login page', false, 3),
      (qid, 'Using one admin database account for everything', false, 4);
  end if;

  -- Week 4 Bridge · Secure Coding and Release Risk
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Which finding should usually block release for a student-data system?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Which finding should usually block release for a student-data system?', 'easy', array['release', 'block', 'auth'], 'Unauthenticated access to sensitive records is a high-impact access-control failure.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Missing authentication on a records endpoint', true, 1),
      (qid, 'A typo in helper text', false, 2),
      (qid, 'A button with weak contrast', false, 3),
      (qid, 'A slow animation', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'What is the strongest direct defense against SQL injection in application queries?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'What is the strongest direct defense against SQL injection in application queries?', 'easy', array['release', 'sqli', 'control'], 'Parameterized queries separate SQL code from user-supplied data.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Parameterized queries', true, 1),
      (qid, 'A longer login page', false, 2),
      (qid, 'A hidden form field', false, 3),
      (qid, 'A public error page', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Rendering untrusted comments as text instead of HTML helps prevent what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Rendering untrusted comments as text instead of HTML helps prevent what?', 'easy', array['release', 'xss', 'control'], 'Text rendering prevents the browser from interpreting untrusted content as script.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Cross-site scripting', true, 1),
      (qid, 'Diffie-Hellman failure', false, 2),
      (qid, 'Packet loss', false, 3),
      (qid, 'Password rotation', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Why is browser-only validation not enough for security?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Why is browser-only validation not enough for security?', 'easy', array['release', 'client', 'validation'], 'Server-side validation is required because the client is outside the trust boundary.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Attackers can bypass the browser and call the server directly', true, 1),
      (qid, 'Browsers cannot send requests', false, 2),
      (qid, 'Validation makes encryption impossible', false, 3),
      (qid, 'It prevents all attacks', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'A known remote-code-execution issue in a production dependency should lead to what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'A known remote-code-execution issue in a production dependency should lead to what?', 'medium', array['release', 'dependency'], 'Known dangerous dependencies must be remediated or isolated before they become a breach path.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Patch, replace, or isolate the dependency', true, 1),
      (qid, 'Ignore it because it is third-party code', false, 2),
      (qid, 'Only change the color theme', false, 3),
      (qid, 'Delete all logs', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Risk triage usually considers which two ideas together?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Risk triage usually considers which two ideas together?', 'medium', array['release', 'risk', 'factor'], 'Risk combines how likely exploitation is with how much harm it would cause.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Likelihood and impact', true, 1),
      (qid, 'Font and color', false, 2),
      (qid, 'Number of slides and room size', false, 3),
      (qid, 'File name and folder name', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Why should the application database account have limited privileges?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Why should the application database account have limited privileges?', 'medium', array['release', 'least', 'priv'], 'Least privilege reduces blast radius after compromise.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'To limit damage if the app is exploited', true, 1),
      (qid, 'To make every query public', false, 2),
      (qid, 'To avoid backups', false, 3),
      (qid, 'To give all users admin access', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Why is hiding a vulnerable link not a real fix?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Why is hiding a vulnerable link not a real fix?', 'medium', array['release', 'hidden', 'endpoint'], 'Security must be enforced by the server, not by hoping nobody sees a link.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Attackers can call the endpoint directly', true, 1),
      (qid, 'Hidden links are always encrypted', false, 2),
      (qid, 'It creates too many passwords', false, 3),
      (qid, 'It makes TLS expire', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'A good release gate for a critical fix should include what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'A good release gate for a critical fix should include what?', 'medium', array['release', 'gate'], 'Critical fixes need verification before deployment.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Repair and retest the affected path', true, 1),
      (qid, 'Ship first and hope', false, 2),
      (qid, 'Remove the documentation', false, 3),
      (qid, 'Ask users to avoid the bug', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w4-bridge' and prompt = 'Why can security logs create privacy risk?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w4-bridge', 'Why can security logs create privacy risk?', 'challenge', array['release', 'logs', 'privacy'], 'Logs can reveal who did what, when, and from where.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They may contain identifiers and behavior traces', true, 1),
      (qid, 'They never contain useful data', false, 2),
      (qid, 'They disable authentication', false, 3),
      (qid, 'They remove all risk', false, 4);
  end if;

  -- Week 5 Lecture 1 · Asymmetric Encryption
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'In public-key cryptography, which key is safe to share?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'In public-key cryptography, which key is safe to share?', 'easy', array['crypto', 'public'], 'The public key is designed to be shared; the private key must remain secret.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Private key', false, 1),
      (qid, 'Public key', true, 2),
      (qid, 'Session key only', false, 3),
      (qid, 'Password hash', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'To send Alice a confidential message, Bob should encrypt with whose key?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'To send Alice a confidential message, Bob should encrypt with whose key?', 'easy', array['crypto', 'confidential'], 'Encrypting with Alice''s public key means only Alice''s private key should decrypt it.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Bob''s private key', false, 1),
      (qid, 'Bob''s public key', false, 2),
      (qid, 'Alice''s public key', true, 3),
      (qid, 'Alice''s password', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'A digital signature is created with which key?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'A digital signature is created with which key?', 'easy', array['crypto', 'sign'], 'The signer uses their private key; others verify with the public key.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'The sender''s private key', true, 1),
      (qid, 'The sender''s public key', false, 2),
      (qid, 'The receiver''s public key', false, 3),
      (qid, 'A shared password', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'Diffie-Hellman is mainly used to do what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'Diffie-Hellman is mainly used to do what?', 'easy', array['crypto', 'dh', 'purpose'], 'Diffie-Hellman lets two parties derive a shared secret without sending the secret itself.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Hash passwords', false, 1),
      (qid, 'Agree on a shared secret over an open channel', true, 2),
      (qid, 'Compress data', false, 3),
      (qid, 'Detect malware', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'What does ''mod'' mean in modular arithmetic?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'What does ''mod'' mean in modular arithmetic?', 'medium', array['crypto', 'mod'], 'Modulo arithmetic keeps the remainder after division.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'The remainder after division', true, 1),
      (qid, 'The largest prime number', false, 2),
      (qid, 'The private key', false, 3),
      (qid, 'The browser mode', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'RSA security relies heavily on the difficulty of what problem?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'RSA security relies heavily on the difficulty of what problem?', 'medium', array['crypto', 'rsa', 'hard'], 'RSA is built around arithmetic where factoring the modulus is hard at real sizes.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Factoring large products of primes', true, 1),
      (qid, 'Sorting small arrays', false, 2),
      (qid, 'Finding CSS colors', false, 3),
      (qid, 'Counting packets', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'Why should textbook/raw RSA not be used directly?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'Why should textbook/raw RSA not be used directly?', 'medium', array['crypto', 'padding'], 'Real RSA schemes need safe padding; raw RSA has dangerous structure.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'It is too randomized', false, 1),
      (qid, 'It needs secure padding and protocol design', true, 2),
      (qid, 'It cannot use public keys', false, 3),
      (qid, 'It only works for images', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'A common advantage of elliptic-curve cryptography is what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'A common advantage of elliptic-curve cryptography is what?', 'medium', array['crypto', 'ecc'], 'ECC can provide comparable security with smaller keys than classic RSA.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Shorter keys for comparable security', true, 1),
      (qid, 'No need for private keys', false, 2),
      (qid, 'It removes authentication', false, 3),
      (qid, 'It breaks all hashes', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'Post-quantum cryptography matters because large quantum computers threaten which public-key systems?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'Post-quantum cryptography matters because large quantum computers threaten which public-key systems?', 'medium', array['crypto', 'pq'], 'Shor''s algorithm threatens RSA, Diffie-Hellman, and ECC if large quantum computers become practical.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Many RSA and elliptic-curve systems', true, 1),
      (qid, 'All one-time pads', false, 2),
      (qid, 'Every backup', false, 3),
      (qid, 'Only HTML', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w5-l1' and prompt = 'Encryption alone primarily provides confidentiality. What adds origin authenticity?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w5-l1', 'Encryption alone primarily provides confidentiality. What adds origin authenticity?', 'challenge', array['crypto', 'authenticity'], 'Signatures and MACs help prove who created or authorized a message.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A digital signature or MAC', true, 1),
      (qid, 'A larger font', false, 2),
      (qid, 'A public website', false, 3),
      (qid, 'Disabling logs', false, 4);
  end if;

  -- Week 6 Bridge · Symmetric Crypto and Key Handling
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'Authenticated encryption provides which combination?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'Authenticated encryption provides which combination?', 'easy', array['sym', 'aead'], 'AEAD modes protect secrecy and detect unauthorized modification.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Confidentiality plus tamper detection', true, 1),
      (qid, 'Compression plus backups', false, 2),
      (qid, 'Only public identity', false, 3),
      (qid, 'Only password rotation', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'Why is ECB mode dangerous for structured data?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'Why is ECB mode dangerous for structured data?', 'easy', array['sym', 'ecb'], 'Equal plaintext blocks produce equal ciphertext blocks in ECB.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'It leaks patterns in repeated plaintext blocks', true, 1),
      (qid, 'It is too random', false, 2),
      (qid, 'It requires no key', false, 3),
      (qid, 'It only works with images', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'For many modern encryption modes, a nonce used with the same key should be what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'For many modern encryption modes, a nonce used with the same key should be what?', 'easy', array['sym', 'nonce'], 'Nonce reuse under the same key can break confidentiality or integrity guarantees.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Unique', true, 1),
      (qid, 'Secret forever', false, 2),
      (qid, 'A password', false, 3),
      (qid, 'The same for every file', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'What is wrong with storing production encryption keys in a public code repository?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'What is wrong with storing production encryption keys in a public code repository?', 'easy', array['sym', 'key', 'repo'], 'If the key leaks, ciphertext protected by it may become readable.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A leaked key can expose protected data', true, 1),
      (qid, 'Keys must always be public', false, 2),
      (qid, 'It makes hashes slower', false, 3),
      (qid, 'It improves availability only', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'After evidence that a key was copied, what should happen?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'After evidence that a key was copied, what should happen?', 'medium', array['sym', 'rotation'], 'Rotation limits future damage after compromise.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Rotate the key and re-protect affected data as needed', true, 1),
      (qid, 'Keep using it forever', false, 2),
      (qid, 'Publish it for transparency', false, 3),
      (qid, 'Switch to ECB', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'Passwords should be stored with what kind of function?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'Passwords should be stored with what kind of function?', 'medium', array['sym', 'password', 'hash'], 'Slow salted password hashing raises the cost of offline guessing.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Slow salted password hash', true, 1),
      (qid, 'Fast unsalted checksum', false, 2),
      (qid, 'Plain AES with the key in the same table', false, 3),
      (qid, 'Base64 encoding', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'Hybrid encryption commonly uses public-key crypto to protect what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'Hybrid encryption commonly uses public-key crypto to protect what?', 'medium', array['sym', 'hybrid'], 'The public-key step protects a fresh symmetric key used for efficient data encryption.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A symmetric session key', true, 1),
      (qid, 'The CSS file', false, 2),
      (qid, 'The user''s keyboard', false, 3),
      (qid, 'Only the log format', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'Encrypting laptop disks mainly protects data in which situation?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'Encrypting laptop disks mainly protects data in which situation?', 'medium', array['sym', 'at', 'rest'], 'Disk encryption helps when storage media is physically lost or stolen.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Device lost or stolen while powered off', true, 1),
      (qid, 'A user willingly gives away their password', false, 2),
      (qid, 'A valid admin queries the database', false, 3),
      (qid, 'A page has an XSS bug', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'Encryption without integrity can leave a system vulnerable to what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'Encryption without integrity can leave a system vulnerable to what?', 'medium', array['sym', 'integrity'], 'Integrity protection is needed to detect tampering.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Undetected ciphertext modification', true, 1),
      (qid, 'Longer passwords', false, 2),
      (qid, 'Better logging', false, 3),
      (qid, 'More accurate clocks', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w6-bridge' and prompt = 'A key-management service helps mainly by doing what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w6-bridge', 'A key-management service helps mainly by doing what?', 'challenge', array['sym', 'kms'], 'Key-management systems help enforce access control, logging, and rotation.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Controlling, auditing, and separating access to keys', true, 1),
      (qid, 'Making all keys public', false, 2),
      (qid, 'Removing the need for authentication', false, 3),
      (qid, 'Turning encryption into compression', false, 4);
  end if;

  -- Week 7 · Security Protocols and Hash Functions
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'What is the main purpose of a nonce in an authentication protocol?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'What is the main purpose of a nonce in an authentication protocol?', 'easy', array['proto', 'nonce'], 'A nonce helps prove the message is fresh and not just an old replay.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Freshness and replay protection', true, 1),
      (qid, 'Data compression', false, 2),
      (qid, 'Password storage', false, 3),
      (qid, 'Firewall filtering', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'A reflection attack often exploits what protocol design mistake?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'A reflection attack often exploits what protocol design mistake?', 'easy', array['proto', 'reflection'], 'If a message is valid both ways, an attacker may reflect a challenge back to the initiator.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Messages valid in both directions', true, 1),
      (qid, 'Too many backups', false, 2),
      (qid, 'Long hash outputs', false, 3),
      (qid, 'Packet fragmentation', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'Why do protocols commonly establish session keys?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'Why do protocols commonly establish session keys?', 'easy', array['proto', 'session', 'key'], 'Session keys reduce how often long-term secrets are used.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'To limit long-term key exposure', true, 1),
      (qid, 'To remove authentication', false, 2),
      (qid, 'To make every packet public', false, 3),
      (qid, 'To replace all logging', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'Kerberos relies on what kind of trusted component?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'Kerberos relies on what kind of trusted component?', 'easy', array['proto', 'kdc'], 'Kerberos uses a trusted KDC to issue tickets.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Key Distribution Center', true, 1),
      (qid, 'Web Application Firewall', false, 2),
      (qid, 'DNS cache only', false, 3),
      (qid, 'Packet sniffer', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'Preimage resistance means it is hard to do what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'Preimage resistance means it is hard to do what?', 'medium', array['hash', 'preimage'], 'Preimage resistance makes reversing a digest hard.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Find a message from its hash', true, 1),
      (qid, 'Find any network port', false, 2),
      (qid, 'Encrypt a file', false, 3),
      (qid, 'Create a firewall rule', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'Collision resistance means it is hard to find what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'Collision resistance means it is hard to find what?', 'medium', array['hash', 'collision'], 'A collision is two distinct inputs with the same digest.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Two different messages with the same hash', true, 1),
      (qid, 'One password with uppercase letters', false, 2),
      (qid, 'A valid IP address', false, 3),
      (qid, 'A public key', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'The birthday paradox implies that collision search for an n-bit hash takes roughly how much work?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'The birthday paradox implies that collision search for an n-bit hash takes roughly how much work?', 'medium', array['hash', 'birthday'], 'Birthday attacks reduce collision-search work to around 2^(n/2).')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, '2^(n/2)', true, 1),
      (qid, '2^n exactly for all cases', false, 2),
      (qid, 'n steps', false, 3),
      (qid, 'One login attempt', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'Why should MD5 and SHA-1 be avoided for collision-sensitive uses?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'Why should MD5 and SHA-1 be avoided for collision-sensitive uses?', 'medium', array['hash', 'md5'], 'MD5 and SHA-1 are broken for modern collision-resistance needs.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They have practical collision weaknesses', true, 1),
      (qid, 'They are too slow for all uses', false, 2),
      (qid, 'They require public keys', false, 3),
      (qid, 'They only work on images', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'HMAC adds what to a hash to authenticate a message?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'HMAC adds what to a hash to authenticate a message?', 'medium', array['hmac'], 'HMAC uses a shared secret plus a hash construction.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A shared secret key', true, 1),
      (qid, 'A public font', false, 2),
      (qid, 'A firewall port', false, 3),
      (qid, 'A QR code', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w7-l1' and prompt = 'Why are fast hashes not ideal for password storage?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w7-l1', 'Why are fast hashes not ideal for password storage?', 'challenge', array['hash', 'password'], 'Password hashing should slow offline guessing.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They help attackers test guesses quickly', true, 1),
      (qid, 'They make passwords too long', false, 2),
      (qid, 'They cannot verify integrity', false, 3),
      (qid, 'They require a DMZ', false, 4);
  end if;

  -- Week 8 Bridge · TLS and Secure Channels
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'TLS for a website mainly provides what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'TLS for a website mainly provides what?', 'easy', array['tls', 'purpose'], 'TLS protects the channel and helps prove the server identity.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Encrypted channel plus server authentication', true, 1),
      (qid, 'Only a nicer URL', false, 2),
      (qid, 'Password hashing', false, 3),
      (qid, 'Firewall rule ordering', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'A certificate for portal.example.com used on bank.example.com is what kind of problem?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'A certificate for portal.example.com used on bank.example.com is what kind of problem?', 'easy', array['cert', 'hostname'], 'The certificate name must match the site being visited.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Hostname identity failure', true, 1),
      (qid, 'Password entropy success', false, 2),
      (qid, 'Packet filtering success', false, 3),
      (qid, 'A normal backup', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'An expired certificate most directly fails which check?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'An expired certificate most directly fails which check?', 'easy', array['cert', 'expired'], 'Certificates are trusted only within their valid date range.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Validity period', true, 1),
      (qid, 'Font size', false, 2),
      (qid, 'SQL syntax', false, 3),
      (qid, 'Malware family', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'An untrusted certificate issuer means the browser cannot verify what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'An untrusted certificate issuer means the browser cannot verify what?', 'easy', array['cert', 'issuer'], 'The certificate chain needs a trusted root or configured trust anchor.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A chain to a trusted authority', true, 1),
      (qid, 'The user''s favorite color', false, 2),
      (qid, 'The firewall brand', false, 3),
      (qid, 'The hash output length', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'HSTS helps defend against what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'HSTS helps defend against what?', 'medium', array['hsts'], 'HSTS instructs browsers to connect to the site only over HTTPS.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'HTTP downgrade and accidental insecure fallback', true, 1),
      (qid, 'SQL injection', false, 2),
      (qid, 'Password reuse by itself', false, 3),
      (qid, 'Disk theft', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'A proxy that forces HTTPS traffic down to HTTP is best treated as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'A proxy that forces HTTPS traffic down to HTTP is best treated as what?', 'medium', array['downgrade'], 'Downgrades remove the security properties users expect from TLS.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'An active channel attack', true, 1),
      (qid, 'A harmless visual bug', false, 2),
      (qid, 'A password-strength improvement', false, 3),
      (qid, 'A data backup', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'A VPN or zero-trust access gateway is most useful when users need what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'A VPN or zero-trust access gateway is most useful when users need what?', 'medium', array['vpn'], 'Remote access should authenticate users and protect traffic to private services.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Authenticated encrypted access to internal services', true, 1),
      (qid, 'A faster hash collision', false, 2),
      (qid, 'A public certificate for every file', false, 3),
      (qid, 'No authorization checks', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'Certificate transparency monitoring can help detect what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'Certificate transparency monitoring can help detect what?', 'medium', array['ct'], 'Public certificate logs can reveal suspicious or mistaken issuance.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Unexpected certificates issued for a domain', true, 1),
      (qid, 'Every SQL injection', false, 2),
      (qid, 'All phishing emails automatically', false, 3),
      (qid, 'Lost USB drives', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'On public Wi-Fi, why should students avoid sending credentials over HTTP?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'On public Wi-Fi, why should students avoid sending credentials over HTTP?', 'medium', array['public', 'wifi'], 'HTTP has no TLS protection for confidentiality or integrity.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Credentials and content can be intercepted or modified', true, 1),
      (qid, 'HTTP makes passwords longer', false, 2),
      (qid, 'Wi-Fi blocks every attacker', false, 3),
      (qid, 'HTTP automatically signs messages', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w8-bridge' and prompt = 'A secure channel is weak if encryption is present but endpoint identity is not verified because why?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w8-bridge', 'A secure channel is weak if encryption is present but endpoint identity is not verified because why?', 'challenge', array['channel', 'authn'], 'Confidentiality only helps if the other endpoint is the intended one.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'You may be encrypting to the wrong party', true, 1),
      (qid, 'Encryption stops needing keys', false, 2),
      (qid, 'It fixes all app bugs', false, 3),
      (qid, 'It removes every firewall rule', false, 4);
  end if;

  -- Week 9 · Malicious Code
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'Malware is software designed primarily to do what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'Malware is software designed primarily to do what?', 'easy', array['malware', 'definition'], 'Malware is code designed to violate confidentiality, integrity, availability, or control.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Violate security goals', true, 1),
      (qid, 'Improve backups', false, 2),
      (qid, 'Patch systems', false, 3),
      (qid, 'Document requirements', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'A virus is usually distinguished by what behavior?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'A virus is usually distinguished by what behavior?', 'easy', array['malware', 'virus'], 'Viruses infect host code and spread through that host mechanism.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Attaching to host files or programs', true, 1),
      (qid, 'Only filtering packets', false, 2),
      (qid, 'Issuing Kerberos tickets', false, 3),
      (qid, 'Hashing messages', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'A worm is especially known for what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'A worm is especially known for what?', 'easy', array['malware', 'worm'], 'Worms spread without needing a user to attach them to a host file.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Self-propagating across networks', true, 1),
      (qid, 'Only encrypting backups', false, 2),
      (qid, 'Verifying signatures', false, 3),
      (qid, 'Rendering HTML safely', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'A rootkit mainly tries to do what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'A rootkit mainly tries to do what?', 'easy', array['malware', 'rootkit'], 'Rootkits conceal compromise and maintain control.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Hide presence and maintain privileged control', true, 1),
      (qid, 'Make passwords longer', false, 2),
      (qid, 'Open a QR code', false, 3),
      (qid, 'Create a collision-resistant hash', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'A botnet is best described as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'A botnet is best described as what?', 'medium', array['malware', 'botnet'], 'Botnets coordinate compromised hosts through command and control.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Many compromised machines controlled together', true, 1),
      (qid, 'One encrypted file', false, 2),
      (qid, 'A web input form', false, 3),
      (qid, 'A firewall default rule', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'Ransomware typically harms availability by doing what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'Ransomware typically harms availability by doing what?', 'medium', array['malware', 'ransomware'], 'Ransomware denies access and demands payment.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Encrypting or locking files', true, 1),
      (qid, 'Making hashes longer', false, 2),
      (qid, 'Issuing tickets', false, 3),
      (qid, 'Reducing false positives', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'An APT is usually characterized by what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'An APT is usually characterized by what?', 'medium', array['malware', 'apt'], 'Advanced Persistent Threats are targeted and sustained.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Persistent, targeted, well-resourced activity', true, 1),
      (qid, 'A single accidental typo', false, 2),
      (qid, 'Only a firewall rule', false, 3),
      (qid, 'A classroom quiz', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'Fileless malware often abuses what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'Fileless malware often abuses what?', 'medium', array['malware', 'fileless'], 'Fileless malware may live in memory and use trusted system tools.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Legitimate tools and memory-resident behavior', true, 1),
      (qid, 'Only printed handouts', false, 2),
      (qid, 'Public-key signatures only', false, 3),
      (qid, 'DMZ diagrams', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'What is a good early ransomware response?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'What is a good early ransomware response?', 'medium', array['malware', 'containment'], 'Containment limits spread and preserves response options.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Isolate affected systems', true, 1),
      (qid, 'Keep using the infected machine', false, 2),
      (qid, 'Delete all logs', false, 3),
      (qid, 'Pay before investigating', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w9-l1' and prompt = 'Which approach best fits malware defense?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w9-l1', 'Which approach best fits malware defense?', 'challenge', array['malware', 'defense'], 'Modern malware defense needs layered controls.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Layered prevention, detection, backups, and recovery', true, 1),
      (qid, 'Only signatures forever', false, 2),
      (qid, 'No patching', false, 3),
      (qid, 'All users as admins', false, 4);
  end if;

  -- Week 10 Lecture 1 · Firewalls
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A firewall primarily enforces what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A firewall primarily enforces what?', 'easy', array['fw', 'purpose'], 'Firewalls allow or deny traffic according to policy.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Network access policy', true, 1),
      (qid, 'Password hashing', false, 2),
      (qid, 'Digital signatures', false, 3),
      (qid, 'Student attendance', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A safer firewall posture is usually what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A safer firewall posture is usually what?', 'easy', array['fw', 'default'], 'Least privilege applies to network traffic too.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Deny by default, allow what is needed', true, 1),
      (qid, 'Allow everything by default', false, 2),
      (qid, 'Disable logs', false, 3),
      (qid, 'Expose databases', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A basic packet filter commonly examines what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A basic packet filter commonly examines what?', 'easy', array['fw', 'packet'], 'Packet filters use header fields such as source, destination, port, and protocol.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Addresses, ports, and protocol', true, 1),
      (qid, 'Only user emotion', false, 2),
      (qid, 'Only HTML tags', false, 3),
      (qid, 'Password salts', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'Stateful inspection adds awareness of what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'Stateful inspection adds awareness of what?', 'easy', array['fw', 'stateful'], 'Stateful firewalls remember whether traffic belongs to an established connection.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Connection state', true, 1),
      (qid, 'Hash collisions', false, 2),
      (qid, 'Biometric fingerprints', false, 3),
      (qid, 'Source code comments', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A WAF is designed to inspect what layer most directly?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A WAF is designed to inspect what layer most directly?', 'medium', array['fw', 'waf'], 'A WAF focuses on HTTP/web application behavior.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Web application requests', true, 1),
      (qid, 'Power cables', false, 2),
      (qid, 'Private key storage', false, 3),
      (qid, 'Physical door locks', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A DMZ is useful for what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A DMZ is useful for what?', 'medium', array['fw', 'dmz'], 'A DMZ exposes necessary services while limiting access to internal systems.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Isolating public-facing services from the internal network', true, 1),
      (qid, 'Storing all passwords in plaintext', false, 2),
      (qid, 'Removing every firewall', false, 3),
      (qid, 'Replacing backups', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A bastion host should be what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A bastion host should be what?', 'medium', array['fw', 'bastion'], 'Bastion hosts face risk and should be hardened.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Hardened because it is exposed', true, 1),
      (qid, 'Unpatched because it is temporary', false, 2),
      (qid, 'Given every secret', false, 3),
      (qid, 'Hidden inside a student phone', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A host firewall protects what scope?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A host firewall protects what scope?', 'medium', array['fw', 'host'], 'Host firewalls control local inbound/outbound connections.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'An individual endpoint', true, 1),
      (qid, 'Only the entire Internet', false, 2),
      (qid, 'Only hash functions', false, 3),
      (qid, 'Only Kerberos tickets', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'A next-generation firewall commonly adds what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'A next-generation firewall commonly adds what?', 'medium', array['fw', 'ngfw'], 'NGFWs add richer context beyond simple port rules.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Application/user awareness and threat intelligence', true, 1),
      (qid, 'Less context than a packet filter', false, 2),
      (qid, 'No logging', false, 3),
      (qid, 'Password storage', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w10-l1' and prompt = 'Which statement is true about firewalls?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w10-l1', 'Which statement is true about firewalls?', 'challenge', array['fw', 'limit'], 'Firewalls are one layer in defense-in-depth.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'They are important but not sufficient alone', true, 1),
      (qid, 'They stop all attacks forever', false, 2),
      (qid, 'They replace secure coding', false, 3),
      (qid, 'They remove the need for detection', false, 4);
  end if;

  -- Week 11 · Intrusion Detection
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'Intrusion detection assumes what about prevention?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'Intrusion detection assumes what about prevention?', 'easy', array['ids', 'purpose'], 'IDS exists because some attacks will pass preventive controls.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Prevention is never perfect', true, 1),
      (qid, 'Prevention always catches everything', false, 2),
      (qid, 'Firewalls are useless', false, 3),
      (qid, 'Logs have no value', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'An alert on a real attack is called what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'An alert on a real attack is called what?', 'easy', array['ids', 'tp'], 'The alert is positive and the attack is real.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'True positive', true, 1),
      (qid, 'False positive', false, 2),
      (qid, 'False negative', false, 3),
      (qid, 'True negative', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'An alert on benign activity is called what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'An alert on benign activity is called what?', 'easy', array['ids', 'fp'], 'False positives create analyst workload.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'False positive', true, 1),
      (qid, 'True positive', false, 2),
      (qid, 'False negative', false, 3),
      (qid, 'Key exchange', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'A real attack with no alert is called what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'A real attack with no alert is called what?', 'easy', array['ids', 'fn'], 'False negatives are missed attacks.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'False negative', true, 1),
      (qid, 'True negative', false, 2),
      (qid, 'False positive', false, 3),
      (qid, 'Honeypot', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'Signature detection is strongest for what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'Signature detection is strongest for what?', 'medium', array['ids', 'signature'], 'Signature detection matches known indicators or patterns.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Known patterns', true, 1),
      (qid, 'Never-before-seen behavior only', false, 2),
      (qid, 'Physical locks', false, 3),
      (qid, 'Password length', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'Anomaly detection compares activity against what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'Anomaly detection compares activity against what?', 'medium', array['ids', 'anomaly'], 'Anomaly systems look for deviations from expected behavior.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A baseline', true, 1),
      (qid, 'A public key', false, 2),
      (qid, 'A DMZ cable', false, 3),
      (qid, 'A password salt', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'A honeypot is best described as what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'A honeypot is best described as what?', 'medium', array['ids', 'honeypot'], 'Honeypots attract and study suspicious activity.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'A decoy system for observing attackers', true, 1),
      (qid, 'A production database with all secrets', false, 2),
      (qid, 'A password hash', false, 3),
      (qid, 'A packet checksum', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'An IPS differs from an IDS because it can do what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'An IPS differs from an IDS because it can do what?', 'medium', array['ids', 'ips'], 'Intrusion prevention systems can take blocking action.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Block traffic inline', true, 1),
      (qid, 'Only store passwords', false, 2),
      (qid, 'Never alert', false, 3),
      (qid, 'Remove all firewalls', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'The base-rate problem means even accurate detectors can produce many what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'The base-rate problem means even accurate detectors can produce many what?', 'medium', array['ids', 'base', 'rate'], 'When attacks are rare, false positives can dominate alert queues.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'False alarms in low-prevalence environments', true, 1),
      (qid, 'Private keys', false, 2),
      (qid, 'Kerberos tickets', false, 3),
      (qid, 'Backups', false, 4);
  end if;
  select id into qid from public.quiz_questions where lecture_id = 'tc2007b-w11-l1' and prompt = 'A SOC should improve alert usefulness by doing what?' limit 1;
  if qid is null then
    insert into public.quiz_questions (lecture_id, prompt, difficulty, topic, explanation)
    values ('tc2007b-w11-l1', 'A SOC should improve alert usefulness by doing what?', 'challenge', array['ids', 'soc'], 'SOC work is about turning signals into prioritized investigations.')
    returning id into qid;
    insert into public.quiz_options (question_id, option_text, is_correct, position) values
      (qid, 'Correlating, prioritizing, and adding context', true, 1),
      (qid, 'Alerting on every packet equally', false, 2),
      (qid, 'Deleting all logs', false, 3),
      (qid, 'Ignoring all detections', false, 4);
  end if;
end $$;
