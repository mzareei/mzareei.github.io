(function () {
  "use strict";

  const STORE_KEY = "tc2007b-concept-map";
  const mapScore = document.getElementById("mapScore");
  const conceptGrid = document.getElementById("conceptGrid");
  const selectedWeek = document.getElementById("selectedWeek");
  const selectedTitle = document.getElementById("selectedTitle");
  const selectedBody = document.getElementById("selectedBody");
  const dependencyList = document.getElementById("dependencyList");
  const explainPrompt = document.getElementById("explainPrompt");
  const revealAnswerBtn = document.getElementById("revealAnswerBtn");
  const modelAnswer = document.getElementById("modelAnswer");
  const confidenceButtons = document.getElementById("confidenceButtons");
  const conceptLinks = document.getElementById("conceptLinks");
  const recommendationList = document.getElementById("recommendationList");
  const readyStat = document.getElementById("readyStat");
  const averageStat = document.getElementById("averageStat");
  const weakStat = document.getElementById("weakStat");
  const resetMapBtn = document.getElementById("resetMapBtn");
  const mapStatus = document.getElementById("mapStatus");

  const concepts = [
    concept("security-problem", "Security problem", "Week 1", "foundation", "Security starts with an asset, plausible harm, and a decision about risk.", "Explain why a valuable system is not automatically a security problem.", "Security appears when something valuable faces plausible harm. The security decision is about risk, impact, and tradeoffs.", [], ["risk"], [["Mission 01", "../week-01/mission-01/"], ["Lecture", "../week-01/lecture/"]]),
    concept("cia", "CIA triad", "Week 1", "foundation", "Confidentiality, integrity, and availability give names to the main kinds of harm.", "A gradebook is leaked, edited, and taken offline. Separate the three failures.", "The leak is confidentiality, the unauthorized edit is integrity, and the outage is availability.", ["security-problem"], ["cia"], [["Mission 01", "../week-01/mission-01/"], ["Quiz", "../week-01/lecture/quiz/"]]),
    concept("ethics", "Ethics and authorization", "Week 1", "foundation", "Technical ability does not equal permission; scope and harm matter.", "What makes a vulnerability report responsible instead of reckless?", "Responsible reporting stays within authorization, minimizes access to data, preserves evidence, and alerts the right owner.", ["security-problem"], ["risk"], [["Lecture 2", "../week-01/lecture-2/"], ["Exit ticket", "../exit-ticket/?lecture=tc2007b-w1-l2"]]),
    concept("authentication", "Authentication", "Week 2", "foundation", "Authentication proves identity with factors such as knowledge, possession, and inherence.", "Why is a security key a different factor from a password?", "A password is knowledge. A security key is possession and is usually bound to the real origin.", ["cia", "ethics"], ["auth", "passwords"], [["Mission 02", "../week-02/mission-02/"], ["Lecture", "../week-02/lecture/"]]),
    concept("access-control", "Access control", "Week 2", "foundation", "Authorization turns identity into allowed actions through policy and enforcement.", "How are authentication and authorization different in one sentence?", "Authentication asks who you are. Authorization asks what you may do.", ["authentication"], ["access", "least-privilege"], [["Mission 03", "../week-02/mission-03/"], ["Lecture", "../week-02/lecture-2/"]]),
    concept("app-security", "Application security", "Week 3", "software", "Apps fail when untrusted input crosses a trust boundary as code or privileged action.", "Why do parameterized queries stop SQL injection?", "They keep user input as data instead of letting it become query syntax.", ["access-control"], ["appsec", "xss"], [["Mission 04", "../week-03/mission-04/"], ["Lecture", "../week-03/lecture/"]]),
    concept("release-risk", "Release risk", "Week 4", "software", "Secure release decisions weigh exploitability, impact, control strength, and timing.", "What kind of flaw should block a release?", "A reachable, high-impact security flaw such as unauthorized access to sensitive records should block release.", ["app-security"], ["release", "risk"], [["Bridge mission", "../week-04/mission-bridge/"], ["Case files", "../case-files/"]]),
    concept("public-key", "Public-key crypto", "Week 5", "crypto", "Public and private keys separate confidentiality, identity, and signatures.", "Which key encrypts a confidential message to Alice, and which key decrypts it?", "The sender uses Alice's public key. Alice decrypts with her private key.", ["cia"], ["crypto"], [["Mission 05", "../week-05/mission-05/"], ["Lecture", "../week-05/lecture/"]]),
    concept("data-protection", "Data protection", "Week 6", "crypto", "Symmetric encryption, authenticated modes, password hashing, and key handling protect stored data.", "Why is deleting a leaked key from a repository not enough?", "The key may already be copied and remains in history, so it must be revoked or rotated.", ["public-key", "app-security"], ["symmetric", "keys"], [["Bridge mission", "../week-06/mission-bridge/"], ["Case files", "../case-files/"]]),
    concept("protocols", "Protocols and hashes", "Week 7", "crypto", "Freshness, direction, hash properties, and HMAC keep messages from being replayed or forged.", "Why does HMAC authenticate a message while a plain hash does not?", "HMAC includes a shared secret. A plain hash can be recomputed by anyone.", ["authentication", "data-protection"], ["protocols", "hashing"], [["Mission 06", "../week-07/mission-06/"], ["Lecture", "../week-07/lecture/"]]),
    concept("secure-channels", "Secure channels", "Week 8", "crypto", "TLS and channel controls protect identity, confidentiality, and integrity in transit.", "TLS is not only encryption. What else must it verify?", "It must verify the endpoint identity through certificate validation.", ["protocols", "public-key"], ["tls", "channels"], [["Bridge mission", "../week-08/mission-bridge/"], ["Attack chain", "../attack-chain/"]]),
    concept("malware", "Malware response", "Week 9", "operations", "Malware defense combines prevention, containment, evidence, backup, and recovery.", "What is the first priority when ransomware appears in a lab?", "Contain spread by isolating affected systems, then preserve evidence and recover from verified clean backups.", ["cia", "release-risk"], ["malware"], [["Mission 07", "../week-09/mission-07/"], ["Lecture", "../week-09/lecture/"]]),
    concept("firewalls", "Firewalls and DMZ", "Week 10", "operations", "Network controls reduce exposure by shaping who can talk to which service.", "Why does default deny reduce exposure?", "Only explicitly allowed traffic passes, so accidental services are less likely to be reachable.", ["secure-channels", "malware"], ["firewall"], [["Mission 08", "../week-10/mission-08/"], ["Lecture", "../week-10/lecture/"]]),
    concept("ids", "Intrusion detection", "Week 11", "operations", "Detection systems trade false positives, false negatives, context, and analyst attention.", "Why can false positives overwhelm a SOC?", "Analysts have limited attention; noisy alerts hide the few events that deserve urgent investigation.", ["firewalls", "malware"], ["ids"], [["Mission 09", "../week-11/mission-09/"], ["Lecture", "../week-11/lecture/"]]),
    concept("attack-chain", "Attack chain reasoning", "Cross-week", "operations", "Incidents become clearer when weak points, controls, and signals are mapped as a timeline.", "At each attack stage, what three questions should a defender ask?", "What failed, what control would reduce it, and what signal should reveal it.", ["ids", "access-control", "app-security"], ["chain", "risk"], [["Attack Chain Lab", "../attack-chain/"], ["Assessment Studio", "../assessment/"]])
  ];

  let state = readState();
  let selectedId = state.selectedId || concepts[0].id;
  let activeFilter = "all";
  let answerVisible = false;

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderMap();
    });
  });
  revealAnswerBtn.addEventListener("click", () => {
    answerVisible = !answerVisible;
    renderDetail();
  });
  resetMapBtn.addEventListener("click", () => {
    state = { confidence: {}, selectedId };
    saveState();
    setStatus("Map reset.", "");
    render();
  });

  render();

  function render() {
    renderMap();
    renderDetail();
    renderSummary();
  }

  function renderMap() {
    const readiness = calculateConceptReadiness(concepts, state);
    conceptGrid.innerHTML = "";
    concepts
      .filter((item) => activeFilter === "all" || item.cluster === activeFilter)
      .forEach((item) => {
        const rating = ratingFor(item.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "concept-node";
        button.classList.toggle("is-selected", item.id === selectedId);
        button.classList.toggle("is-ready", readiness.readyIds.includes(item.id));
        button.classList.toggle("is-weak", rating > 0 && rating <= 2);
        button.innerHTML = `
          <span></span>
          <strong></strong>
          <small></small>
          <span class="node-meter"><i></i></span>
        `;
        button.querySelector("span").textContent = item.week;
        button.querySelector("strong").textContent = item.title;
        button.querySelector("small").textContent = dependencyLabel(item);
        button.querySelector("i").style.setProperty("--level", `${rating * 20}%`);
        button.addEventListener("click", () => {
          selectedId = item.id;
          state.selectedId = selectedId;
          answerVisible = false;
          saveState();
          render();
        });
        conceptGrid.appendChild(button);
      });
  }

  function renderDetail() {
    const item = selectedConcept();
    selectedWeek.textContent = item.week;
    selectedTitle.textContent = item.title;
    selectedBody.textContent = item.body;
    explainPrompt.textContent = item.prompt;
    modelAnswer.textContent = item.answer;
    modelAnswer.classList.toggle("is-visible", answerVisible);
    revealAnswerBtn.textContent = answerVisible ? "Hide answer" : "Reveal answer";
    renderDependencies(item);
    renderConfidence(item);
    renderLinks(item);
  }

  function renderDependencies(item) {
    dependencyList.innerHTML = "";
    if (!item.depends.length) {
      dependencyList.appendChild(dependencyItem("Foundation concept", "start"));
      return;
    }
    item.depends.forEach((id) => {
      const dependency = concepts.find((candidate) => candidate.id === id);
      dependencyList.appendChild(dependencyItem(dependency?.title || id, `${ratingFor(id)}/5`));
    });
  }

  function renderConfidence(item) {
    confidenceButtons.innerHTML = "";
    for (let value = 1; value <= 5; value += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(value);
      button.setAttribute("aria-label", `Confidence ${value}`);
      button.classList.toggle("is-selected", ratingFor(item.id) === value);
      button.addEventListener("click", () => {
        state.confidence[item.id] = { rating: value, updated_at: new Date().toISOString(), tags: item.tags };
        saveState();
        setStatus(`${item.title}: ${value}/5`, value >= 4 ? "good" : "warn");
        render();
      });
      confidenceButtons.appendChild(button);
    }
  }

  function renderLinks(item) {
    conceptLinks.innerHTML = "";
    item.links.forEach(([label, href]) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      conceptLinks.appendChild(link);
    });
  }

  function renderSummary() {
    const readiness = calculateConceptReadiness(concepts, state);
    mapScore.textContent = `${readiness.percent}%`;
    readyStat.textContent = String(readiness.ready);
    averageStat.textContent = `${readiness.average}/5`;
    weakStat.textContent = String(readiness.weakConcepts.length);
    recommendationList.innerHTML = "";
    readiness.nextConcepts.forEach((item) => {
      const row = document.createElement("article");
      row.className = "recommendation-item";
      row.innerHTML = "<strong></strong><span></span>";
      row.querySelector("strong").textContent = item.title;
      row.querySelector("span").textContent = item.reason;
      recommendationList.appendChild(row);
    });
  }

  function calculateConceptReadiness(conceptList, savedState) {
    const ratings = savedState?.confidence || {};
    const readyIds = conceptList
      .filter((item) => {
        const rating = Number(ratings[item.id]?.rating || 0);
        const dependenciesReady = item.depends.every((id) => Number(ratings[id]?.rating || 0) >= 3);
        return rating >= 4 && dependenciesReady;
      })
      .map((item) => item.id);
    const rated = conceptList
      .map((item) => Number(ratings[item.id]?.rating || 0))
      .filter((value) => value > 0);
    const weakConcepts = conceptList.filter((item) => {
      const rating = Number(ratings[item.id]?.rating || 0);
      return rating > 0 && rating <= 2;
    });
    const nextConcepts = buildNextConcepts(conceptList, ratings, readyIds, weakConcepts);
    return {
      ready: readyIds.length,
      total: conceptList.length,
      percent: conceptList.length ? Math.round((readyIds.length / conceptList.length) * 100) : 0,
      average: rated.length ? Math.round((rated.reduce((sum, value) => sum + value, 0) / rated.length) * 10) / 10 : 0,
      weakConcepts,
      nextConcepts,
      readyIds
    };
  }

  function buildNextConcepts(conceptList, ratings, readyIds, weakConcepts) {
    const weakRows = weakConcepts.map((item) => ({ title: item.title, reason: "Confidence is 1 or 2. Revisit its lecture or mission." }));
    if (weakRows.length) return weakRows.slice(0, 4);
    const unratedReady = conceptList
      .filter((item) => !Number(ratings[item.id]?.rating || 0))
      .filter((item) => item.depends.every((id) => readyIds.includes(id) || Number(ratings[id]?.rating || 0) >= 3))
      .map((item) => ({ title: item.title, reason: item.depends.length ? "Prerequisites look ready." : "Foundation concept." }));
    if (unratedReady.length) return unratedReady.slice(0, 4);
    const blocked = conceptList
      .filter((item) => !readyIds.includes(item.id))
      .map((item) => ({ title: item.title, reason: "Raise confidence and prerequisite concepts to unlock readiness." }));
    return blocked.slice(0, 4);
  }

  function selectedConcept() {
    return concepts.find((item) => item.id === selectedId) || concepts[0];
  }

  function dependencyItem(title, value) {
    const item = document.createElement("div");
    item.className = "dependency-pill";
    item.innerHTML = "<strong></strong><span></span>";
    item.querySelector("strong").textContent = title;
    item.querySelector("span").textContent = value;
    return item;
  }

  function dependencyLabel(item) {
    return item.depends.length ? `${item.depends.length} prerequisite(s)` : "foundation";
  }

  function ratingFor(id) {
    return Number(state.confidence?.[id]?.rating || 0);
  }

  function concept(id, title, week, cluster, body, prompt, answer, depends, tags, links) {
    return { id, title, week, cluster, body, prompt, answer, depends, tags, links };
  }

  function setStatus(message, tone) {
    mapStatus.textContent = message;
    if (tone) mapStatus.dataset.tone = tone;
    else mapStatus.removeAttribute("data-tone");
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        confidence: parsed.confidence || {},
        selectedId: parsed.selectedId || concepts[0]?.id
      };
    } catch (_error) {
      return { confidence: {}, selectedId: concepts[0]?.id };
    }
  }

  window.calculateConceptReadiness = calculateConceptReadiness;
  window.TC2007B_CONCEPTS = concepts;
})();
