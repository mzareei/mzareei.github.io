(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-07";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  const triage = [
    ["Disconnect the machine from the network", true],
    ["Preserve evidence and note timestamps", true],
    ["Check backups before restoring", true],
    ["Pay immediately before investigating", false],
    ["Keep using the machine for class work", false]
  ];

  renderChallenge("malwareChallenge", "classes", [
    ["Spreads by scanning the network and exploiting vulnerable hosts.", "Worm", "Worms self-propagate across networks."],
    ["Hides privileged persistence and tries to conceal other malware.", "Rootkit", "Rootkits hide presence and maintain privileged control."],
    ["Encrypts files and demands payment.", "Ransomware", "Ransomware denies access and demands payment."],
    ["Uses many compromised machines to receive commands from an operator.", "Botnet", "Botnets coordinate compromised machines under command and control."]
  ], ["Virus", "Worm", "Rootkit", "Ransomware", "Botnet"]);
  renderTriage();
  renderChoiceSet("countermeasureChoices", "countermeasureCorrect", [
    ["EDR plus least privilege, backups, patching, and user training", true, "Correct: malware defense needs layered prevention, detection, and recovery."],
    ["Only antivirus signatures", false, "Signatures help, but modern malware often needs behavior detection and hardening."],
    ["Disable backups to save space", false, "Backups are central to recovery, especially for ransomware."],
    ["Give all users admin rights", false, "That increases blast radius."]
  ], "countermeasureFeedback");
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

  function renderTriage() {
    const list = document.getElementById("triageList");
    list.innerHTML = "";
    triage.forEach(([label], index) => {
      const row = document.createElement("label");
      row.className = "fix-option";
      row.innerHTML = `<input type="checkbox"><span></span>`;
      const input = row.querySelector("input");
      input.checked = Boolean(state.triage[index]);
      input.addEventListener("change", () => {
        state.triage[index] = input.checked;
        save();
      });
      row.querySelector("span").textContent = label;
      list.appendChild(row);
    });
    document.getElementById("checkTriageBtn").addEventListener("click", () => {
      let correct = 0;
      triage.forEach(([, expected], index) => {
        const row = list.children[index];
        const matched = Boolean(state.triage[index]) === expected;
        row.classList.toggle("is-correct", matched);
        row.classList.toggle("is-wrong", !matched);
        correct += matched ? 1 : 0;
      });
      state.triageScore = correct;
      const status = document.getElementById("triageStatus");
      status.textContent = `${correct}/${triage.length} triage decisions are sound.`;
      status.dataset.tone = correct === triage.length ? "good" : "warn";
      save();
      updateScore();
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
    const score = Object.values(state.classes).filter(Boolean).length +
      Math.round((Number(state.triageScore || 0) / triage.length) * 4) +
      (state.countermeasureCorrect ? 2 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can classify malware behavior and choose containment before recovery."
      : "Keep practicing: identify behavior first, contain quickly, preserve evidence, then recover safely.";
  }

  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return { classes: parsed.classes || {}, triage: parsed.triage || {}, triageScore: parsed.triageScore || 0, countermeasureCorrect: Boolean(parsed.countermeasureCorrect) };
    } catch (_error) {
      return { classes: {}, triage: {}, triageScore: 0, countermeasureCorrect: false };
    }
  }
})();
