(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-01";
  const ciaItems = [
    {
      prompt: "A password file is posted publicly after a breach.",
      answer: "Confidentiality",
      why: "The secret was disclosed to people who should not see it."
    },
    {
      prompt: "An attacker changes a student's grade in the database.",
      answer: "Integrity",
      why: "The record was modified without authorization."
    },
    {
      prompt: "The campus login page is unreachable during exam week.",
      answer: "Availability",
      why: "The service cannot be used when people need it."
    }
  ];
  const attackItems = [
    {
      prompt: "A message pretends to be from IT and asks students to enter their password in a fake form.",
      answer: "Phishing",
      why: "The attack mainly tricks the person into giving up information."
    },
    {
      prompt: "An email forges the sender address so it appears to come from the professor.",
      answer: "Spoofing",
      why: "The attack mainly disguises the source."
    },
    {
      prompt: "A fake bank text uses a realistic sender name and a link to harvest credentials.",
      answer: "Phishing",
      why: "Spoofing may help deliver it, but the main objective is credential retrieval."
    }
  ];
  const responseItems = [
    ["Prevention", "Reduce the chance it happens."],
    ["Detection", "Notice it quickly."],
    ["Response", "Contain the damage."],
    ["Recovery", "Restore service and improve."]
  ];

  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const ciaChallenge = document.getElementById("ciaChallenge");
  const attackChallenge = document.getElementById("attackChallenge");
  const responseBoard = document.getElementById("responseBoard");
  const responseStatus = document.getElementById("responseStatus");
  const completionPanel = document.getElementById("completionPanel");
  const debriefText = document.getElementById("debriefText");

  renderChoiceChallenges(ciaChallenge, "cia", ciaItems, ["Confidentiality", "Integrity", "Availability"]);
  renderChoiceChallenges(attackChallenge, "attacks", attackItems, ["Phishing", "Spoofing"]);
  renderResponseBoard();
  bindThreatModel();
  bindReset();
  updateChrome();

  function renderChoiceChallenges(container, step, items, choices) {
    container.innerHTML = "";
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "challenge";
      card.innerHTML = `
        <h3></h3>
        <div class="choice-row"></div>
        <p class="feedback" aria-live="polite"></p>
      `;
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
          state.answers[`${step}-${index}`] = { correct, choice };
          row.querySelectorAll(".choice").forEach((node) => {
            node.classList.remove("is-correct", "is-wrong");
            if (node.textContent === item.answer) node.classList.add("is-correct");
          });
          if (!correct) button.classList.add("is-wrong");
          feedback.textContent = item.why;
          feedback.dataset.tone = correct ? "good" : "warn";
          saveAndUpdate();
        });
        row.appendChild(button);
      });

      const saved = state.answers[`${step}-${index}`];
      if (saved) {
        row.querySelectorAll(".choice").forEach((node) => {
          if (node.textContent === item.answer) node.classList.add("is-correct");
          if (!saved.correct && node.textContent === saved.choice) node.classList.add("is-wrong");
        });
        feedback.textContent = item.why;
        feedback.dataset.tone = saved.correct ? "good" : "warn";
      }
      container.appendChild(card);
    });
  }

  function bindThreatModel() {
    document.getElementById("buildModelBtn").addEventListener("click", () => {
      const asset = document.getElementById("assetSelect").value;
      const threat = document.getElementById("threatSelect").value;
      const impact = document.getElementById("impactSelect").value;
      const output = document.getElementById("modelOutput");
      if (!asset || !threat || !impact) {
        output.textContent = "Choose an asset, threat, and CIA impact.";
        return;
      }
      state.model = { asset, threat, impact };
      output.innerHTML = `<strong>Security problem:</strong> ${asset} has value, and ${threat} could harm ${impact}. A defender should reduce either the likelihood of the threat or the damage to the asset.`;
      saveAndUpdate();
    });

    if (state.model) {
      document.getElementById("assetSelect").value = state.model.asset;
      document.getElementById("threatSelect").value = state.model.threat;
      document.getElementById("impactSelect").value = state.model.impact;
      document.getElementById("modelOutput").innerHTML = `<strong>Security problem:</strong> ${state.model.asset} has value, and ${state.model.threat} could harm ${state.model.impact}. A defender should reduce either the likelihood of the threat or the damage to the asset.`;
    }
  }

  function renderResponseBoard() {
    responseBoard.innerHTML = "";
    const savedOrder = state.responseOrder || [];
    responseItems.forEach(([label, sub]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "response-token";
      button.dataset.value = label;
      button.innerHTML = `${label}<small>${sub}</small>`;
      if (savedOrder.includes(label)) {
        button.classList.add("is-selected");
        button.style.order = savedOrder.indexOf(label) + 1;
      }
      button.addEventListener("click", () => {
        state.responseOrder = state.responseOrder || [];
        if (state.responseOrder.includes(label)) {
          state.responseOrder = state.responseOrder.filter((item) => item !== label);
          button.classList.remove("is-selected");
          button.style.order = "";
        } else {
          state.responseOrder.push(label);
          button.classList.add("is-selected");
          button.style.order = state.responseOrder.length;
        }
        responseStatus.textContent = state.responseOrder.join(" -> ");
        responseStatus.dataset.tone = "";
        saveAndUpdate();
      });
      responseBoard.appendChild(button);
    });

    document.getElementById("checkResponseBtn").addEventListener("click", () => {
      const order = (state.responseOrder || []).join("|");
      const correct = responseItems.map(([label]) => label).join("|");
      state.responseCorrect = order === correct;
      responseStatus.textContent = state.responseCorrect
        ? "Correct: prevention -> detection -> response -> recovery."
        : "Try again. Think: stop it, notice it, contain it, restore.";
      responseStatus.dataset.tone = state.responseCorrect ? "good" : "warn";
      saveAndUpdate();
    });
    if (savedOrder.length) responseStatus.textContent = savedOrder.join(" -> ");
  }

  function bindReset() {
    document.getElementById("resetMissionBtn").addEventListener("click", () => {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    });
  }

  function updateChrome() {
    const correctAnswers = Object.values(state.answers).filter((answer) => answer.correct).length;
    const modelPoints = state.model ? 2 : 0;
    const responsePoints = state.responseCorrect ? 2 : 0;
    const total = correctAnswers + modelPoints + responsePoints;
    scoreValue.textContent = total;

    setStepComplete("cia", ciaItems.every((_, index) => state.answers[`cia-${index}`]));
    setStepComplete("attacks", attackItems.every((_, index) => state.answers[`attacks-${index}`]));
    setStepComplete("model", Boolean(state.model));
    setStepComplete("response", Boolean(state.responseCorrect));

    const completed = document.querySelectorAll(".map-step.is-complete").length;
    if (completed === 4) {
      debriefText.textContent = `You completed the mission with ${total}/10 points. Your next move is the live quiz or a short discussion of which checkpoint felt least obvious.`;
    } else {
      debriefText.textContent = `You have completed ${completed}/4 checkpoints.`;
    }
  }

  function setStepComplete(step, complete) {
    const link = document.querySelector(`[data-step-link="${step}"]`);
    if (link) link.classList.toggle("is-complete", complete);
  }

  function saveAndUpdate() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    updateChrome();
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        answers: parsed.answers || {},
        model: parsed.model || null,
        responseOrder: parsed.responseOrder || [],
        responseCorrect: Boolean(parsed.responseCorrect)
      };
    } catch (_error) {
      return { answers: {}, model: null, responseOrder: [], responseCorrect: false };
    }
  }
})();
