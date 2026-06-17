(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-06";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  renderChallenge("protocolChallenge", "protocol", [
    ["Nonce included in the signed message", "Freshness / anti-replay", "A nonce helps prove this message is not an old replay."],
    ["Identity labels included in both directions", "Prevents reflection confusion", "Direction and identity labels stop one message from being valid in the opposite direction."],
    ["Session key created after authentication", "Limits future exposure", "Session keys reduce how much long-term secret material is used."]
  ], ["Freshness / anti-replay", "Prevents reflection confusion", "Limits future exposure", "Compresses the packet"]);

  renderChallenge("hashChallenge", "hash", [
    ["Detect an accidental file change", "Second preimage resistance", "The attacker should not find a different file with the same hash."],
    ["Stop attackers from creating any two signed documents with the same digest", "Collision resistance", "Collision resistance blocks two different messages sharing a digest."],
    ["Store a message fingerprint without revealing the original message", "Preimage resistance", "Preimage resistance makes it hard to reverse a digest."]
  ], ["Preimage resistance", "Second preimage resistance", "Collision resistance", "Key exchange"]);

  renderChoiceSet("hmacChoices", "hmacCorrect", [
    ["Send SHA-256(message) with the request", false, "A plain hash has no secret, so anyone can recompute it."],
    ["Send HMAC(secret, message) with a nonce", true, "Correct: the secret authenticates the message, and the nonce helps with freshness."],
    ["Encrypt the timestamp with no integrity check", false, "Encryption alone does not prove the whole message was authorized."],
    ["Use MD5 because it is short", false, "MD5 is broken for collision resistance and is not a message-authentication design."]
  ], "hmacFeedback");

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
    const score = Object.values(state.protocol).filter(Boolean).length * 2 +
      Object.values(state.hash).filter(Boolean).length +
      (state.hmacCorrect ? 1 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can explain why secure protocols need freshness, direction, integrity, and authenticated keys."
      : "Keep practicing: ask what each message proves, to whom, and why it cannot be replayed.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return { protocol: parsed.protocol || {}, hash: parsed.hash || {}, hmacCorrect: Boolean(parsed.hmacCorrect) };
    } catch (_error) {
      return { protocol: {}, hash: {}, hmacCorrect: false };
    }
  }
})();
