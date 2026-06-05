(function () {
  const slides = window.LECTURE_SLIDES || [];
  const slideEl = document.getElementById("slide");
  const countEl = document.getElementById("slideCount");
  let lang = localStorage.getItem("week01LectureLang") || "en";
  let slideIndex = 0;
  let fragmentIndex = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function t(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.en || "";
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function rich(value) {
    return esc(t(value)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function visible(i) {
    return i <= fragmentIndex ? " visible" : "";
  }

  function fragments(slide) {
    return Math.max(1, slide.points?.length || 0, slide.items?.length || 0);
  }

  function readHash() {
    const match = location.hash.match(/^#\/(\d+)(?:\/(\d+))?/);
    if (!match) return;
    slideIndex = clamp(Number(match[1]) - 1, 0, slides.length - 1);
    fragmentIndex = clamp(Number(match[2] || 0), 0, fragments(slides[slideIndex]) - 1);
  }

  function writeHash() {
    const next = `#/${slideIndex + 1}/${fragmentIndex}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function cardClass(i) {
    const colors = ["blue", "green", "amber", "violet", "red"];
    return colors[i % colors.length];
  }

  function renderPoints(slide) {
    if (slide.layout === "full") return "";
    return `<ul class="points">
      ${(slide.points || []).map((point, i) => `
        <li class="point fragment${visible(i)}">
          <span>${i + 1}</span>
          <div>${rich(point)}</div>
        </li>
      `).join("")}
    </ul>`;
  }

  function renderWord(slide) {
    return `<div class="word-mark">
      <b class="fragment${visible(0)}">${esc(t(slide.word || slide.title))}</b>
      <p class="fragment${visible(1)}">${esc(t(slide.wordSub || slide.subtitle))}</p>
    </div>`;
  }

  function renderEquation(slide) {
    return `<div class="equation">
      ${(slide.items || []).map((item, i) => `
        <article class="eq-card fragment${visible(i)}">
          <b>${esc(t(item.title))}</b>
          <p>${esc(t(item.text))}</p>
        </article>
        ${i < (slide.items.length - 1) ? `<div class="operator fragment${visible(i)}">${i === 1 ? "=" : "+"}</div>` : ""}
      `).join("")}
    </div>`;
  }

  function renderCards(slide, className = "cards") {
    return `<div class="${className}">
      ${(slide.items || []).map((item, i) => `
        <article class="big-card ${cardClass(i)} fragment${visible(i)}">
          <b>${esc(t(item.title))}</b>
          <p>${esc(t(item.text))}</p>
        </article>
      `).join("")}
    </div>`;
  }

  function renderFlow(slide) {
    return `<div class="flow">
      ${(slide.items || []).map((item, i) => `
        <div class="node fragment${visible(i)}">
          <b>${esc(t(item.title))}</b>
          <p>${esc(t(item.text))}</p>
        </div>
      `).join("")}
    </div>`;
  }

  function renderTriangle(slide) {
    const items = slide.items || [];
    return `<div class="triangle-wrap">
      <div class="triangle fragment${visible(0)}"></div>
      ${items.map((item, i) => `
        <div class="tri-label ${item.pos} fragment${visible(i)}">${esc(t(item.title))}</div>
      `).join("")}
    </div>`;
  }

  function renderMatrix(slide) {
    return `<div class="matrix">
      ${(slide.items || []).map((item, i) => `
        <div class="matrix-row fragment${visible(i)}">
          <span>${esc(t(item.title))}</span>
          <b>${esc(t(item.text))}</b>
        </div>
      `).join("")}
    </div>`;
  }

  function renderCompare(slide) {
    const items = slide.items || [];
    return `<div class="compare">
      <article class="big-card blue fragment${visible(0)}">
        <b>${esc(t(items[0]?.title))}</b>
        <p>${esc(t(items[0]?.text))}</p>
      </article>
      <div class="versus fragment${visible(1)}">vs</div>
      <article class="big-card amber fragment${visible(2)}">
        <b>${esc(t(items[1]?.title))}</b>
        <p>${esc(t(items[1]?.text))}</p>
      </article>
    </div>`;
  }

  function renderLoop(slide) {
    return `<div class="loop">
      ${(slide.items || []).map((item, i) => `
        <div class="loop-step fragment${visible(i)}">${esc(t(item.title))}</div>
      `).join("")}
    </div>`;
  }

  function renderDots() {
    return `<div class="dots fragment${visible(0)}">
      <i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i><i class="dot"></i>
    </div>`;
  }

  function renderVisual(slide) {
    switch (slide.visual) {
      case "word": return renderWord(slide);
      case "equation": return renderEquation(slide);
      case "cards": return renderCards(slide);
      case "questions": return renderCards(slide, "questions");
      case "actors": return renderCards(slide, "actors");
      case "principles": return renderCards(slide, "principles");
      case "flow": return renderFlow(slide);
      case "triangle": return renderTriangle(slide);
      case "matrix": return renderMatrix(slide);
      case "compare": return renderCompare(slide);
      case "loop": return renderLoop(slide);
      case "dots": return renderDots(slide);
      default: return renderCards(slide);
    }
  }

  function render() {
    const slide = slides[slideIndex];
    const bodyClass = slide.layout === "full" ? "slide-body full" : "slide-body";
    slideEl.innerHTML = `
      <header class="slide-header">
        <div class="kicker">${esc(t(slide.section))}</div>
        <h1 class="title">${esc(t(slide.title))}</h1>
        ${slide.subtitle ? `<p class="subtitle">${esc(t(slide.subtitle))}</p>` : ""}
      </header>
      <div class="${bodyClass}">
        <div class="visual">${renderVisual(slide)}</div>
        ${renderPoints(slide)}
      </div>
    `;
    countEl.textContent = `${slideIndex + 1}/${slides.length}`;
    document.documentElement.lang = lang;
    document.querySelectorAll(".language-toggle button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lang === lang);
    });
    writeHash();
  }

  function next() {
    if (fragmentIndex < fragments(slides[slideIndex]) - 1) {
      fragmentIndex += 1;
    } else {
      slideIndex = clamp(slideIndex + 1, 0, slides.length - 1);
      fragmentIndex = 0;
    }
    render();
  }

  function previous() {
    if (fragmentIndex > 0) {
      fragmentIndex -= 1;
    } else if (slideIndex > 0) {
      slideIndex -= 1;
      fragmentIndex = fragments(slides[slideIndex]) - 1;
    }
    render();
  }

  document.getElementById("nextBtn").addEventListener("click", next);
  document.getElementById("prevBtn").addEventListener("click", previous);

  document.querySelectorAll(".language-toggle button").forEach((button) => {
    button.addEventListener("click", () => {
      lang = button.dataset.lang;
      localStorage.setItem("week01LectureLang", lang);
      render();
    });
  });

  document.addEventListener("keydown", (event) => {
    const forward = ["ArrowRight", "PageDown", " ", "Enter"];
    const backward = ["ArrowLeft", "PageUp", "Backspace"];
    if (forward.includes(event.key)) {
      event.preventDefault();
      next();
    } else if (backward.includes(event.key)) {
      event.preventDefault();
      previous();
    } else if (event.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
  });

  window.addEventListener("hashchange", () => {
    readHash();
    render();
  });

  readHash();
  render();
})();
