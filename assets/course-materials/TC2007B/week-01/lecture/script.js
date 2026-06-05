/* =====================================================================
   TC2007B · W1 · L1 — Presenter navigation
   Keyboard + remote + touch. No dependency on side panels or notes.
   ===================================================================== */
(function () {
  "use strict";

  var slides   = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total    = slides.length;
  var current  = 0;

  var elProgress = document.getElementById("progress");
  var elCur      = document.getElementById("cur");
  var elTotal    = document.getElementById("total");
  var elSecName  = document.getElementById("secName");
  var overview   = document.getElementById("overview");
  var ovGrid     = document.getElementById("ovGrid");
  var help       = document.getElementById("help");

  elTotal.textContent = total;

  function show(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(total - 1, i));
    slides[current].classList.remove("active");
    current = i;
    var s = slides[current];
    s.classList.add("active");

    elCur.textContent = current + 1;
    elProgress.style.width = ((current + 1) / total * 100) + "%";
    elSecName.textContent = s.getAttribute("data-section") || "";

    if (history.replaceState) history.replaceState(null, "", "#" + (current + 1));
    if (opts.closeOverlays !== false) closeOverlays();
  }

  function next() { if (current < total - 1) show(current + 1); }
  function prev() { if (current > 0) show(current - 1); }

  /* ---------- Keyboard / presenter remote ---------- */
  document.addEventListener("keydown", function (e) {
    // Let modifier combos through (e.g., browser shortcuts)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); show(0); break;
      case "End":
        e.preventDefault(); show(total - 1); break;
      case "f": case "F":
        toggleFullscreen(); break;
      case "o": case "O":
        toggleOverview(); break;
      case "?":
        toggleHelp(); break;
      case "Escape":
        closeOverlays(); break;
      default:
        // numeric jump: type a number then it jumps live
        if (/^[0-9]$/.test(e.key)) handleNumeric(e.key);
    }
  });

  /* numeric quick-jump buffer */
  var numBuf = "", numTimer = null;
  function handleNumeric(d) {
    numBuf += d;
    clearTimeout(numTimer);
    numTimer = setTimeout(function () {
      var n = parseInt(numBuf, 10);
      if (n >= 1 && n <= total) show(n - 1);
      numBuf = "";
    }, 600);
  }

  /* ---------- On-screen buttons ---------- */
  document.getElementById("nextBtn").addEventListener("click", next);
  document.getElementById("prevBtn").addEventListener("click", prev);
  document.getElementById("fsBtn").addEventListener("click", toggleFullscreen);
  document.getElementById("ovBtn").addEventListener("click", toggleOverview);
  document.getElementById("helpBtn").addEventListener("click", toggleHelp);

  /* ---------- Click to advance (ignore links/buttons) ---------- */
  document.getElementById("deck").addEventListener("click", function (e) {
    if (overview.classList.contains("open") || help.classList.contains("open")) return;
    var t = e.target;
    if (t.closest("a, button, .nav-btns")) return;
    // advance on click in the right 70%, go back on far left
    var x = e.clientX / window.innerWidth;
    if (x < 0.12) prev(); else next();
  });

  /* ---------- Touch swipe ---------- */
  var tx = 0, ty = 0;
  document.addEventListener("touchstart", function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    }
  }, { passive: true });

  /* ---------- Fullscreen ---------- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function(){}).call(document.documentElement);
    } else {
      (document.exitFullscreen || function(){}).call(document);
    }
  }

  /* ---------- Overview ---------- */
  function buildOverview() {
    ovGrid.innerHTML = "";
    slides.forEach(function (s, i) {
      var h = s.querySelector("h1, h2");
      var title = h ? h.textContent.trim() : ("Slide " + (i + 1));
      var sec = s.getAttribute("data-section") || "";
      var card = document.createElement("div");
      card.className = "ov-card";
      card.innerHTML = '<div class="ov-num">' + (i + 1) + '</div>' +
                       '<div class="ov-title">' + title + '</div>' +
                       '<div class="ov-sec">' + sec + '</div>';
      card.addEventListener("click", function () { show(i); });
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

  /* ---------- Deep link on load (#3) ---------- */
  var start = parseInt((location.hash || "").replace("#", ""), 10);
  show(isNaN(start) ? 0 : start - 1, { closeOverlays: false });
})();
