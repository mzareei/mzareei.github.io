(function () {
  "use strict";

  const STORE_KEY = "tc2007b-review-coach";
  const state = readState();
  const reviewScore = document.getElementById("reviewScore");
  const cardTopic = document.getElementById("cardTopic");
  const cardTitle = document.getElementById("cardTitle");
  const cardCount = document.getElementById("cardCount");
  const cardPrompt = document.getElementById("cardPrompt");
  const answerPanel = document.getElementById("answerPanel");
  const cardAnswer = document.getElementById("cardAnswer");
  const practiceLink = document.getElementById("practiceLink");
  const showAnswerBtn = document.getElementById("showAnswerBtn");
  const againBtn = document.getElementById("againBtn");
  const gotItBtn = document.getElementById("gotItBtn");
  const coachStatus = document.getElementById("coachStatus");
  const signalList = document.getElementById("signalList");
  const queueList = document.getElementById("queueList");
  const masteredStat = document.getElementById("masteredStat");
  const againStat = document.getElementById("againStat");
  const resetSprintBtn = document.getElementById("resetSprintBtn");

  const cards = [
    ["cia", "Security Mindset", "When an attack leaks private records, changes grades, and makes the portal unavailable, how do you separate the CIA impacts?", "Confidentiality is the leak, integrity is the unauthorized grade change, and availability is the outage.", "../week-01/mission-01/"],
    ["risk", "Risk Thinking", "Why is 'valuable asset plus plausible harm' a better security question than 'is this computer important?'", "It forces you to connect the asset to a concrete threat and consequence.", "../week-01/mission-01/"],
    ["auth", "Authentication", "Why is a password plus SMS code weaker than a password plus a security key?", "SMS can be phished or redirected more easily; a security key or passkey is bound to the real origin.", "../week-02/mission-02/"],
    ["passwords", "Password Storage", "After a password database leak, what makes offline guessing harder?", "Slow salted password hashing, rate limits for online guessing, and quick credential reset after exposure.", "../week-02/mission-02/"],
    ["access", "Access Control", "What is the difference between authentication and authorization?", "Authentication asks who you are. Authorization asks what you are allowed to do.", "../week-02/mission-03/"],
    ["least-privilege", "Least Privilege", "Why should an app database account not be a full administrator?", "If the app is exploited, least privilege limits what the attacker can read or change.", "../week-02/mission-03/"],
    ["appsec", "SQL Injection", "What does a parameterized query change about user input?", "It keeps input as data, not executable SQL syntax.", "../week-03/mission-04/"],
    ["xss", "XSS", "Why is textContent safer than innerHTML for untrusted comments?", "textContent renders text. innerHTML can turn untrusted markup into executable script.", "../week-03/mission-04/"],
    ["release", "Release Risk", "What kind of vulnerability should block a release?", "A high-impact, reachable flaw such as unauthenticated student data access should block release until fixed and retested.", "../week-04/mission-bridge/"],
    ["crypto", "Public-Key Crypto", "Which key is used to send Alice a confidential message, and which key decrypts it?", "The sender encrypts with Alice's public key; Alice decrypts with her private key.", "../week-05/mission-05/"],
    ["crypto", "Digital Signatures", "What does a digital signature prove that encryption alone does not?", "A signature can prove origin and integrity. Encryption alone mainly protects confidentiality.", "../week-05/mission-05/"],
    ["symmetric", "Authenticated Encryption", "Why is encryption without integrity incomplete?", "An attacker may modify ciphertext without detection; authenticated encryption adds tamper detection.", "../week-06/mission-bridge/"],
    ["keys", "Key Handling", "Once a production key appears in a public repository, why is deleting the line not enough?", "The secret may already be copied and remains in history; it must be revoked or rotated.", "../week-06/mission-bridge/"],
    ["protocols", "Protocol Freshness", "What does a nonce help prove in an authentication protocol?", "It helps prove the message is fresh and not an old replay.", "../week-07/mission-06/"],
    ["hashing", "HMAC", "Why does HMAC authenticate a message while a plain hash does not?", "HMAC includes a shared secret; a plain hash can be recomputed by anyone.", "../week-07/mission-06/"],
    ["tls", "TLS", "TLS is not only encryption. What else must it prove?", "It must authenticate the endpoint identity through certificate validation.", "../week-08/mission-bridge/"],
    ["channels", "Downgrade Attacks", "Why is HTTPS stripped to HTTP on public Wi-Fi dangerous?", "Credentials and content can be intercepted or modified because TLS protection is gone.", "../week-08/mission-bridge/"],
    ["malware", "Malware Response", "What is the first priority when ransomware appears in a lab?", "Contain spread by isolating affected machines, then preserve evidence and recover from verified clean backups.", "../week-09/mission-07/"],
    ["firewall", "Firewalls", "Why does default deny reduce exposure?", "Only explicitly allowed traffic passes, so accidental services are less likely to be reachable.", "../week-10/mission-08/"],
    ["ids", "IDS Triage", "Why can false positives overwhelm a SOC?", "Analysts have limited attention; noisy alerts hide the few events that deserve urgent investigation.", "../week-11/mission-09/"],
    ["chain", "Attack Chain", "Why is an incident timeline more useful than a list of isolated alerts?", "The timeline connects weak points, controls, and detection signals so defenders can prioritize the actual path of compromise.", "../attack-chain/"],
    ["chain", "Control Mapping", "At each attack stage, what three questions should a defender ask?", "What failed, what control would reduce it, and what signal should reveal it.", "../attack-chain/"]
  ].map(([tag, title, prompt, answer, href], index) => ({ id: `card-${index + 1}`, tag, title, prompt, answer, href }));

  const signals = collectSignals();
  const sprint = buildSprint();
  let currentIndex = Math.min(state.currentIndex || 0, sprint.length - 1);
  let showingAnswer = false;

  showAnswerBtn.addEventListener("click", () => {
    showingAnswer = !showingAnswer;
    renderCard();
  });
  againBtn.addEventListener("click", () => rateCard("again"));
  gotItBtn.addEventListener("click", () => rateCard("got"));
  resetSprintBtn.addEventListener("click", resetSprint);

  render();

  function render() {
    renderCard();
    renderSignals();
    renderQueue();
    renderStats();
  }

  function renderCard() {
    const card = sprint[currentIndex] || cards[0];
    const record = state.cards[card.id] || {};
    cardTopic.textContent = card.tag;
    cardTitle.textContent = card.title;
    cardCount.textContent = `${currentIndex + 1} / ${sprint.length}`;
    cardPrompt.textContent = card.prompt;
    cardAnswer.textContent = card.answer;
    practiceLink.href = card.href;
    answerPanel.classList.toggle("is-visible", showingAnswer);
    showAnswerBtn.textContent = showingAnswer ? "Hide answer" : "Show answer";
    coachStatus.textContent = record.last_rating
      ? `Last marked: ${record.last_rating === "got" ? "Got it" : "Review again"}`
      : "";
    coachStatus.dataset.tone = record.last_rating === "got" ? "good" : "warn";
  }

  function renderSignals() {
    signalList.innerHTML = "";
    if (!signals.length) {
      signalList.appendChild(signalItem("Balanced start", "No weak local signals yet, so the coach is giving a broad foundation review."));
      return;
    }
    signals.slice(0, 6).forEach((signal) => {
      signalList.appendChild(signalItem(signal.title, signal.body));
    });
  }

  function renderQueue() {
    queueList.innerHTML = "";
    sprint.forEach((card, index) => {
      const record = state.cards[card.id] || {};
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mini-card";
      item.classList.toggle("is-current", index === currentIndex);
      item.classList.toggle("is-done", record.last_rating === "got");
      item.innerHTML = `<strong></strong><span></span>`;
      item.querySelector("strong").textContent = card.title;
      item.querySelector("span").textContent = record.last_rating === "got" ? "Marked got it" : card.tag;
      item.addEventListener("click", () => {
        currentIndex = index;
        state.currentIndex = currentIndex;
        showingAnswer = false;
        save();
        render();
      });
      queueList.appendChild(item);
    });
  }

  function renderStats() {
    const records = Object.values(state.cards);
    const got = records.filter((record) => record.last_rating === "got").length;
    const again = records.filter((record) => record.last_rating === "again").length;
    masteredStat.textContent = String(got);
    againStat.textContent = String(again);
    reviewScore.textContent = String(got + again);
  }

  function rateCard(rating) {
    const card = sprint[currentIndex] || cards[0];
    const record = state.cards[card.id] || { got: 0, again: 0 };
    record[rating] = Number(record[rating] || 0) + 1;
    record.last_rating = rating;
    record.last_seen_at = new Date().toISOString();
    state.cards[card.id] = record;
    if (currentIndex < sprint.length - 1) {
      currentIndex += 1;
      state.currentIndex = currentIndex;
    }
    showingAnswer = false;
    save();
    render();
  }

  function resetSprint() {
    state.cards = {};
    state.currentIndex = 0;
    currentIndex = 0;
    showingAnswer = false;
    save();
    render();
  }

  function buildSprint() {
    const priorityTags = signals.flatMap((signal) => signal.tags);
    const selected = [];
    priorityTags.forEach((tag) => {
      cards
        .filter((card) => card.tag === tag && !selected.some((item) => item.id === card.id))
        .slice(0, 2)
        .forEach((card) => selected.push(card));
    });
    cards.forEach((card) => {
      if (selected.length < 8 && !selected.some((item) => item.id === card.id)) selected.push(card);
    });
    return selected.slice(0, 8);
  }

  function collectSignals() {
    const rows = [];
    addMissionSignal(rows, "tc2007b-mission-01", ["cia", "risk"], "Security mindset", "Mission 01 is not strong yet; review CIA, value, risk, and response sequence.");
    addMissionSignal(rows, "tc2007b-mission-02", ["auth", "passwords"], "Authentication", "Mission 02 suggests password storage or MFA choices need another pass.");
    addMissionSignal(rows, "tc2007b-mission-03", ["access", "least-privilege"], "Access control", "Mission 03 suggests access models or least privilege need review.");
    addMissionSignal(rows, "tc2007b-mission-04", ["appsec", "xss"], "Application security", "Mission 04 suggests SQLi, XSS, or trust boundaries need review.");
    addMissionSignal(rows, "tc2007b-bridge-04", ["release", "appsec"], "Release risk", "The Week 4 bridge suggests secure-release decisions need review.");
    addMissionSignal(rows, "tc2007b-mission-05", ["crypto"], "Public-key crypto", "Mission 05 suggests public-key actions or signatures need review.");
    addMissionSignal(rows, "tc2007b-bridge-06", ["symmetric", "keys"], "Data protection", "The Week 6 bridge suggests encryption modes, keys, or nonces need review.");
    addMissionSignal(rows, "tc2007b-mission-06", ["protocols", "hashing"], "Protocols and hashes", "Mission 06 suggests freshness, HMAC, or hash properties need review.");
    addMissionSignal(rows, "tc2007b-bridge-08", ["tls", "channels"], "Secure channels", "The Week 8 bridge suggests TLS and channel trust need review.");
    addMissionSignal(rows, "tc2007b-mission-07", ["malware"], "Malware response", "Mission 07 suggests malware classification or containment needs review.");
    addMissionSignal(rows, "tc2007b-mission-08", ["firewall"], "Firewalls", "Mission 08 suggests firewall decisions or DMZ placement need review.");
    addMissionSignal(rows, "tc2007b-mission-09", ["ids"], "Intrusion detection", "Mission 09 suggests IDS outcomes or SOC triage need review.");

    const tickets = readArray("tc2007b-exit-tickets");
    if (tickets.some((ticket) => Number(ticket.confidence || 0) <= 2)) {
      rows.unshift({
        title: "Low confidence exit ticket",
        body: "One or more local exit tickets had confidence 2/5 or lower.",
        tags: ["risk", "appsec", "protocols"]
      });
    }

    const cases = read("tc2007b-case-files");
    const completedCases = Object.values(cases.results || {}).filter((result) => result.completed).length;
    if (completedCases < 5) {
      rows.push({
        title: "Scenario practice",
        body: "Not all case files are complete yet; review cards will include cross-topic incident reasoning.",
        tags: ["risk", "appsec", "keys", "malware", "ids"]
      });
    }
    const chain = read("tc2007b-attack-chain");
    const checkedStages = Object.values(chain.results || {}).filter((result) => result.checked).length;
    if (checkedStages < 6) {
      rows.push({
        title: "Attack chain mapping",
        body: "The Attack Chain Lab is not complete yet; review cards will include incident timeline reasoning.",
        tags: ["chain", "risk", "ids"]
      });
    }
    const conceptMap = read("tc2007b-concept-map");
    const weakConceptTags = Object.values(conceptMap.confidence || {})
      .filter((record) => Number(record.rating || 0) > 0 && Number(record.rating || 0) <= 2)
      .flatMap((record) => record.tags || []);
    if (weakConceptTags.length) {
      rows.unshift({
        title: "Concept map confidence",
        body: "One or more concept-map nodes are marked as weak.",
        tags: weakConceptTags
      });
    }
    return rows;
  }

  function addMissionSignal(rows, key, tags, title, body) {
    const data = read(key);
    if (!Object.keys(data).length) {
      rows.push({ title, body: `${title} has no local mission record yet.`, tags });
      return;
    }
    const valueCount = JSON.stringify(data).match(/true/g)?.length || 0;
    if (valueCount < 3) rows.push({ title, body, tags });
  }

  function signalItem(title, body) {
    const item = document.createElement("article");
    item.className = "signal-item";
    item.innerHTML = `<strong></strong><span></span>`;
    item.querySelector("strong").textContent = title;
    item.querySelector("span").textContent = body;
    return item;
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      return {
        cards: parsed.cards || {},
        currentIndex: Number(parsed.currentIndex || 0)
      };
    } catch (_error) {
      return { cards: {}, currentIndex: 0 };
    }
  }

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch (_error) {
      return {};
    }
  }

  function readArray(key) {
    const value = read(key);
    return Array.isArray(value) ? value : [];
  }
})();
