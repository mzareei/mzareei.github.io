(function () {
  "use strict";

  const STORE_KEY = "tc2007b-bridge-04";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  renderChallenge("riskChallenge", "risk", [
    ["Student records endpoint accepts unauthenticated requests.", "Block", "A data exposure with no authentication should block release until fixed."],
    ["The dependency scanner reports a medium issue in a chart library not exposed to users.", "Fix soon", "It matters, but the limited exposure makes a planned fix reasonable."],
    ["Login page has missing autocomplete attributes but no credential exposure.", "Monitor", "This is worth improving, but it is not the main security blocker."]
  ], ["Block", "Fix soon", "Monitor"]);

  renderChallenge("defenseChallenge", "defenses", [
    ["SQL query built by joining strings with form input.", "Parameterized query", "Parameters keep input as data instead of executable SQL."],
    ["Comment text is rendered with innerHTML.", "Output encoding", "Untrusted text should be encoded or rendered as text."],
    ["Admin action can be called by any logged-in user.", "Server-side authorization", "The server must verify permission before the action runs."],
    ["Old package has a known remote-code-execution vulnerability.", "Patch or replace dependency", "Known dangerous dependencies should be updated, removed, or isolated."]
  ], ["Parameterized query", "Output encoding", "Server-side authorization", "Patch or replace dependency"]);

  renderChoiceSet("releaseChoices", "releaseCorrect", [
    ["Ship now and promise to patch after feedback.", false, "Shipping known student-data exposure creates avoidable harm."],
    ["Block release, fix authentication and authorization, then retest the critical path.", true, "Correct: high-risk access-control failures need repair and verification before release."],
    ["Hide the vulnerable page link but leave the endpoint running.", false, "Hidden links are not controls; attackers can call endpoints directly."],
    ["Ask users not to misuse the system.", false, "A policy reminder does not replace an enforced technical control."]
  ], "releaseFeedback");

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
    const score = Object.values(state.risk).filter(Boolean).length +
      Object.values(state.defenses).filter(Boolean).length +
      (state.releaseCorrect ? 3 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can explain which findings block release and which controls directly reduce app-security risk."
      : "Keep practicing: a good release decision weighs exploitability, impact, exposure, and the strength of the fix.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        risk: parsed.risk || {},
        defenses: parsed.defenses || {},
        releaseCorrect: Boolean(parsed.releaseCorrect)
      };
    } catch (_error) {
      return { risk: {}, defenses: {}, releaseCorrect: false };
    }
  }
})();
