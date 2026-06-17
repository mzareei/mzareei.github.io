(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-05";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  const keyItems = [
    {
      prompt: "Anyone wants to send you a confidential message.",
      answer: "Use your public key to encrypt",
      why: "Your public key can be shared; only your private key should decrypt."
    },
    {
      prompt: "You want classmates to verify that a message really came from you.",
      answer: "Sign with your private key",
      why: "A signature is created with the private key and checked with the public key."
    },
    {
      prompt: "You receive a signed file from Bob and want to verify it.",
      answer: "Verify with Bob's public key",
      why: "Verification uses the sender's public key."
    }
  ];

  renderChoiceSet("modChoices", "modCorrect", [
    ["8", false, "Try reducing 125 by multiples of 23."],
    ["10", true, "Correct: 5^3 = 125, and 125 mod 23 = 10."],
    ["13", false, "Close-looking numbers are not enough; reduce the exponent result."],
    ["20", false, "That is not the remainder after division by 23."]
  ], "modFeedback");

  renderKeyChallenge();

  renderChoiceSet("dhChoices", "dhCorrect", [
    ["2", true, "Correct: 19^6 mod 23 = 2."],
    ["6", false, "That is Alice's private value, not the shared key."],
    ["8", false, "That is Alice's public value in this toy setup."],
    ["19", false, "That is Bob's public value before exponentiation."]
  ], "dhFeedback");

  renderChoiceSet("designChoices", "designCorrect", [
    ["Encrypt with your private key, sign with their public key", false, "Those roles are reversed."],
    ["Encrypt with their public key, sign with your private key", true, "Correct: confidentiality for them, authenticity from you."],
    ["Send the message and key together", false, "Sending the key with the message defeats confidentiality."],
    ["Use no signature if encryption is enabled", false, "Encryption and signatures solve different problems."]
  ], "designFeedback");

  updateScore();

  function renderKeyChallenge() {
    const choices = [
      "Use your public key to encrypt",
      "Sign with your private key",
      "Verify with Bob's public key",
      "Publish your private key"
    ];
    const container = document.getElementById("keyChallenge");
    container.innerHTML = "";
    keyItems.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "challenge";
      card.innerHTML = `<h3></h3><div class="choice-row"></div><p class="feedback" aria-live="polite"></p>`;
      card.querySelector("h3").textContent = item.prompt;
      const row = card.querySelector(".choice-row");
      const feedback = card.querySelector(".feedback");
      choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        button.textContent = choice;
        button.addEventListener("click", () => {
          const correct = choice === item.answer;
          state.keys[index] = correct;
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
      container.appendChild(card);
    });
  }

  function renderChoiceSet(containerId, stateKey, options, feedbackId) {
    const container = document.getElementById(containerId);
    const feedback = document.getElementById(feedbackId);
    container.innerHTML = "";
    options.forEach(([label, correct, why]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = label;
      button.addEventListener("click", () => {
        state[stateKey] = Boolean(correct);
        container.querySelectorAll(".choice").forEach((node) => node.classList.remove("is-correct", "is-wrong"));
        button.classList.add(correct ? "is-correct" : "is-wrong");
        feedback.textContent = why;
        feedback.dataset.tone = correct ? "good" : "warn";
        save();
        updateScore();
      });
      container.appendChild(button);
    });
  }

  function updateScore() {
    const score =
      (state.modCorrect ? 2 : 0) +
      Object.values(state.keys).filter(Boolean).length * 2 +
      (state.dhCorrect ? 1 : 0) +
      (state.designCorrect ? 1 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can explain how public/private keys support confidentiality, signatures, and shared secrets."
      : "Keep practicing: public keys are shared, private keys stay private, and the math creates a one-way path.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        modCorrect: Boolean(parsed.modCorrect),
        keys: parsed.keys || {},
        dhCorrect: Boolean(parsed.dhCorrect),
        designCorrect: Boolean(parsed.designCorrect)
      };
    } catch (_error) {
      return { modCorrect: false, keys: {}, dhCorrect: false, designCorrect: false };
    }
  }
})();
