(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-09";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  renderChallenge("alertChallenge", "alerts", [
    ["IDS alerts and investigation confirms malware beaconing.", "True positive", "The detector alerted and the attack was real."],
    ["IDS alerts on a normal backup transfer.", "False positive", "The detector alerted but the activity was benign."],
    ["No alert, but later forensics shows exfiltration.", "False negative", "The detector missed a real attack."],
    ["No alert and the traffic is normal.", "True negative", "The detector correctly stayed quiet."]
  ], ["True positive", "False positive", "False negative", "True negative"]);

  renderChallenge("approachChallenge", "approaches", [
    ["Known byte pattern from a documented malware family.", "Signature / misuse", "Signature detection matches known patterns."],
    ["A user suddenly downloads 50x their normal data volume at 3 AM.", "Anomaly", "Anomaly detection compares behavior to a baseline."],
    ["A fake SSH server records attacker commands.", "Honeypot", "Honeypots are decoy systems for observation."],
    ["An inline device blocks confirmed malicious traffic.", "IPS", "Intrusion prevention systems can actively block, not only alert."]
  ], ["Signature / misuse", "Anomaly", "Honeypot", "IPS"]);

  renderChoiceSet("baseRateChoices", "baseRateCorrect", [
    ["Tune rules, add context, prioritize high-risk assets, and correlate alerts", true, "Correct: improve signal quality and prioritize what analysts see."],
    ["Ignore all low confidence alerts forever", false, "Some low-confidence signals matter when correlated with context."],
    ["Alert on every packet", false, "That creates noise and burns analyst time."],
    ["Remove detection because false positives exist", false, "Detection is imperfect but essential as a second line of defense."]
  ], "baseRateFeedback");

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
    const score = Object.values(state.alerts).filter(Boolean).length +
      Object.values(state.approaches).filter(Boolean).length +
      (state.baseRateCorrect ? 2 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can reason about IDS results, detection methods, and alert prioritization."
      : "Keep practicing: every alert has an outcome, and every detector has tradeoffs.";
  }

  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return { alerts: parsed.alerts || {}, approaches: parsed.approaches || {}, baseRateCorrect: Boolean(parsed.baseRateCorrect) };
    } catch (_error) {
      return { alerts: {}, approaches: {}, baseRateCorrect: false };
    }
  }
})();
