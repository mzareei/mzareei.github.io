import { startActivityAttempt, submitActivityAttempt } from "./activity-api.js";

const els = {
  activityInstanceInput: document.getElementById("activityInstanceInput"),
  loadActivityBtn: document.getElementById("loadActivityBtn"),
  submitActivityBtn: document.getElementById("submitActivityBtn"),
  questionList: document.getElementById("questionList"),
  activityStatus: document.getElementById("activityStatus"),
  activityScore: document.getElementById("activityScore"),
  attemptMeta: document.getElementById("attemptMeta"),
  activityTimer: document.getElementById("activityTimer")
};

let currentAttempt = null;
let currentQuestions = [];
let currentActivityInstance = null;
let countdownId = null;
let timerExpired = false;

const params = new URLSearchParams(window.location.search);
const queryActivity = params.get("activity") || params.get("activity_instance_id");
if (queryActivity) els.activityInstanceInput.value = queryActivity;

els.loadActivityBtn.addEventListener("click", loadActivity);
els.submitActivityBtn.addEventListener("click", submitActivity);

if (queryActivity) loadActivity();

async function loadActivity() {
  const activityInstanceId = els.activityInstanceInput.value.trim();
  if (!activityInstanceId) {
    setStatus("Enter an activity instance id.", "warn");
    return;
  }

  await run("Loading activity...", async () => {
    const result = await startActivityAttempt(activityInstanceId);
    currentAttempt = result.attempt;
    currentQuestions = result.questions || [];
    currentActivityInstance = result.activity_instance || {};
    renderAttempt(currentActivityInstance);
    renderQuestions(currentQuestions);
    if (isAttemptSubmitted(currentAttempt)) {
      clearCountdown();
      renderTimer("Submitted", "good");
    } else {
      startCountdown(currentAttempt?.attempt_deadline_at);
    }
    els.submitActivityBtn.disabled = !currentQuestions.length || isAttemptSubmitted(currentAttempt) || timerExpired;
    setStatus(currentQuestions.length ? "Activity loaded." : "Activity loaded, but no questions are available yet.", currentQuestions.length ? "good" : "warn");
  });
}

async function submitActivity() {
  if (!currentAttempt) {
    setStatus("Load an activity before submitting.", "warn");
    return;
  }
  if (timerExpired) {
    setStatus("The time limit has expired for this attempt.", "danger");
    return;
  }
  const responses = collectResponses();
  if (responses.length !== currentQuestions.length) {
    setStatus("Answer every question before submitting.", "warn");
    return;
  }

  await run("Submitting activity...", async () => {
    const result = await submitActivityAttempt({
      attemptId: currentAttempt.id,
      responses
    });
    currentAttempt = result.attempt;
    renderAttempt(currentActivityInstance || {});
    renderScore(result.score || {});
    clearCountdown();
    renderTimer("Submitted", "good");
    els.submitActivityBtn.disabled = true;
    setStatus("Activity submitted.", "good");
  });
}

async function run(message, action) {
  setBusy(true);
  setStatus(message, "");
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Unable to process activity.", "danger");
  } finally {
    setBusy(false);
  }
}

function renderAttempt(instance) {
  els.attemptMeta.innerHTML = "";
    els.attemptMeta.append(
      metaRow("Attempt", currentAttempt?.id || ""),
      metaRow("Attempt number", formatAttemptNumber(currentAttempt)),
      metaRow("Attempts remaining", formatAttemptsRemaining(currentAttempt)),
      metaRow("Status", labelize(currentAttempt?.status || "started")),
      metaRow("Deadline", formatDate(currentAttempt?.attempt_deadline_at)),
      metaRow("Window", formatWindow(instance.starts_at, instance.ends_at))
  );
  els.activityScore.textContent = "";
}

function renderQuestions(questions) {
  els.questionList.innerHTML = "";
  questions.forEach((question, index) => {
    const card = document.createElement("article");
    card.className = "activity-question";
    const title = document.createElement("h3");
    title.textContent = `${index + 1}. ${question.prompt}`;
    card.append(title);

    const options = document.createElement("div");
    options.className = "activity-options";
    (question.options || []).forEach((option) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question-${question.id}`;
      input.value = option.id;
      label.append(input, document.createTextNode(option.option_text));
      options.append(label);
    });
    card.append(options);
    els.questionList.append(card);
  });
}

function collectResponses() {
  return currentQuestions.map((question) => {
    const selected = document.querySelector(`input[name="question-${cssEscape(question.id)}"]:checked`);
    if (!selected) return null;
    return {
      question_id: question.id,
      selected_option_id: selected.value,
      response_json: {
        selected_option_id: selected.value
      }
    };
  }).filter(Boolean);
}

function renderScore(score) {
  const percent = typeof score.percent === "number" ? `${score.percent}%` : "Submitted";
  const points = score.total != null ? ` (${score.raw || 0}/${score.total})` : "";
  const speed = typeof score.speed_bonus === "number" && score.speed_bonus > 0 ? ` · Speed bonus +${score.speed_bonus}%` : "";
  const final = typeof score.final === "number" ? ` · Final ${score.final}%` : "";
  els.activityScore.textContent = `${percent}${points}${speed}${final}`;
}

function startCountdown(deadline) {
  clearCountdown();
  timerExpired = false;

  if (!deadline) {
    renderTimer("No time limit", "");
    return;
  }

  const deadlineTime = new Date(deadline).getTime();
  if (Number.isNaN(deadlineTime)) {
    renderTimer("No time limit", "");
    return;
  }

  const tick = () => {
    const remainingMs = deadlineTime - Date.now();
    if (remainingMs <= 0) {
      timerExpired = true;
      clearCountdown();
      renderTimer("Time expired", "danger");
      setBusy(false);
      return;
    }
    renderTimer(formatDuration(remainingMs), remainingMs <= 60000 ? "warn" : "good");
  };

  tick();
  countdownId = window.setInterval(tick, 1000);
}

function clearCountdown() {
  if (countdownId) {
    window.clearInterval(countdownId);
    countdownId = null;
  }
}

function renderTimer(value, tone) {
  els.activityTimer.textContent = `Time remaining: ${value}`;
  els.activityTimer.dataset.tone = tone || "";
}

function metaRow(label, value) {
  const row = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  row.append(strong, document.createTextNode(value || "Not set"));
  return row;
}

function setBusy(isBusy) {
  els.loadActivityBtn.disabled = isBusy;
  els.submitActivityBtn.disabled = isBusy || timerExpired || !currentQuestions.length || isAttemptSubmitted(currentAttempt);
}

function setStatus(message, tone) {
  els.activityStatus.textContent = message;
  els.activityStatus.dataset.tone = tone || "";
}

function formatWindow(start, end) {
  const startText = start ? new Date(start).toLocaleString() : "open";
  const endText = end ? new Date(end).toLocaleString() : "no close time";
  return `${startText} to ${endText}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "No time limit";
}

function formatAttemptNumber(attempt) {
  if (!attempt?.attempt_number) return "Not set";
  if (!attempt.allowed_attempts) return String(attempt.attempt_number);
  return `${attempt.attempt_number} of ${attempt.allowed_attempts}`;
}

function formatAttemptsRemaining(attempt) {
  if (attempt?.attempts_remaining == null) return "Not set";
  const label = Number(attempt.attempts_remaining) === 1 ? "attempt" : "attempts";
  return `${attempt.attempts_remaining} ${label}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isAttemptSubmitted(attempt) {
  return Boolean(attempt?.submitted_at) || ["submitted", "locked", "late"].includes(String(attempt?.status || ""));
}

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
