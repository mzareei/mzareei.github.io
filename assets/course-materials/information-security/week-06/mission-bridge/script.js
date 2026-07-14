(function () {
  "use strict";

  const STORE_KEY = "tc2007b-bridge-06";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  renderChallenge("modeChallenge", "modes", [
    ["Encrypt database backups and detect tampering.", "Authenticated encryption", "Authenticated encryption protects confidentiality and detects modification."],
    ["Hash passwords for storage after account creation.", "Slow salted password hash", "Password storage needs slow guessing resistance, not fast general hashing."],
    ["Encrypt many files with visible repeated blocks.", "Avoid ECB mode", "ECB leaks patterns because equal plaintext blocks create equal ciphertext blocks."],
    ["Send a short random session key to someone using their public key.", "Hybrid encryption", "Public-key crypto is commonly used to protect a symmetric session key."],
    ["Encrypt a large bitmap image so its outline and repeated colors are not visible in the ciphertext.", "Avoid ECB mode", "ECB's identical-block-to-identical-block behavior famously leaks image patterns, as in the classic 'ECB penguin' example."]
  ], ["Authenticated encryption", "Slow salted password hash", "Avoid ECB mode", "Hybrid encryption"]);

  renderChallenge("keyChallenge", "keys", [
    ["Store production encryption keys in the same public repository as code.", "Weakens the system", "A leaked key can expose every ciphertext protected by it."],
    ["Rotate a key after evidence that it was copied.", "Protects the system", "Rotation limits future damage after compromise."],
    ["Use a key-management service with access logs and role checks.", "Protects the system", "Central key management can enforce access control and auditing."],
    ["Email a symmetric encryption key to a teammate in plain text so they can open a file.", "Weakens the system", "Plaintext channels such as email or chat expose the key to anyone who can read the message, in transit or in storage."]
  ], ["Protects the system", "Weakens the system"]);

  renderChoiceSet("nonceChoices", "nonceCorrect", [
    ["Reuse the nonce again because only the key matters.", false, "Many modern modes require unique nonces under the same key."],
    ["Treat affected ciphertexts as exposed, rotate the key, re-encrypt with fresh nonces, and review the generator.", true, "Correct: nonce reuse can reveal relationships between plaintexts and needs repair plus root-cause analysis."],
    ["Delete the logs so attackers cannot learn the nonce.", false, "The nonce is usually not secret; reuse is the actual problem."],
    ["Switch to a shorter nonce to make collisions easier to count.", false, "Shorter nonces increase collision risk."]
  ], "nonceFeedback");

  updateScore();

  function renderChallenge(containerId, stateKey, rows, choices) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    rows.forEach(([prompt, answer, why], index) => {
      const card = document.createElement("article");
      card.className = "challenge";
      card.innerHTML = `<h3></h3><div class="choice-row"></div><p class="feedback" aria-live="polite"></p>`;
      card.querySelector("h3").textContent = prompt;
      const row = card.querySelector(".choice-row");
      const feedback = card.querySelector(".feedback");
      choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        button.textContent = choice;
        button.addEventListener("click", () => {
          const correct = choice === answer;
          state[stateKey][index] = correct;
          row.querySelectorAll(".choice").forEach((node) => {
            node.classList.remove("is-correct", "is-wrong");
            if (node.textContent === answer) node.classList.add("is-correct");
          });
          if (!correct) button.classList.add("is-wrong");
          feedback.textContent = why;
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
    const score = Object.values(state.modes).filter(Boolean).length +
      Object.values(state.keys).filter(Boolean).length +
      (state.nonceCorrect ? 3 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can separate confidentiality, integrity, password storage, mode choice, and key-management risk."
      : "Keep practicing: strong cryptography still depends on safe modes, unique nonces, and protected keys.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        modes: parsed.modes || {},
        keys: parsed.keys || {},
        nonceCorrect: Boolean(parsed.nonceCorrect)
      };
    } catch (_error) {
      return { modes: {}, keys: {}, nonceCorrect: false };
    }
  }
})();
