(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-08";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  renderChallenge("packetChallenge", "packets", [
    ["Internet -> public web server, TCP 443", "Allow", "Public HTTPS is expected traffic to the web server."],
    ["Internet -> database server, TCP 5432", "Deny", "The database should not be directly reachable from the Internet."],
    ["Internal admin subnet -> firewall management, TCP 22", "Allow with restriction", "Management can be allowed only from a tightly scoped admin source."],
    ["Any -> any, all ports", "Deny", "Default allow defeats the policy; use least privilege."]
  ], ["Allow", "Deny", "Allow with restriction", "Log only"]);

  renderChallenge("firewallChallenge", "types", [
    ["Tracks established TCP sessions and allows return traffic.", "Stateful firewall", "Stateful inspection remembers connection state."],
    ["Inspects HTTP requests for SQL injection and XSS patterns.", "WAF", "A web application firewall understands web-layer behavior."],
    ["Runs on a laptop and controls local application connections.", "Host firewall", "Host firewalls protect an individual machine."],
    ["Combines app awareness, user identity, and threat intelligence.", "NGFW", "Next-generation firewalls add context beyond simple port filtering."]
  ], ["Packet filter", "Stateful firewall", "WAF", "Host firewall", "NGFW"]);

  renderChoiceSet("dmzChoices", "dmzCorrect", [
    ["Put the public web server in a DMZ between external and internal firewalls", true, "Correct: expose only the service that must be public and isolate it from the internal network."],
    ["Put the database directly on the Internet", false, "The database belongs behind stricter internal controls."],
    ["Put every employee laptop in the DMZ", false, "The DMZ is for exposed services, not general internal endpoints."],
    ["Remove the firewall after deploying TLS", false, "TLS protects traffic contents; it does not replace boundary policy enforcement."]
  ], "dmzFeedback");

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
    const score = Object.values(state.packets).filter(Boolean).length +
      Object.values(state.types).filter(Boolean).length +
      (state.dmzCorrect ? 2 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can map policy to firewall rules and choose the right network defense layer."
      : "Keep practicing: ask what boundary is crossed, what traffic is needed, and what should be denied by default.";
  }

  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return { packets: parsed.packets || {}, types: parsed.types || {}, dmzCorrect: Boolean(parsed.dmzCorrect) };
    } catch (_error) {
      return { packets: {}, types: {}, dmzCorrect: false };
    }
  }
})();
