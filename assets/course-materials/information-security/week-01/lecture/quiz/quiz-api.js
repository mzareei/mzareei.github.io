const CONFIG = window.QUIZ_CONFIG || {};
const STORAGE_KEY = "tc2007b-quiz-pilot";

const demoQuestions = [
  {
    id: "q-cia-goals",
    prompt: "Which three goals make up the CIA triad?",
    options: ["Confidentiality, integrity, availability", "Control, identity, authorization", "Cryptography, isolation, auditing", "Compliance, inspection, access"],
    answer: 0
  },
  {
    id: "q-dos",
    prompt: "A denial-of-service attack primarily violates which requirement?",
    options: ["Integrity", "Availability", "Confidentiality", "Accountability"],
    answer: 1
  },
  {
    id: "q-bank-balance",
    prompt: "An unauthorized change to a bank balance is mainly an attack on what?",
    options: ["Availability", "Confidentiality", "Integrity", "Authentication"],
    answer: 2
  },
  {
    id: "q-password-file",
    prompt: "A leaked password file is mainly a failure of what?",
    options: ["Confidentiality", "Availability", "Integrity", "Non-repudiation"],
    answer: 0
  },
  {
    id: "q-value-risk",
    prompt: "The lecture frames a security problem as the combination of which two ideas?",
    options: ["Policy and mechanism", "Value and risk", "Privacy and law", "Hardware and software"],
    answer: 1
  },
  {
    id: "q-phishing",
    prompt: "What does phishing usually try to make the victim do?",
    options: ["Increase system availability", "Give up sensitive information", "Patch a vulnerability", "Encrypt a database"],
    answer: 1
  },
  {
    id: "q-spoofing",
    prompt: "Spoofing is best described as what?",
    options: ["Disguising the source or identity", "Repairing damaged data", "Blocking all network traffic", "Measuring password strength"],
    answer: 0
  },
  {
    id: "q-least-privilege",
    prompt: "Least privilege means giving a user or component what level of access?",
    options: ["Administrator access by default", "Only the access it needs", "Temporary access to everything", "Access based on seniority"],
    answer: 1
  },
  {
    id: "q-open-design",
    prompt: "Open design says security should not depend on what?",
    options: ["The attacker being slow", "The design remaining secret", "Users choosing strong passwords", "Backups being available"],
    answer: 1
  },
  {
    id: "q-defense-lifecycle",
    prompt: "Which sequence matches the defense lifecycle from the lecture?",
    options: ["Detect, prevent, recover, respond", "Prevent, detect, respond, recover", "Recover, detect, prevent, respond", "Respond, prevent, recover, detect"],
    answer: 1
  },
  {
    id: "q-policy-mechanism",
    prompt: "In security design, policy is the 'what'. What is mechanism?",
    options: ["The budget", "The course rule", "The technical how", "The attacker motive"],
    answer: 2
  },
  {
    id: "q-balance",
    prompt: "Why does the lecture say we balance CIA rather than maximize all three?",
    options: ["They can pull against each other", "They are legally optional", "Only confidentiality matters", "They are the same property"],
    answer: 0
  }
];

export function isConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

export async function createSession(payload) {
  if (isConfigured()) {
    return callFunction("quiz-create-session", payload);
  }

  const code = normalizeCode(payload.session_code) || makeCode();
  const state = readState();
  const startsAt = new Date();
  state.sessions[code] = {
    session_code: code,
    lecture_id: payload.lecture_id || CONFIG.lectureId,
    title: payload.title || "Week 1 Lecture 1 Quiz",
    question_count: Number(payload.question_count || CONFIG.defaultQuestionCount || 10),
    duration_minutes: Number(payload.duration_minutes || CONFIG.defaultDurationMinutes || 8),
    starts_at: startsAt.toISOString(),
    created_at: startsAt.toISOString(),
    closes_at: new Date(startsAt.getTime() + Number(payload.duration_minutes || 8) * 60000).toISOString(),
    mode: "demo"
  };
  writeState(state);
  return state.sessions[code];
}

export async function startAttempt(payload) {
  if (isConfigured()) {
    return callFunction("quiz-start-attempt", payload);
  }

  const code = normalizeCode(payload.session_code);
  const studentIdentifier = String(payload.student_identifier || "").trim();
  if (!studentIdentifier) {
    throw new Error("Student ID is required.");
  }
  const state = readState();
  const session = state.sessions[code];
  if (!session) {
    throw new Error("Session not found. Start it from the teacher console first.");
  }
  const selected = shuffle(demoQuestions).slice(0, Number(session.question_count || 10));
  const attemptId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const attemptQuestions = selected.map((question, index) => {
    const optionRows = question.options.map((text, optionIndex) => ({
      option_id: `${question.id}-o${optionIndex}`,
      text,
      is_correct: optionIndex === question.answer
    }));
    return {
      attempt_question_id: `${attemptId}-${index}`,
      source_question_id: question.id,
      prompt: question.prompt,
      position: index + 1,
      options: shuffle(optionRows).map(({ option_id, text }) => ({ option_id, text }))
    };
  });

  state.attempts[attemptId] = {
    attempt_id: attemptId,
    session_code: code,
    student_name: payload.student_name,
    student_identifier: studentIdentifier,
    started_at: new Date().toISOString(),
    questions: attemptQuestions,
    submitted_at: null,
    score: null,
    total: attemptQuestions.length
  };
  writeState(state);

  return {
    attempt_id: attemptId,
    session_code: code,
    title: session.title,
    closes_at: session.closes_at,
    questions: attemptQuestions.map(({ attempt_question_id, prompt, position, options }) => ({
      attempt_question_id,
      prompt,
      position,
      options
    }))
  };
}

