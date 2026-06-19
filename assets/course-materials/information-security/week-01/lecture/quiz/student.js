import { normalizeCode, startAttempt, submitAttempt } from "./quiz-api.js";

const joinForm = document.getElementById("joinForm");
const quizForm = document.getElementById("quizForm");
const resultPanel = document.getElementById("resultPanel");
const sessionCode = document.getElementById("sessionCode");
const studentName = document.getElementById("studentName");
const studentId = document.getElementById("studentId");
const joinStatus = document.getElementById("joinStatus");
const quizStatus = document.getElementById("quizStatus");
const quizSessionLabel = document.getElementById("quizSessionLabel");
const quizTitle = document.getElementById("quizTitle");
const quizMeta = document.getElementById("quizMeta");
const quizTimer = document.getElementById("quizTimer");
const quizProgress = document.getElementById("quizProgress");
const questionList = document.getElementById("questionList");
const quizActionBtn = document.getElementById("quizActionBtn");
const scoreText = document.getElementById("scoreText");
const resultMeta = document.getElementById("resultMeta");
const reviewList = document.getElementById("reviewList");

let currentAttempt = null;
let currentQuestionIndex = 0;
let answersByQuestion = new Map();
let timerId = null;
let submitting = false;
const identity = readIdentity();

const params = new URLSearchParams(window.location.search);
const codeFromUrl = normalizeCode(params.get("session"));
if (codeFromUrl) sessionCode.value = codeFromUrl;
studentName.value = identity.student_name || "";
studentId.value = identity.student_id || "";

sessionCode.addEventListener("input", () => {
  sessionCode.value = normalizeCode(sessionCode.value);
});

studentId.addEventListener("input", () => {
  studentId.value = normalizeStudentId(studentId.value);
});

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(joinStatus, "Starting...", "");
  const submitButton = joinForm.querySelector("button");
  submitButton.disabled = true;

  try {
    currentAttempt = await startAttempt({
      session_code: sessionCode.value,
      student_name: studentName.value.trim(),
      student_identifier: normalizeStudentId(studentId.value)
    });
    saveIdentity(studentName.value, studentId.value);
    renderAttempt(currentAttempt);
    joinForm.classList.add("hidden");
    quizForm.classList.remove("hidden");
    startTimer();
  } catch (error) {
    setStatus(joinStatus, error.message, "danger");
  } finally {
    submitButton.disabled = false;
  }
});

quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!captureCurrentAnswer()) {
    setStatus(quizStatus, "Choose an answer before continuing.", "warn");
    return;
  }

  if (currentQuestionIndex < currentAttempt.questions.length - 1) {
    currentQuestionIndex += 1;
    renderCurrentQuestion();
    return;
  }

  await submitCurrentAttempt(false);
});

function renderAttempt(attempt) {
  currentQuestionIndex = 0;
  answersByQuestion = new Map();
  quizSessionLabel.textContent = `Session ${attempt.session_code}`;
  quizTitle.textContent = attempt.title || "Quick Quiz";
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const question = currentAttempt.questions[currentQuestionIndex];
  const total = currentAttempt.questions.length;
  const left = total - currentQuestionIndex - 1;
  quizMeta.textContent = `Question ${currentQuestionIndex + 1} of ${total} · ${left} left`;
  quizActionBtn.textContent = currentQuestionIndex === total - 1 ? "Submit" : "Next";
  quizProgress.style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;
  questionList.innerHTML = "";

  const section = document.createElement("section");
  section.className = "question";
  section.innerHTML = `
    <div class="question__head">
      <span class="question__num"></span>
      <h3></h3>
    </div>
    <div class="options"></div>
  `;
  section.style.setProperty("--question-number", `"${currentQuestionIndex + 1}"`);
  section.querySelector("h3").textContent = question.prompt;
  const options = section.querySelector(".options");
  question.options.forEach((option) => {
    const label = document.createElement("label");
    label.className = "option";
    label.innerHTML = `
      <input type="radio" required>
      <span></span>
    `;
    const input = label.querySelector("input");
    input.name = question.attempt_question_id;
    input.value = option.option_id;
    input.checked = answersByQuestion.get(question.attempt_question_id) === option.option_id;
    label.querySelector("span").textContent = option.text;
    options.appendChild(label);
  });
  questionList.appendChild(section);
  setStatus(quizStatus, "", "");
}

