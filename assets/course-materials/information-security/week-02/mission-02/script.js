(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-02";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const lengthInput = document.getElementById("lengthInput");
  const charsetSelect = document.getElementById("charsetSelect");
  const rateSelect = document.getElementById("rateSelect");
  const passwordOutput = document.getElementById("passwordOutput");
  const storageChoices = document.getElementById("storageChoices");
  const storageFeedback = document.getElementById("storageFeedback");
  const mfaChallenge = document.getElementById("mfaChallenge");
  const debriefText = document.getElementById("debriefText");

  const storageOptions = [
    ["Plain text passwords", false, "A leak immediately exposes every password."],
    ["Fast unsalted hashes", false, "Attackers can test guesses quickly and reuse tables."],
    ["Slow salted password hashes", true, "A unique salt and slow password hash make large-scale cracking much harder."]
  ];
  const mfaItems = [
    {
      prompt: "A student logs in from a new country during exam week.",
      answer: "Authenticator app",
      why: "A time-based app code is stronger than only another password."
    },
    {
      prompt: "An administrator accesses grade export tools.",
      answer: "Hardware security key",
      why: "High-privilege actions deserve phishing-resistant MFA when possible."
    },
    {
      prompt: "A public kiosk asks for account recovery.",
      answer: "Deny and verify later",
      why: "Recovery from an untrusted device is high risk."
    }
  ];

  bindPasswordLab();
  renderStorageChoices();
  renderMfaChallenge();
  updateScore();

  function bindPasswordLab() {
    [lengthInput, charsetSelect, rateSelect].forEach((input) => {
      input.addEventListener("input", () => {
        state.passwordTouched = true;
        save();
        renderPasswordEstimate();
      });
    });
    renderPasswordEstimate();
  }

  function renderPasswordEstimate() {
    const length = Number(lengthInput.value);
    const charset = Number(charsetSelect.value);
    const rate = Number(rateSelect.value);
    const bits = Math.log2(charset) * length;
    const seconds = Math.pow(2, bits - 1) / rate;
    passwordOutput.innerHTML = `<strong>${length} characters</strong> with this character set is about <strong>${Math.round(bits)} bits</strong>. At this guessing rate, average brute force time is roughly <strong>${formatDuration(seconds)}</strong>.`;
    updateScore();
  }

  function renderStorageChoices() {
    storageChoices.innerHTML = "";
    storageOptions.forEach(([label, correct, why]) => {
      const button = document.createElement("button");
      button.className = "choice";
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        state.storageCorrect = correct;
        storageChoices.querySelectorAll(".choice").forEach((node) => {
          node.classList.remove("is-correct", "is-wrong");
          if (node.textContent === "Slow salted password hashes") node.classList.add("is-correct");
        });
        if (!correct) button.classList.add("is-wrong");
        storageFeedback.textContent = why;
        storageFeedback.dataset.tone = correct ? "good" : "warn";
        save();
        updateScore();
      });
      storageChoices.appendChild(button);
    });
  }

  function renderMfaChallenge() {
    const choices = ["SMS code", "Authenticator app", "Hardware security key", "Deny and verify later"];
    mfaChallenge.innerHTML = "";
    mfaItems.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "challenge";
      card.innerHTML = `<h3></h3><div class="choice-row"></div><p class="feedback" aria-live="polite"></p>`;
      card.querySelector("h3").textContent = item.prompt;
      const row = card.querySelector(".choice-row");
      const feedback = card.querySelector(".feedback");
      choices.forEach((choice) => {
        const button = document.createElement("button");
        button.className = "choice";
        button.type = "button";
        button.textContent = choice;
        button.addEventListener("click", () => {
          const correct = choice === item.answer;
          state.mfa[index] = correct;
          row.querySelectorAll(".choice").forEach((node) => {
            node.classList.remove("is-correct", "is-wrong");
            if (node.textContent === item.answer) node.classList.add("is-correct");
          });
          if (!correct) button.classList.add("is-wrong");
          feedback.textContent = item.why;
          feedback.dataset.tone = correct ? "good" : "warn";
          save();
          updateScore();
        });
        row.appendChild(button);
      });
      mfaChallenge.appendChild(card);
    });
  }

  function updateScore() {
    const score =
      (state.passwordTouched ? 2 : 0) +
      (state.storageCorrect ? 3 : 0) +
      Object.values(state.mfa || {}).filter(Boolean).length;
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can now defend stronger authentication choices with evidence."
      : "Keep going: the strongest designs combine usability, storage safety, and risk-based MFA.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return { passwordTouched: Boolean(parsed.passwordTouched), storageCorrect: Boolean(parsed.storageCorrect), mfa: parsed.mfa || {} };
    } catch (_error) {
      return { passwordTouched: false, storageCorrect: false, mfa: {} };
    }
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "less than a second";
    const units = [
      ["year", 31557600],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
      ["second", 1]
    ];
    const [name, size] = units.find(([, size]) => seconds >= size) || ["second", 1];
    const value = Math.max(1, Math.round(seconds / size));
    return `${value.toLocaleString()} ${name}${value === 1 ? "" : "s"}`;
  }
})();
