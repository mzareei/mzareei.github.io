(function () {
  "use strict";

  const STORE_KEY = "tc2007b-mission-04";
  const state = readState();
  const scoreValue = document.getElementById("scoreValue");
  const payloadGrid = document.getElementById("payloadGrid");
  const unsafeQuery = document.getElementById("unsafeQuery");
  const safeQuery = document.getElementById("safeQuery");
  const sqliStatus = document.getElementById("sqliStatus");
  const fixList = document.getElementById("fixList");
  const fixStatus = document.getElementById("fixStatus");
  const xssPayload = document.getElementById("xssPayload");
  const xssChoices = document.getElementById("xssChoices");
  const xssFeedback = document.getElementById("xssFeedback");
  const boundaryChoices = document.getElementById("boundaryChoices");
  const boundaryFeedback = document.getElementById("boundaryFeedback");
  const debriefText = document.getElementById("debriefText");

  const payloads = [
    {
      id: "normal",
      label: "Normal attempt",
      username: "student",
      password: "wrong-password",
      bypass: false,
      why: "No injected SQL appears, so the password check still matters."
    },
    {
      id: "or_true",
      label: "Always-true condition",
      username: "student' OR '1'='1' --",
      password: "anything",
      bypass: true,
      why: "The OR condition can make the WHERE clause true, and the comment can remove the password check."
    },
    {
      id: "comment_cut",
      label: "Comment out password",
      username: "admin' --",
      password: "anything",
      bypass: true,
      why: "The comment marker can cut off the rest of an unsafe string-built query."
    }
  ];
  const fixes = [
    {
      id: "params",
      title: "Use parameterized queries",
      body: "The database receives input as data, not executable SQL.",
      correct: true
    },
    {
      id: "server_validation",
      title: "Validate on the server",
      body: "Reject impossible usernames and malformed fields before the query.",
      correct: true
    },
    {
      id: "least_privilege",
      title: "Limit database account privileges",
      body: "The app account should not own tables or perform admin actions.",
      correct: true
    },
    {
      id: "client_only",
      title: "Only validate in the browser",
      body: "Attackers can bypass the browser and call the API directly.",
      correct: false
    },
    {
      id: "hide_errors",
      title: "Hide detailed error messages",
      body: "Helpful, but it does not fix the injection vulnerability.",
      correct: false
    }
  ];
  const xssOptions = [
    {
      id: "inner_html",
      label: "Insert with innerHTML",
      correct: false,
      feedback: "Dangerous for untrusted comments: the browser may interpret markup as code."
    },
    {
      id: "text_content",
      label: "Insert with textContent",
      correct: true,
      feedback: "Correct: the browser renders the comment as text, not HTML."
    },
    {
      id: "strip_script",
      label: "Remove only script tags",
      correct: false,
      feedback: "Too narrow: XSS can hide in attributes, links, SVG, and many other places."
    }
  ];
  const boundaryOptions = [
    {
      id: "browser",
      label: "Browser form only",
      correct: false,
      feedback: "The browser is outside your trust boundary; attackers can skip it."
    },
    {
      id: "api_db",
      label: "API plus database constraints",
      correct: true,
      feedback: "Correct: enforce business rules on the server and preserve integrity in the database."
    },
    {
      id: "after_store",
      label: "Clean it after saving",
      correct: false,
      feedback: "Too late: unsafe data may already have triggered behavior or corrupted records."
    }
  ];

  let selectedPayload = payloads.find((payload) => payload.id === state.selectedPayload) || payloads[0];

  renderPayloads();
  renderQueries();
  renderFixes();
  renderXss();
  renderBoundary();
  updateScore();

  document.getElementById("bypassYesBtn").addEventListener("click", () => answerSqli(true));
  document.getElementById("bypassNoBtn").addEventListener("click", () => answerSqli(false));
  document.getElementById("checkFixesBtn").addEventListener("click", checkFixes);

  function renderPayloads() {
    payloadGrid.innerHTML = "";
    payloads.forEach((payload) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "payload-card";
      button.innerHTML = "<strong></strong><code></code>";
      button.querySelector("strong").textContent = payload.label;
      button.querySelector("code").textContent = payload.username;
      button.classList.toggle("is-active", payload.id === selectedPayload.id);
      button.addEventListener("click", () => {
        selectedPayload = payload;
        state.selectedPayload = payload.id;
        save();
        renderPayloads();
        renderQueries();
        sqliStatus.textContent = "";
      });
      payloadGrid.appendChild(button);
    });
  }

  function renderQueries() {
    unsafeQuery.textContent = "SELECT * FROM users\nWHERE username = '" + selectedPayload.username + "'\nAND password = '" + selectedPayload.password + "';";
    safeQuery.textContent = "SELECT * FROM users\nWHERE username = ?\nAND password_hash = ?;\n\nparams = [" + JSON.stringify(selectedPayload.username) + ", hash(password)]";
  }

  function answerSqli(canBypass) {
    const correct = canBypass === selectedPayload.bypass;
    state.sqli[selectedPayload.id] = correct;
    sqliStatus.textContent = selectedPayload.why;
    sqliStatus.dataset.tone = correct ? "good" : "warn";
    save();
    updateScore();
  }

  function renderFixes() {
    fixList.innerHTML = "";
    fixes.forEach((fix) => {
      const label = document.createElement("label");
      label.className = "fix-option";
      label.innerHTML = "<input type=\"checkbox\"><span><strong></strong><span></span></span>";
      const checkbox = label.querySelector("input");
      checkbox.checked = Boolean(state.fixes[fix.id]);
      checkbox.addEventListener("change", () => {
        state.fixes[fix.id] = checkbox.checked;
        save();
      });
      label.querySelector("strong").textContent = fix.title;
      label.querySelector("span span").textContent = fix.body;
      fixList.appendChild(label);
    });
  }

  function checkFixes() {
    let decisions = 0;
    fixes.forEach((fix, index) => {
      const label = fixList.children[index];
      const checked = Boolean(state.fixes[fix.id]);
      const correct = checked === fix.correct;
      decisions += correct ? 1 : 0;
      label.classList.toggle("is-correct", correct);
      label.classList.toggle("is-wrong", !correct);
    });
    state.fixScore = decisions;
    fixStatus.textContent = `${decisions}/${fixes.length} defense decisions are sound.`;
    fixStatus.dataset.tone = decisions === fixes.length ? "good" : "warn";
    save();
    updateScore();
  }

  function renderXss() {
    xssPayload.textContent = "<img src=x onerror=\"stealCookie()\"> Nice lecture!";
    xssChoices.innerHTML = "";
    xssOptions.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        state.xssCorrect = option.correct;
        xssChoices.querySelectorAll(".choice").forEach((node) => node.classList.remove("is-correct", "is-wrong"));
        button.classList.add(option.correct ? "is-correct" : "is-wrong");
        xssFeedback.textContent = option.feedback;
        xssFeedback.dataset.tone = option.correct ? "good" : "warn";
        save();
        updateScore();
      });
      xssChoices.appendChild(button);
    });
  }

  function renderBoundary() {
    boundaryChoices.innerHTML = "";
    boundaryOptions.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        state.boundaryCorrect = option.correct;
        boundaryChoices.querySelectorAll(".choice").forEach((node) => node.classList.remove("is-correct", "is-wrong"));
        button.classList.add(option.correct ? "is-correct" : "is-wrong");
        boundaryFeedback.textContent = option.feedback;
        boundaryFeedback.dataset.tone = option.correct ? "good" : "warn";
        save();
        updateScore();
      });
      boundaryChoices.appendChild(button);
    });
  }

  function updateScore() {
    const sqliScore = Object.values(state.sqli).filter(Boolean).length;
    const fixScore = Math.round((Number(state.fixScore || 0) / fixes.length) * 3);
    const xssScore = state.xssCorrect ? 2 : 0;
    const boundaryScore = state.boundaryCorrect ? 2 : 0;
    const score = sqliScore + fixScore + xssScore + boundaryScore;
    scoreValue.textContent = score;
    debriefText.textContent = score >= 8
      ? "You connected injection and XSS attacks to the defenses that prevent them."
      : "Keep going: the key pattern is never treat untrusted input as code.";
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        selectedPayload: parsed.selectedPayload || "normal",
        sqli: parsed.sqli || {},
        fixes: parsed.fixes || {},
        fixScore: parsed.fixScore || 0,
        xssCorrect: Boolean(parsed.xssCorrect),
        boundaryCorrect: Boolean(parsed.boundaryCorrect)
      };
    } catch (_error) {
      return {
        selectedPayload: "normal",
        sqli: {},
        fixes: {},
        fixScore: 0,
        xssCorrect: false,
        boundaryCorrect: false
      };
    }
  }
})();
