const CONFIG = window.QUIZ_CONFIG || {};
const STORAGE_KEY = "tc2007b-quiz-pilot";

const demoQuestionBanks = {}; // Practice answer bank removed for security: the live quiz loads questions from the server and never sends correct answers to the browser.

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
  const lectureId = payload.lecture_id || CONFIG.lectureId;
  state.sessions[code] = {
    session_code: code,
    lecture_id: lectureId,
    title: payload.title || lectureTitle(lectureId),
    question_count: Number(payload.question_count || CONFIG.defaultQuestionCount || 10),
    duration_minutes: Number(payload.duration_minutes || CONFIG.defaultDurationMinutes || 8),
    starts_at: startsAt.toISOString(),
    created_at: startsAt.toISOString(),
    closes_at: new Date(startsAt.getTime() + Number(payload.duration_minutes || 8) * 60000).toISOString(),
    show_explanations: Boolean(payload.show_explanations),
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
  const selected = shuffle(questionsForLecture(session.lecture_id)).slice(0, Number(session.question_count || 10));
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
    show_explanations: Boolean(session.show_explanations),
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
    const source = findDemoQuestion(question.source_question_id);
    const selected = byQuestion.get(question.attempt_question_id);
    const correctOptionId = `${source.id}-o${source.answer}`;
    const correct = selected === correctOptionId;
    if (correct) score += 1;
    return {
      attempt_question_id: question.attempt_question_id,
      prompt: question.prompt,
      correct,
      explanation: attempt.show_explanations ? explanationFor(source) : null
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

function explanationFor(source) {
  if (source?.explanation) return source.explanation;
  const explanations = {
    "q-cia-goals": "The CIA triad is confidentiality, integrity, and availability.",
    "q-dos": "A denial-of-service attack tries to make a service unusable, so it targets availability.",
    "q-bank-balance": "Integrity is about preventing unauthorized or incorrect modification.",
    "q-password-file": "Confidentiality fails when secrets are disclosed to people who should not see them.",
    "q-value-risk": "The lecture frames security as valuable assets facing meaningful risk.",
    "q-phishing": "Phishing tricks a person into giving up sensitive information or taking a harmful action.",
    "q-spoofing": "Spoofing disguises identity, source, or origin.",
    "q-least-privilege": "Least privilege gives each user or component only the access needed for the task.",
    "q-open-design": "Open design says security should not rely on the design remaining secret.",
    "q-defense-lifecycle": "The lecture sequence is prevention, detection, response, and recovery.",
    "q-policy-mechanism": "Mechanism is the technical how: the way a policy is enforced.",
    "q-balance": "Improving one CIA property can sometimes hurt another, so security is a balancing act."
  };
  return explanations[source?.id] || "Review the lecture section connected to this concept.";
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
    question_stats: questionStatsForDemo(attempts),
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

function questionStatsForDemo(attempts) {
  const rows = new Map();
  attempts
    .filter((attempt) => attempt.submitted_at)
    .forEach((attempt) => {
      const selectedByQuestion = new Map((attempt.answers || []).map((answer) => [answer.attempt_question_id, answer.option_id]));
      (attempt.questions || []).forEach((question) => {
        const source = findDemoQuestion(question.source_question_id);
        if (!source) return;
        const key = source.id;
        if (!rows.has(key)) {
          rows.set(key, {
            question_id: key,
            prompt: source.prompt,
            attempts: 0,
            correct: 0,
            missed: 0,
            correct_percent: 0
          });
        }
        const row = rows.get(key);
        const selected = selectedByQuestion.get(question.attempt_question_id);
        const correct = selected === `${source.id}-o${source.answer}`;
        row.attempts += 1;
        row.correct += correct ? 1 : 0;
        row.missed += correct ? 0 : 1;
        row.correct_percent = row.attempts ? round1((row.correct / row.attempts) * 100) : 0;
      });
    });
  return Array.from(rows.values()).sort((a, b) => b.missed - a.missed);
}

function questionsForLecture(lectureId) {
  return demoQuestionBanks[lectureId] || [];
}

function findDemoQuestion(questionId) {
  return Object.values(demoQuestionBanks)
    .flat()
    .find((question) => question.id === questionId);
}

function lectureTitle(lectureId) {
  return CONFIG.lectures?.[lectureId] || "Quick Quiz";
}

export async function importQuestions(payload) {
  if (!isConfigured()) {
    throw new Error("Connect Supabase in config.js before importing questions.");
  }
  return callFunction("quiz-import-questions", payload);
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
