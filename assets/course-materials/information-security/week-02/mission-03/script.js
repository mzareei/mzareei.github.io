(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-03";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const modelChallenge = document.getElementById("modelChallenge");
  const permissionMatrix = document.getElementById("permissionMatrix");
  const matrixStatus = document.getElementById("matrixStatus");
  const policyOutput = document.getElementById("policyOutput");
  const debriefText = document.getElementById("debriefText");

  const modelItems = [
    {
      prompt: "A file owner decides who can read or edit their shared document.",
      answer: "DAC",
      why: "Discretionary access control lets the owner decide."
    },
    {
      prompt: "A military document marked Secret cannot be read by a user cleared only for Confidential.",
      answer: "MAC",
      why: "Mandatory access control enforces labels and clearances."
    },
    {
      prompt: "Teaching assistants can grade labs, but students cannot.",
      answer: "RBAC",
      why: "Role-based access control grants permissions through roles."
    },
    {
      prompt: "Access is allowed only from campus, during exam week, for the enrolled student.",
      answer: "ABAC",
      why: "Attribute-based access control uses attributes and context."
    }
  ];
  const subjects = ["Student", "TA", "Professor"];
  const objects = ["View own grade", "Edit grade", "Export roster", "Change policy"];
  const allowed = new Set(["Student|View own grade", "TA|View own grade", "TA|Edit grade", "Professor|View own grade", "Professor|Edit grade", "Professor|Export roster", "Professor|Change policy"]);
  const policyPairs = {
    "Only teaching staff can change grades": "role checks on grade update endpoint",
    "Students can see only their own records": "row-level access filter by student id",
    "Admins need MFA for privileged actions": "step-up authentication before admin action"
  };

  renderModelChallenge();
  renderMatrix();
  bindPolicy();
  updateScore();

  function renderModelChallenge() {
    const choices = ["DAC", "MAC", "RBAC", "ABAC"];
    modelChallenge.innerHTML = "";
    modelItems.forEach((item, index) => {
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
          state.models[index] = correct;
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
      modelChallenge.appendChild(card);
    });
  }

  function renderMatrix() {
    permissionMatrix.innerHTML = "";
    const head = document.createElement("div");
    head.className = "matrix-row";
    head.innerHTML = `<div class="matrix-cell matrix-cell--head">Subject</div>${objects.map((object) => `<div class="matrix-cell matrix-cell--head">${object}</div>`).join("")}`;
    permissionMatrix.appendChild(head);

    subjects.forEach((subject) => {
      const row = document.createElement("div");
      row.className = "matrix-row";
      row.innerHTML = `<div class="matrix-cell">${subject}</div>`;
      objects.forEach((object) => {
        const key = `${subject}|${object}`;
        const label = document.createElement("label");
        label.className = "matrix-check";
        label.innerHTML = `<input type="checkbox">`;
        label.querySelector("input").checked = Boolean(state.matrix[key]);
        label.querySelector("input").addEventListener("change", (event) => {
          state.matrix[key] = event.target.checked;
          save();
        });
        row.appendChild(label);
      });
      permissionMatrix.appendChild(row);
    });

    document.getElementById("checkMatrixBtn").addEventListener("click", () => {
      let correct = 0;
      let total = 0;
      permissionMatrix.querySelectorAll(".matrix-check").forEach((label, index) => {
        const subject = subjects[Math.floor(index / objects.length)];
        const object = objects[index % objects.length];
        const key = `${subject}|${object}`;
        const checked = label.querySelector("input").checked;
        const should = allowed.has(key);
        label.classList.toggle("is-correct", checked === should);
        label.classList.toggle("is-wrong", checked !== should);
        correct += checked === should ? 1 : 0;
        total += 1;
      });
      state.matrixScore = correct;
      matrixStatus.textContent = `${correct}/${total} decisions match least privilege.`;
      matrixStatus.dataset.tone = correct === total ? "good" : "warn";
      save();
      updateScore();
    });
  }

  function bindPolicy() {
    document.getElementById("checkPolicyBtn").addEventListener("click", () => {
      const policy = document.getElementById("policySelect").value;
      const mechanism = document.getElementById("mechanismSelect").value;
      if (!policy || !mechanism) {
        policyOutput.textContent = "Choose both a policy goal and a mechanism.";
        return;
      }
      state.policyCorrect = policyPairs[policy] === mechanism;
      policyOutput.textContent = state.policyCorrect
        ? "Good pairing: the mechanism directly enforces the policy."
        : "Try again: match the rule to the technical enforcement point.";
      save();
      updateScore();
    });
  }

  function updateScore() {
    const modelScore = Object.values(state.models).filter(Boolean).length;
    const matrixScore = Math.round((Number(state.matrixScore || 0) / 12) * 4);
    const policyScore = state.policyCorrect ? 2 : 0;
    const score = modelScore + matrixScore + policyScore;
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can now explain access control as a chain from policy to enforcement."
      : "Keep practicing: access control is about smallest sufficient permission.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return { models: parsed.models || {}, matrix: parsed.matrix || {}, matrixScore: parsed.matrixScore || 0, policyCorrect: Boolean(parsed.policyCorrect) };
    } catch (_error) {
      return { models: {}, matrix: {}, matrixScore: 0, policyCorrect: false };
    }
  }
})();
