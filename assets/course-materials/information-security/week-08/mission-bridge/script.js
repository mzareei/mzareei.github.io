(function () {
  "use strict";

  const STORE_KEY = "tc2007b-bridge-08";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const debriefText = document.getElementById("debriefText");

  renderChallenge("certChallenge", "certs", [
    ["The certificate is valid but issued for portal.example.com while you are visiting bank.example.com.", "Identity failure", "The browser cannot prove this is the intended site."],
    ["The certificate expired yesterday.", "Freshness / validity failure", "The certificate is outside the time window where it should be trusted."],
    ["The certificate chain ends at an authority the device does not trust.", "Issuer trust failure", "A chain must lead to a trusted authority or configured trust anchor."],
    ["The certificate is valid, current, and matches the hostname.", "Trust checks pass", "That does not guarantee the app is bug-free, but the channel identity checks pass."]
  ], ["Identity failure", "Freshness / validity failure", "Issuer trust failure", "Trust checks pass"]);

  renderChallenge("channelChallenge", "channels", [
    ["Protect a web login from passive network sniffing.", "HTTPS / TLS", "TLS encrypts the connection and authenticates the site."],
    ["Give a remote worker encrypted access to internal-only services.", "VPN or zero-trust access gateway", "Remote private access needs authenticated encrypted access into a protected environment."],
    ["Stop a browser from silently falling back to HTTP.", "HSTS", "HSTS tells browsers to use HTTPS only for that site."],
    ["Restrict which public certificate authorities can issue for a domain.", "Certificate transparency and monitoring", "Monitoring public logs helps catch unexpected certificates."]
  ], ["HTTPS / TLS", "VPN or zero-trust access gateway", "HSTS", "Certificate transparency and monitoring"]);

  renderChoiceSet("downgradeChoices", "downgradeCorrect", [
    ["It is safe if the page still looks correct.", false, "Visual appearance does not prove confidentiality or authenticity."],
    ["It is an active channel attack; stop sending credentials and restore HTTPS-only behavior.", true, "Correct: downgrade attacks remove the protections students expect from TLS."],
    ["It only affects availability, not secrecy.", false, "HTTP exposes credentials and content to interception or modification."],
    ["It is solved by using a longer password.", false, "A strong password still leaks if submitted over a compromised channel."]
  ], "downgradeFeedback");

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
    const score = Object.values(state.certs).filter(Boolean).length +
      Object.values(state.channels).filter(Boolean).length +
      (state.downgradeCorrect ? 2 : 0);
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You can explain why secure channels need encryption, endpoint authentication, valid certificates, and downgrade resistance."
      : "Keep practicing: TLS is not only encryption; it is also identity, validity, and refusal to fall back to unsafe channels.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        certs: parsed.certs || {},
        channels: parsed.channels || {},
        downgradeCorrect: Boolean(parsed.downgradeCorrect)
      };
    } catch (_error) {
      return { certs: {}, channels: {}, downgradeCorrect: false };
    }
  }
})();
