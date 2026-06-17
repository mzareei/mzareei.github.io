/* =====================================================================
   TC2007B - W1 - L1 - Presenter engine
   Navigation + click-to-reveal fragments + EN/ES language + light/dark.
   No dependency on side panels or hidden notes.
   ===================================================================== */
(function () {
  "use strict";

  var root    = document.documentElement;
  var slides  = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total   = slides.length;
  var current = 0;

  var elProgress = document.getElementById("progress");
  var elCur      = document.getElementById("cur");
  var elTotal    = document.getElementById("total");
  var elSecName  = document.getElementById("secName");
  var overview   = document.getElementById("overview");
  var ovGrid     = document.getElementById("ovGrid");
  var ovTitle    = document.getElementById("ovTitle");
  var help       = document.getElementById("help");
  var fragHint   = document.getElementById("fragHint");
  var fragHintTx = document.getElementById("fragHintText");
  var langBtn    = document.getElementById("langBtn");
  var themeBtn   = document.getElementById("themeBtn");

  elTotal.textContent = total;

  /* ---- Language ---- */
  var lang  = read("tc-lang", "en");
  var theme = read("tc-theme", "dark");

  // SVG concept-map text isn't a [data-es] element, so translate by class.
  var svgMap = {
    "cm-owners":   ["Owners", "Propietarios"],
    "cm-owners-s": ["value & protect", "valoran y protegen"],
    "cm-assets":   ["Assets", "Activos"],
    "cm-assets-s": ["things of value", "cosas de valor"],
    "cm-vuln":     ["Vulnerabilities", "Vulnerabilidades"],
    "cm-vuln-s":   ["weaknesses", "debilidades"],
    "cm-threats":  ["Threats", "Amenazas"],
    "cm-threats-s":["actors + actions", "actores + acciones"],
    "cm-risk":     ["Risk", "Riesgo"],
    "cm-risk-s":   ["to assets", "a los activos"],
    "cm-cm":       ["Countermeasures", "Contramedidas"],
    "cm-cm-s":     ["reduce risk", "reducen el riesgo"],
    "cm-l1":       ["own", "poseen"],
    "cm-l2":       ["have", "tienen"],
    "cm-l3":       ["exploit", "explotan"],
    "cm-l4":       ["create", "crean"],
    "cm-l5":       ["protect", "protegen"]
  };
  var uiText = {
    ovTitle:  ["Slide overview", "Vista general de diapositivas"],
    fragHint: ["click to reveal", "clic para revelar"]
  };

  function captureEnglish() {
    document.querySelectorAll("[data-es]").forEach(function (el) {
      if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.innerHTML);
    });
  }

  function applyLang(l) {
    lang = l;
    root.setAttribute("data-lang", l);
    root.setAttribute("lang", l);
    var idx = (l === "es") ? 1 : 0;

    document.querySelectorAll("[data-es]").forEach(function (el) {
      var html = (l === "es") ? el.getAttribute("data-es") : el.getAttribute("data-en");
      if (html != null) el.innerHTML = html;
    });
    Object.keys(svgMap).forEach(function (cls) {
      var t = document.querySelector("text." + cls);
      if (t) t.textContent = svgMap[cls][idx];
    });

    langBtn.textContent    = (l === "es") ? "EN" : "ES";
    ovTitle.textContent    = uiText.ovTitle[idx];
    fragHintTx.textContent = uiText.fragHint[idx];
    updateSecName();
    save("tc-lang", l);
  }
  function toggleLang() { applyLang(lang === "es" ? "en" : "es"); }

  /* ---- Theme ---- */
  function applyTheme(t) {
    theme = t;
    root.setAttribute("data-theme", t);
    themeBtn.textContent = (t === "dark") ? "☀" : "☽";
    save("tc-theme", t);
  }
  function toggleTheme() { applyTheme(theme === "dark" ? "light" : "dark"); }

  /* ---- Fragments + navigation ---- */
  function setFragments(slide, revealAll) {
    slide.querySelectorAll(".fragment").forEach(function (f) {
      f.classList.toggle("revealed", !!revealAll);
    });
  }

  function show(i, dir) {
    i = Math.max(0, Math.min(total - 1, i));
    slides[current].classList.remove("active");
    current = i;
    var s = slides[current];
    s.classList.add("active");
    setFragments(s, dir !== "forward");
    updateChrome();
  }

  function next() {
    var hidden = slides[current].querySelector(".fragment:not(.revealed)");
    if (hidden) { hidden.classList.add("revealed"); updateFragHint(); return; }
    if (current < total - 1) show(current + 1, "forward");
  }
  function prev() {
    var revealed = slides[current].querySelectorAll(".fragment.revealed");
    if (revealed.length) { revealed[revealed.length - 1].classList.remove("revealed"); updateFragHint(); return; }
    if (current > 0) show(current - 1, "back");
  }

  function updateChrome() {
    elCur.textContent = current + 1;
    elProgress.style.width = ((current + 1) / total * 100) + "%";
    updateSecName();
    updateFragHint();
    if (history.replaceState) history.replaceState(null, "", "#" + (current + 1));
    closeOverlays();
  }
  function updateSecName() {
    var s = slides[current];
    var name = (lang === "es" && s.getAttribute("data-section-es")) || s.getAttribute("data-section") || "";
    elSecName.textContent = name;
  }
  function updateFragHint() {
    var more = !!slides[current].querySelector(".fragment:not(.revealed)");
    fragHint.classList.toggle("show", more);
  }

  /* ---- Keyboard / presenter remote ---- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case "PageDown": case " ":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); show(0, "back"); break;
      case "End":  e.preventDefault(); show(total - 1, "back"); break;
      case "f": case "F": toggleFullscreen(); break;
      case "o": case "O": toggleOverview(); break;
      case "m": case "M": window.location.href = "../mission-03/"; break;
      case "q": case "Q": window.location.href = "../../week-01/lecture/quiz/teacher.html?lecture=tc2007b-w2-l2"; break;
      case "e": case "E": window.location.href = "../../exit-ticket/?lecture=tc2007b-w2-l2"; break;
      case "l": case "L": toggleLang(); break;
      case "t": case "T": toggleTheme(); break;
      case "?": toggleHelp(); break;
      case "Escape": closeOverlays(); break;
      default: if (/^[0-9]$/.test(e.key)) handleNumeric(e.key);
    }
  });

  var numBuf = "", numTimer = null;
  function handleNumeric(d) {
    numBuf += d;
    clearTimeout(numTimer);
    numTimer = setTimeout(function () {
      var n = parseInt(numBuf, 10);
      if (n >= 1 && n <= total) show(n - 1, "back");
      numBuf = "";
    }, 600);
  }

  /* ---- Buttons / click / touch ---- */
  document.getElementById("nextBtn").addEventListener("click", next);
  document.getElementById("prevBtn").addEventListener("click", prev);
  document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);
  document.getElementById("ovBtn").addEventListener("click", toggleOverview);
  document.getElementById("helpBtn").addEventListener("click", toggleHelp);
  langBtn.addEventListener("click", toggleLang);
  themeBtn.addEventListener("click", toggleTheme);

  document.getElementById("deck").addEventListener("click", function (e) {
    if (overview.classList.contains("open") || help.classList.contains("open")) return;
    if (e.target.closest("a, button")) return;
    var x = e.clientX / window.innerWidth;
    if (x < 0.12) prev(); else next();
  });

  var tx = 0, ty = 0;
  document.addEventListener("touchstart", function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  /* ---- Fullscreen / overview / help ---- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
    } else {
      (document.exitFullscreen || function () {}).call(document);
    }
  }

  function buildOverview() {
    ovGrid.innerHTML = "";
    slides.forEach(function (s, i) {
      var h = s.querySelector("h1, h2");
      var title = h ? h.textContent.trim() : ("Slide " + (i + 1));
      var sec = (lang === "es" && s.getAttribute("data-section-es")) || s.getAttribute("data-section") || "";
      var card = document.createElement("div");
      card.className = "ov-card";
      card.innerHTML = '<div class="ov-num">' + (i + 1) + '</div>' +
                       '<div class="ov-title"></div>' +
                       '<div class="ov-sec"></div>';
      card.querySelector(".ov-title").textContent = title;
      card.querySelector(".ov-sec").textContent = sec;
      card.addEventListener("click", function () { show(i, "back"); });
      ovGrid.appendChild(card);
    });
  }
  function toggleOverview() {
    if (overview.classList.contains("open")) { overview.classList.remove("open"); return; }
    closeOverlays(); buildOverview(); overview.classList.add("open");
  }
  function toggleHelp() {
    if (help.classList.contains("open")) { help.classList.remove("open"); return; }
    closeOverlays(); help.classList.add("open");
  }
  function closeOverlays() {
    overview.classList.remove("open");
    help.classList.remove("open");
  }
  overview.addEventListener("click", function (e) { if (e.target === overview) closeOverlays(); });
  help.addEventListener("click", function (e) { if (e.target === help) closeOverlays(); });

  /* ---- Storage helpers ---- */
  function read(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---- Init ---- */
  captureEnglish();
  applyTheme(theme);
  applyLang(lang);

  var startN = parseInt((location.hash || "").replace("#", ""), 10);
  show(isNaN(startN) ? 0 : startN - 1, "back");
})();