function captureCurrentAnswer() {
  const question = currentAttempt.questions[currentQuestionIndex];
  const checked = quizForm.querySelector(`input[name="${question.attempt_question_id}"]:checked`);
  if (!checked) return false;
  answersByQuestion.set(question.attempt_question_id, checked.value);
  return true;
}

async function submitCurrentAttempt(fromTimer) {
  if (submitting) return;
  submitting = true;
  setStatus(quizStatus, fromTimer ? "Time is up. Submitting..." : "Submitting...", "");
  quizActionBtn.disabled = true;

  try {
    captureCurrentAnswer();
    const answers = currentAttempt.questions.map((question) => ({
      attempt_question_id: question.attempt_question_id,
      option_id: answersByQuestion.get(question.attempt_question_id) || null
    }));
    const result = await submitAttempt({
      attempt_id: currentAttempt.attempt_id,
      answers
    });

    clearInterval(timerId);
    quizForm.classList.add("hidden");
    resultPanel.classList.add("is-visible");
    const percentage = Number.isFinite(result.percentage)
      ? result.percentage
      : Math.round((Number(result.score) / Number(result.total)) * 100);
    scoreText.textContent = `${result.score}/${result.total}`;
    resultMeta.textContent = `${percentage}%`;
    renderReview(result);
  } catch (error) {
    submitting = false;
    setStatus(quizStatus, error.message, "danger");
    quizActionBtn.disabled = false;
  }
}

function renderReview(result) {
  const missed = (result.details || []).filter((item) => !item.correct);
  reviewList.innerHTML = "";
  if (!missed.length) {
    reviewList.innerHTML = `
      <section class="review-item review-item--good">
        <h3>Clean run</h3>
        <p>You answered every question correctly. Use the lecture summary to lock in the vocabulary.</p>
      </section>
    `;
    return;
  }

  const intro = document.createElement("section");
  intro.className = "review-item";
  intro.innerHTML = `
    <h3>Review focus</h3>
    <p></p>
  `;
  intro.querySelector("p").textContent = `Revisit ${missed.length} question${missed.length === 1 ? "" : "s"} before the next class.`;
  reviewList.appendChild(intro);

  missed.slice(0, 4).forEach((item) => {
    const section = document.createElement("section");
    section.className = "review-item";
    section.innerHTML = `
      <h3></h3>
      <p></p>
    `;
    section.querySelector("h3").textContent = item.prompt || "Missed concept";
    section.querySelector("p").textContent = item.explanation || "Review the lecture section connected to this concept.";
    reviewList.appendChild(section);
  });
}

function startTimer() {
  clearInterval(timerId);
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
}

function updateTimer() {
  const end = new Date(currentAttempt.closes_at || Date.now()).getTime();
  const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  quizTimer.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  quizTimer.dataset.tone = remaining <= 30 ? "danger" : remaining <= 90 ? "warn" : "good";

  if (remaining <= 0) {
    clearInterval(timerId);
    submitCurrentAttempt(true);
  }
}

function setStatus(element, message, tone) {
  element.textContent = message;
  if (tone) element.dataset.tone = tone;
  else element.removeAttribute("data-tone");
}

function normalizeStudentId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "")
    .slice(0, 40);
}

function readIdentity() {
  try {
    return JSON.parse(localStorage.getItem("tc2007b-student-identity")) || {};
  } catch (_error) {
    return {};
  }
}

function saveIdentity(name, id) {
  localStorage.setItem("tc2007b-student-identity", JSON.stringify({
    student_name: String(name || "").trim(),
    student_id: normalizeStudentId(id)
  }));
}