export async function submitAttempt(payload) {
  if (isConfigured()) {
    return callFunction("quiz-submit-attempt", payload);
  }

  const state = readState();
  const attempt = state.attempts[payload.attempt_id];
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.submitted_at) throw new Error("This attempt was already submitted.");

  const byQuestion = new Map(payload.answers.map((answer) => [answer.attempt_question_id, answer.option_id]));
  let score = 0;
  const details = attempt.questions.map((question) => {
    const source = demoQuestions.find((item) => item.id === question.source_question_id);
    const selected = byQuestion.get(question.attempt_question_id);
    const correctOptionId = `${source.id}-o${source.answer}`;
    const correct = selected === correctOptionId;
    if (correct) score += 1;
    return {
      attempt_question_id: question.attempt_question_id,
      correct
    };
  });

  attempt.answers = payload.answers;
  attempt.score = score;
  attempt.total = attempt.questions.length;
  attempt.submitted_at = new Date().toISOString();
  writeState(state);

  return {
    score,
    total: attempt.total,
    percentage: Math.round((score / attempt.total) * 100),
    details
  };
}

export async function sessionSummary(payload) {
  if (isConfigured()) {
    return callFunction("quiz-session-summary", payload);
  }

  const code = normalizeCode(payload.session_code);
  const state = readState();
  const session = state.sessions[code];
  const attempts = Object.values(state.attempts)
    .filter((attempt) => attempt.session_code === code)
    .map((attempt) => ({
      ...attempt,
      ...attemptMetrics(attempt, session)
    }))
    .sort(compareAttempts);
  const submitted = attempts.filter((attempt) => attempt.submitted_at);
  const average = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / submitted.length
    : 0;
  const averageGrade = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.grade_percent || 0), 0) / submitted.length
    : 0;
  const averageAScore = submitted.length
    ? submitted.reduce((sum, attempt) => sum + Number(attempt.a_score || 0), 0) / submitted.length
    : 0;

  return {
    session,
    attempts,
    stats: {
      started: attempts.length,
      submitted: submitted.length,
      average_score: average,
      average_grade_percent: round1(averageGrade),
      average_a_score: round1(averageAScore),
      total: submitted[0] ? submitted[0].total : Number(session?.question_count || CONFIG.defaultQuestionCount || 10)
    }
  };
}

export function attemptMetrics(attempt, session) {
  const score = Number(attempt.score || 0);
  const total = Number(attempt.total || session?.question_count || CONFIG.defaultQuestionCount || 10);
  const submitted = Boolean(attempt.submitted_at);
  const gradePercent = submitted && total ? (score / total) * 100 : null;
  const startedAt = new Date(attempt.started_at || session?.starts_at || session?.created_at || Date.now()).getTime();
  const submittedAt = submitted ? new Date(attempt.submitted_at).getTime() : null;
  const sessionStart = new Date(session?.starts_at || session?.created_at || attempt.started_at || Date.now()).getTime();
  const sessionEnd = new Date(session?.closes_at || (sessionStart + Number(session?.duration_minutes || CONFIG.defaultDurationMinutes || 8) * 60000)).getTime();
  const durationSeconds = Math.max(1, Math.round((sessionEnd - sessionStart) / 1000));
  const elapsedSeconds = submittedAt ? Math.max(0, Math.round((submittedAt - startedAt) / 1000)) : null;
  const accuracyRatio = total ? score / total : 0;
  const remainingRatio = elapsedSeconds == null ? 0 : Math.max(0, 1 - elapsedSeconds / durationSeconds);
  const speedBonus = submitted ? 10 * accuracyRatio * remainingRatio : null;
  const aScore = submitted ? Number(gradePercent || 0) + Number(speedBonus || 0) : null;

  return {
    grade_percent: gradePercent == null ? null : round1(gradePercent),
    elapsed_seconds: elapsedSeconds,
    speed_bonus: speedBonus == null ? null : round1(speedBonus),
    a_score: aScore == null ? null : round1(aScore)
  };
}

export function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function studentLinkFor(sessionCode) {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("session", normalizeCode(sessionCode));
  return url.toString();
}

async function callFunction(name, payload) {
  const base = CONFIG.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with status ${response.status}.`);
  }
  return body;
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { sessions: {}, attempts: {} };
  } catch (error) {
    return { sessions: {}, attempts: {} };
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function compareAttempts(a, b) {
  const aSubmitted = a.submitted_at ? 1 : 0;
  const bSubmitted = b.submitted_at ? 1 : 0;
  if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
  const aScore = Number(a.a_score ?? -1);
  const bScore = Number(b.a_score ?? -1);
  if (aScore !== bScore) return bScore - aScore;
  const aGrade = Number(a.grade_percent ?? -1);
  const bGrade = Number(b.grade_percent ?? -1);
  if (aGrade !== bGrade) return bGrade - aGrade;
  const aElapsed = Number(a.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  const bElapsed = Number(b.elapsed_seconds ?? Number.MAX_SAFE_INTEGER);
  if (aElapsed !== bElapsed) return aElapsed - bElapsed;
  return String(a.started_at).localeCompare(String(b.started_at));
}

function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function shuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
