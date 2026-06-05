(function () {
  const slides = window.LECTURE_SLIDES || [];
  const frame = document.getElementById("slideFrame");
  const transcript = document.getElementById("transcript");
  const counter = document.getElementById("counter");
  const title = document.getElementById("slideTitle");
  const blockLabel = document.getElementById("blockLabel");
  const notesBlock = document.getElementById("speakerNotesBlock");
  const notes = document.getElementById("speakerNotes");
  const overview = document.getElementById("overview");
  const overviewGrid = document.getElementById("overviewGrid");

  let slideIndex = 0;
  let stepIndex = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inlineStrong(value) {
    return escapeText(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function getStepCount(slide) {
    if (slide.visual === "balance") return Math.max(3, (slide.points || []).length);
    return Math.max(1, (slide.points || []).length, (slide.visualItems || []).length);
  }

  function isVisible(index) {
    return index <= stepIndex ? " is-visible" : "";
  }

  function revealClass(index) {
    return `reveal${isVisible(index)}`;
  }

  function readHash() {
    const match = window.location.hash.match(/^#\/(\d+)(?:\/(\d+))?/);
    if (!match) return;
    slideIndex = clamp(Number(match[1]) - 1, 0, slides.length - 1);
    stepIndex = clamp(Number(match[2] || 0), 0, getStepCount(slides[slideIndex]) - 1);
  }

  function writeHash() {
    const next = `#/${slideIndex + 1}/${stepIndex}`;
    if (window.location.hash !== next) history.replaceState(null, "", next);
  }

  function renderPoints(slide) {
    const points = slide.points || [];
    if (!points.length) return "";
    return `<ul class="content-list">${points.map((point, index) => `
      <li class="${revealClass(index)}">
        <span>${index + 1}</span>
        <div>${inlineStrong(point)}</div>
      </li>`).join("")}</ul>`;
  }

  function renderCards(slide) {
    return `<div class="card-grid">${(slide.visualItems || []).map((item, index) => `
      <article class="visual-card ${revealClass(index)}">
        <b>${escapeText(item.title || item)}</b>
        <p>${escapeText(item.text || "")}</p>
      </article>`).join("")}</div>`;
  }

  function renderPromptStack(slide) {
    return `<div class="prompt-stack">${(slide.visualItems || []).map((item, index) => `
      <article class="visual-card ${revealClass(index)}">
        <b>${escapeText(item.title)}</b>
        <p>${escapeText(item.text)}</p>
      </article>`).join("")}</div>`;
  }

  function renderEquation(slide) {
    const items = slide.visualItems || [];
    return `<div class="equation">
      ${items.map((item, index) => `
        <article class="visual-card ${revealClass(index)}">
          <b>${escapeText(item.title)}</b>
          <p>${escapeText(item.text)}</p>
        </article>
        ${index < items.length - 1 ? `<div class="operator ${revealClass(index)}">${index === 1 ? "=" : "+"}</div>` : ""}
      `).join("")}
    </div>`;
  }

  function renderFlow(slide) {
    return `<div class="flow-line">${(slide.visualItems || []).map((item, index) => `
      <div class="flow-node ${revealClass(index)}">
        <b>${escapeText(item.title)}</b>
        <small>${escapeText(item.text)}</small>
      </div>`).join("")}</div>`;
  }

  function renderMatrix(slide) {
    return `<div class="matrix">
      <div class="matrix-row matrix-head"><span>Threat / issue</span><b>Requirement</b></div>
      ${(slide.visualItems || []).map((item, index) => `
        <div class="matrix-row ${revealClass(index)}">
          <span>${escapeText(item.title)}</span>
          <b>${escapeText(item.text)}</b>
        </div>`).join("")}
    </div>`;
  }

  function renderCia(slide) {
    return `<div class="cia-triangle">
      <div class="triangle"></div>
      ${(slide.visualItems || []).map((item, index) => `
        <div class="triangle-label triangle-label--${item.position} ${revealClass(index)}">${escapeText(item.title)}</div>
      `).join("")}
    </div>`;
  }

  function renderBalance(slide) {
    const items = slide.visualItems || [];
    return `<div class="balance">
      <article class="visual-card ${revealClass(0)}"><b>${escapeText(items[0]?.title || "")}</b><p>${escapeText(items[0]?.text || "")}</p></article>
      <div class="scale ${revealClass(1)}">⇄</div>
      <article class="visual-card ${revealClass(2)}"><b>${escapeText(items[1]?.title || "")}</b><p>${escapeText(items[1]?.text || "")}</p></article>
    </div>`;
  }

  function renderLoop(slide) {
    return `<div class="loop">${(slide.visualItems || []).map((item, index) => `
      <div class="loop-step ${revealClass(index)}">${escapeText(item.title || item)}</div>
    `).join("")}</div>`;
  }

  function renderPrinciples(slide) {
    return `<div class="principle-grid">${(slide.visualItems || []).map((item, index) => `
      <article class="principle ${revealClass(index)}">
        <b>${escapeText(item.title)}</b>
        <p>${escapeText(item.text)}</p>
      </article>`).join("")}</div>`;
  }

  function renderBigWord(slide) {
    const label = slide.visualLabel || slide.title;
    return `<div class="big-word">
      <div>
        <strong class="${revealClass(0)}">${escapeText(label)}</strong>
        <span class="${revealClass(1)}">${escapeText(slide.visualSub || "")}</span>
      </div>
    </div>`;
  }

  function renderPulse(slide) {
    return `<div class="big-word">
      <div>
        <strong class="${revealClass(0)}">${escapeText(slide.visualLabel || "Risk")}</strong>
        <span class="${revealClass(1)}">${escapeText(slide.visualSub || "")}</span>
      </div>
      <i class="pulse-dot"></i><i class="pulse-dot"></i><i class="pulse-dot"></i>
    </div>`;
  }

  function renderVisual(slide) {
    const type = slide.visual || "cards";
    if (type === "prompts") return renderPromptStack(slide);
    if (type === "equation") return renderEquation(slide);
    if (type === "flow") return renderFlow(slide);
    if (type === "matrix") return renderMatrix(slide);
    if (type === "cia") return renderCia(slide);
    if (type === "balance") return renderBalance(slide);
    if (type === "loop") return renderLoop(slide);
    if (type === "principles") return renderPrinciples(slide);
    if (type === "big") return renderBigWord(slide);
    if (type === "pulse") return renderPulse(slide);
    return renderCards(slide);
  }

  function renderSlide() {
    const slide = slides[slideIndex];
    const wide = slide.layout === "wide" ? " slide-body--wide" : "";
    frame.innerHTML = `
      <article class="lecture-slide">
        <header>
          <div class="slide-top">
            <div class="slide-kicker">${escapeText(slide.section || "Lecture")}</div>
            <div class="slide-source">source slide ${escapeText(slide.source || slide.number)}</div>
          </div>
          <h2 class="slide-title">${escapeText(slide.title)}</h2>
          ${slide.subtitle ? `<p class="slide-subtitle">${escapeText(slide.subtitle)}</p>` : ""}
        </header>
        <div class="slide-body${wide}">
          <section class="visual">${renderVisual(slide)}</section>
          ${slide.layout === "wide" ? "" : `<section>${renderPoints(slide)}</section>`}
        </div>
        <footer class="slide-footer">
          <span>${escapeText(slide.footer || "Information Security · Week 01")}</span>
          ${slide.activity ? `<span class="activity">${escapeText(slide.activity)}</span>` : ""}
        </footer>
      </article>`;

    title.textContent = slide.title;
    blockLabel.textContent = slide.section || "Lecture";
    counter.textContent = `Slide ${slideIndex + 1} / ${slides.length} · Reveal ${stepIndex + 1} / ${getStepCount(slide)}`;

    transcript.innerHTML = "";
    (slide.focus || slide.points || []).forEach((line, index) => {
      const li = document.createElement("li");
      li.textContent = line.replace(/\*\*/g, "");
      if (index === Math.min(stepIndex, (slide.focus || slide.points || []).length - 1)) li.classList.add("is-focus");
      transcript.appendChild(li);
    });

    if (slide.notes && slide.notes.length) {
      notesBlock.hidden = false;
      notes.innerHTML = slide.notes.map((line) => `<p>${escapeText(line)}</p>`).join("");
    } else {
      notesBlock.hidden = true;
      notes.innerHTML = "";
    }

    writeHash();
  }

  function goToSlide(index, step) {
    slideIndex = clamp(index, 0, slides.length - 1);
    stepIndex = clamp(step || 0, 0, getStepCount(slides[slideIndex]) - 1);
    renderSlide();
  }

  function nextStep() {
    const maxStep = getStepCount(slides[slideIndex]) - 1;
    if (stepIndex < maxStep) {
      stepIndex += 1;
      renderSlide();
    } else {
      goToSlide(slideIndex + 1, 0);
    }
  }

  function prevStep() {
    if (stepIndex > 0) {
      stepIndex -= 1;
      renderSlide();
    } else if (slideIndex > 0) {
      goToSlide(slideIndex - 1, getStepCount(slides[slideIndex - 1]) - 1);
    }
  }

  function buildOverview() {
    overviewGrid.innerHTML = "";
    slides.forEach((slide, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "overview-card";
      button.innerHTML = `<strong>${String(index + 1).padStart(2, "0")}</strong><span>${escapeText(slide.title)}</span>`;
      button.addEventListener("click", () => {
        overview.hidden = true;
        goToSlide(index, 0);
      });
      overviewGrid.appendChild(button);
    });
  }

  document.getElementById("nextStep").addEventListener("click", nextStep);
  document.getElementById("prevStep").addEventListener("click", prevStep);
  document.getElementById("nextSlide").addEventListener("click", () => goToSlide(slideIndex + 1, 0));
  document.getElementById("prevSlide").addEventListener("click", () => goToSlide(slideIndex - 1, 0));
  document.getElementById("toggleOverview").addEventListener("click", () => { overview.hidden = false; });
  document.getElementById("closeOverview").addEventListener("click", () => { overview.hidden = true; });

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      nextStep();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevStep();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      goToSlide(slideIndex + 1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      goToSlide(slideIndex - 1, 0);
    } else if (event.key.toLowerCase() === "o") {
      overview.hidden = !overview.hidden;
    } else if (event.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } else if (event.key === "Escape") {
      overview.hidden = true;
    }
  });

  window.addEventListener("hashchange", () => {
    readHash();
    renderSlide();
  });

  if (!slides.length) {
    frame.innerHTML = "<p>No slides were found.</p>";
    return;
  }

  buildOverview();
  readHash();
  renderSlide();
})();
