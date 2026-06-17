import { importQuestions } from "./quiz-api.js";

const form = document.getElementById("bankForm");
const lectureId = document.getElementById("lectureId");
const teacherPin = document.getElementById("teacherPin");
const questionJson = document.getElementById("questionJson");
const sampleBtn = document.getElementById("sampleBtn");
const status = document.getElementById("bankStatus");

const sampleQuestions = [
  {
    prompt: "Which property is harmed when a service is unreachable?",
    explanation: "Availability is about being able to use a service when it is needed.",
    difficulty: "easy",
    topic: ["cia", "availability"],
    options: [
      { text: "Confidentiality", is_correct: false },
      { text: "Integrity", is_correct: false },
      { text: "Availability", is_correct: true },
      { text: "Authentication", is_correct: false }
    ]
  },
  {
    prompt: "Why does least privilege reduce risk?",
    explanation: "If one account or component is compromised, the damage is limited to the permissions it had.",
    difficulty: "medium",
    topic: ["design", "least privilege"],
    options: [
      { text: "It gives every user administrator permissions.", is_correct: false },
      { text: "It limits access to only what is necessary.", is_correct: true },
      { text: "It removes the need for authentication.", is_correct: false },
      { text: "It makes attacks impossible.", is_correct: false }
    ]
  }
];

questionJson.value = JSON.stringify(sampleQuestions, null, 2);
populateLectures();

sampleBtn.addEventListener("click", () => {
  questionJson.value = JSON.stringify(sampleQuestions, null, 2);
  setStatus("Sample restored.", "good");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Validating...", "");
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    const questions = JSON.parse(questionJson.value);
    validateQuestions(questions);
    setStatus("Importing...", "");
    const result = await importQuestions({
      lecture_id: lectureId.value.trim(),
      teacher_pin: teacherPin.value,
      questions
    });
    setStatus(`Imported ${result.imported} question${result.imported === 1 ? "" : "s"}.`, "good");
  } catch (error) {
    setStatus(error.message, "danger");
  } finally {
    submit.disabled = false;
  }
});

function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length) {
    throw new Error("Questions JSON must be a non-empty array.");
  }
  questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.prompt || !String(question.prompt).trim()) throw new Error(`${label}: prompt is required.`);
    if (!Array.isArray(question.options) || question.options.length < 2) throw new Error(`${label}: at least two options are required.`);
    const correct = question.options.filter((option) => option.is_correct).length;
    if (correct !== 1) throw new Error(`${label}: exactly one option must be correct.`);
  });
}

function setStatus(message, tone) {
  status.textContent = message;
  if (tone) status.dataset.tone = tone;
  else status.removeAttribute("data-tone");
}

function populateLectures() {
  const lectures = window.QUIZ_CONFIG?.lectures || { [window.QUIZ_CONFIG?.lectureId || "tc2007b-w1-l1"]: "Week 1 Lecture 1 · Introduction to Cybersecurity" };
  lectureId.innerHTML = "";
  Object.entries(lectures).forEach(([id, title]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = title;
    lectureId.appendChild(option);
  });
  const requested = new URLSearchParams(window.location.search).get("lecture");
  lectureId.value = lectures[requested] ? requested : (window.QUIZ_CONFIG?.lectureId || Object.keys(lectures)[0]);
}
