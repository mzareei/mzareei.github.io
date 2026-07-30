// GENERATED FILE — do not edit by hand.
// Regenerate with: node tools/build-deck-assets.mjs
// Source of truth: supabase/functions/_shared/templates/
/* eslint-disable */

export const DECK_SKELETON = `<!DOCTYPE html>
<html lang="en" data-theme="dark" data-lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
{{STYLE_CSS}}
</style>
</head>
<body>

<div class="topbar"><div class="fill" id="progress"></div></div>

<div class="controls">
  <button class="ui-btn" id="langBtn" title="Español / English">ES</button>
  <button class="ui-btn" id="themeBtn" title="Light / Dark">☀</button>
</div>

<main class="deck" id="deck">
{{SLIDES}}
</main>

<footer class="footer">
  <span class="course" data-es="{{COURSE_LABEL_ES}}">{{COURSE_LABEL_EN}}</span>
  <span class="right">
    <span class="sec-name" id="secName">Orientation</span>
    <span class="counter"><span id="cur">1</span> / <span id="total">1</span></span>
  </span>
</footer>

<div class="frag-hint" id="fragHint"><span id="fragHintText">click to reveal</span><span class="chev">▾</span></div>

<div class="nav-btns">
  <button id="prevBtn" title="Previous (←)">‹</button>
  <button id="ovBtn" title="Overview (O)">▦</button>
  <button id="helpBtn" title="Help (?)">?</button>
  <button id="fsBtn" title="Fullscreen (F)">⛶</button>
  <button id="nextBtn" title="Next (→)">›</button>
</div>

<div class="overview" id="overview">
  <h2 id="ovTitle">Slide overview</h2>
  <div class="ov-grid" id="ovGrid"></div>
</div>

<div class="help" id="help">
  <div class="panel">
    <h2 data-es="Navegación">Navigation</h2>
    <table>
      <tr><td><kbd>→</kbd> <kbd>PgDn</kbd></td><td data-es="Siguiente / revelar">Next / reveal</td></tr>
      <tr><td><kbd>Space</kbd></td><td data-es="Enviar / mostrar respuesta en una comprobación">Send / reveal at a checkpoint</td></tr>
      <tr><td><kbd>←</kbd> <kbd>PgUp</kbd></td><td data-es="Anterior">Previous</td></tr>
      <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td data-es="Primera / última">First / last slide</td></tr>
      <tr><td><kbd>O</kbd></td><td data-es="Vista general">Slide overview grid</td></tr>
      <tr><td><kbd>F</kbd></td><td data-es="Pantalla completa">Toggle fullscreen</td></tr>
      <tr><td><kbd>L</kbd></td><td data-es="Idioma ES / EN">Language ES / EN</td></tr>
      <tr><td><kbd>T</kbd></td><td data-es="Tema claro / oscuro">Light / dark theme</td></tr>
      <tr><td><kbd>?</kbd></td><td>Help</td></tr>
      <tr><td><kbd>Esc</kbd></td><td data-es="Cerrar ventana">Close overlay</td></tr>
    </table>
  </div>
</div>

<script>
{{SCRIPT_JS}}
</script>
</body>
</html>
`;

export const DECK_STYLE = `/* =====================================================================
   TC2007B — Lecture deck theme (shared design; copy per lecture)
   Dark academic theme for live classroom projection:
   high contrast, large type, readable from the back of the room.
   Light theme + bilingual + click-to-reveal supported.
   ===================================================================== */

:root {
  /* Core palette */
  --bg:        #0d1726;   /* deep slate */
  --bg-2:      #122036;   /* panel */
  --bg-3:      #1b2c47;   /* raised panel */
  --ink:       #eef4ff;   /* primary text */
  --ink-soft:  #aebfd6;   /* secondary text */
  --line:      #2c3f5e;   /* hairlines */

  /* Accents */
  --accent:    #4ea1ff;   /* primary blue */
  --accent-2:  #38d6c0;   /* teal */
  --warn:      #ffb454;   /* amber (policy / caution) */
  --danger:    #ff6b6b;   /* red (threat / attack) */
  --good:      #5fe08a;   /* green (defense / available) */
  --violet:    #b18cff;   /* secondary highlight */

  /* Typography scale (back-of-room readable) */
  --fs-kicker: clamp(0.85rem, 1.4vw, 1.15rem);
  --fs-h1:     clamp(2.2rem, 5.2vw, 4.2rem);
  --fs-h2:     clamp(1.7rem, 3.8vw, 3.0rem);
  --fs-lead:   clamp(1.25rem, 2.3vw, 1.9rem);
  --fs-body:   clamp(1.05rem, 1.7vw, 1.5rem);
  --fs-small:  clamp(0.85rem, 1.2vw, 1.05rem);

  --radius: 16px;
  --maxw: 1280px;
  --pad: clamp(1.5rem, 4vw, 4.5rem);
  --font: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
  --mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
  font-size: 18px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

/* ----------------------------- Deck shell ---------------------------- */
.deck { position: fixed; inset: 0; }

.slide {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  justify-content: center;
  padding: var(--pad);
  padding-bottom: calc(var(--pad) + 64px);
  overflow: hidden;
  animation: fade .35s ease;
}
.slide.active { display: flex; }
.slide-inner { width: 100%; max-width: var(--maxw); margin: 0 auto; }

@keyframes fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* Subtle background texture per section */
.slide::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(78,161,255,.10), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(56,214,192,.08), transparent 60%);
  pointer-events: none;
}

/* ----------------------------- Typography ---------------------------- */
.kicker {
  display: inline-flex; align-items: center; gap: .55rem;
  font-size: var(--fs-kicker);
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 1rem;
}
.kicker .dot { width: .55em; height: .55em; border-radius: 50%; background: var(--accent); }

h1 { font-size: var(--fs-h1); line-height: 1.05; font-weight: 800; letter-spacing: -.02em; }
h2 { font-size: var(--fs-h2); line-height: 1.1; font-weight: 800; letter-spacing: -.015em; margin-bottom: 1.2rem; }
.lead { font-size: var(--fs-lead); color: var(--ink-soft); margin-top: 1.1rem; max-width: 28ch; }
p { font-size: var(--fs-body); }
.muted { color: var(--ink-soft); }
.accent { color: var(--accent); }
.teal { color: var(--accent-2); }
.danger { color: var(--danger); }
.good { color: var(--good); }
.warn { color: var(--warn); }
strong { color: #fff; font-weight: 700; }

/* ----------------------------- Title slide --------------------------- */
.title-slide .slide-inner { text-align: left; }
.title-meta {
  display: flex; flex-wrap: wrap; gap: .6rem 1rem;
  margin-top: 2rem; color: var(--ink-soft); font-size: var(--fs-body);
}
.title-meta .pill {
  background: var(--bg-3); border: 1px solid var(--line);
  padding: .4rem .9rem; border-radius: 999px; font-size: var(--fs-small);
}
.title-rule { height: 5px; width: 120px; background: linear-gradient(90deg,var(--accent),var(--accent-2)); border-radius: 999px; margin: 1.6rem 0; }

/* ----------------------------- Lists --------------------------------- */
ul.clean, ol.clean { list-style: none; display: flex; flex-direction: column; gap: 1.05rem; margin-top: 1.4rem; }
ul.clean li {
  position: relative;
  padding-left: 1.9rem;
  font-size: var(--fs-body);
  line-height: 1.45;
}
ul.clean li::before {
  content: "";
  position: absolute;
  left: 0;
  top: .55em;
  width: .72rem; height: .72rem;
  border-radius: 4px;
  background: var(--accent);
}
ol.clean { counter-reset: step; }
ol.clean li {
  position: relative;
  counter-increment: step;
  padding-left: 3.2rem;
  min-height: 2.1rem;
  font-size: var(--fs-body);
  line-height: 1.45;
  display: flex;
  align-items: center;
}
ol.clean li::before {
  content: counter(step);
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: grid; place-items: center;
  width: 2.1rem; height: 2.1rem; border-radius: 50%;
  background: var(--bg-3); border: 2px solid var(--accent);
  color: var(--accent); font-weight: 800; font-size: 1rem;
}

/* ----------------------------- Cards / grid -------------------------- */
.grid { display: grid; gap: 1.2rem; margin-top: 1.4rem; }
.grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 900px){ .grid.cols-2,.grid.cols-3 { grid-template-columns: 1fr; } }

.card {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.5rem 1.6rem;
}
.card h3 { font-size: var(--fs-lead); margin-bottom: .5rem; }
.card p { font-size: var(--fs-body); color: var(--ink-soft); }
.card.accent-top { border-top: 4px solid var(--accent); }
.card.danger-top { border-top: 4px solid var(--danger); }
.card.teal-top   { border-top: 4px solid var(--accent-2); }
.card.good-top   { border-top: 4px solid var(--good); }
.card.warn-top   { border-top: 4px solid var(--warn); }
.card.violet-top { border-top: 4px solid var(--violet); }
.card .ico { font-size: 1.8rem; line-height: 1; margin-bottom: .6rem; display: block; }

/* ----------------------------- Quote / definition -------------------- */
.definition {
  background: var(--bg-2);
  border-left: 6px solid var(--accent);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 1.6rem 1.8rem;
  margin-top: 1.4rem;
}
.definition .src { display:block; margin-top: 1rem; font-size: var(--fs-small); color: var(--ink-soft); }
blockquote {
  font-size: var(--fs-lead); line-height: 1.4; font-weight: 500; color: var(--ink);
}

/* ----------------------------- Flow diagram -------------------------- */
.flow { display: flex; align-items: stretch; gap: 0; flex-wrap: wrap; margin-top: 1.8rem; }
.flow .node {
  flex: 1 1 0; min-width: 150px;
  background: var(--bg-2); border: 2px solid var(--line);
  border-radius: 14px; padding: 1.1rem 1rem; text-align: center;
  position: relative;
}
.flow .node .n-label { font-weight: 800; font-size: var(--fs-body); display:block; }
.flow .node .n-sub { font-size: var(--fs-small); color: var(--ink-soft); display:block; margin-top:.3rem; }
.flow .arrow { display: grid; place-items: center; font-size: 2rem; color: var(--accent); padding: 0 .4rem; }
.flow .node.threat  { border-color: var(--danger); }
.flow .node.vuln    { border-color: var(--warn); }
.flow .node.attack  { border-color: var(--violet); }
.flow .node.breach  { border-color: var(--accent); }
.flow .node.good-node { border-color: var(--good); }
@media (max-width: 900px){
  .flow { flex-direction: column; }
  .flow .arrow { transform: rotate(90deg); padding: .2rem 0; }
}

/* ----------------------------- CIA triad ----------------------------- */
.triad { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.2rem; margin-top: 1.6rem; }
.triad .leg {
  text-align: center; padding: 1.6rem 1.2rem;
  background: var(--bg-2); border-radius: var(--radius);
  border-bottom: 5px solid var(--accent);
}
.triad .leg .big { font-size: clamp(2.4rem,5vw,3.6rem); font-weight: 900; line-height: 1; }
.triad .leg .word { font-size: var(--fs-lead); font-weight: 800; margin-top:.3rem; }
.triad .leg .desc { font-size: var(--fs-small); color: var(--ink-soft); margin-top:.6rem; }
.triad .leg.c { border-color: var(--accent); }
.triad .leg.i { border-color: var(--accent-2); }
.triad .leg.a { border-color: var(--good); }
@media (max-width: 900px){ .triad { grid-template-columns: 1fr; } }

/* ----------------------------- Compare table ------------------------- */
table.compare { width: 100%; border-collapse: collapse; margin-top: 1.4rem; font-size: var(--fs-body); }
table.compare th, table.compare td { text-align: left; padding: .9rem 1.1rem; border-bottom: 1px solid var(--line); vertical-align: top; }
table.compare thead th { color: var(--accent); font-size: var(--fs-small); text-transform: uppercase; letter-spacing: .08em; }
table.compare tbody tr:hover { background: rgba(78,161,255,.06); }
table.compare .map-from { color: var(--danger); font-weight: 600; }
table.compare .map-to { color: var(--good); font-weight: 600; }

/* ----------------------------- Two-column split ---------------------- */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6rem; align-items: start; margin-top: 1.4rem; }
@media (max-width: 900px){ .split { grid-template-columns: 1fr; } }

/* ----------------------------- Callouts ------------------------------ */
.callout {
  display: flex; gap: 1rem; align-items: flex-start;
  background: var(--bg-3); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 1.2rem 1.4rem; margin-top: 1.3rem;
}
.callout .tag {
  font-size: var(--fs-small); font-weight: 800; text-transform: uppercase; letter-spacing: .08em;
  padding: .3rem .7rem; border-radius: 8px; flex: none; white-space: nowrap;
}
.callout.policy   { border-color: var(--warn); }
.callout.policy .tag   { background: rgba(255,180,84,.15); color: var(--warn); }
.callout.discuss  { border-color: var(--violet); }
.callout.discuss .tag  { background: rgba(177,140,255,.15); color: var(--violet); }
.callout.check    { border-color: var(--accent-2); }
.callout.check .tag    { background: rgba(56,214,192,.15); color: var(--accent-2); }
.callout.note     { border-color: var(--accent); }
.callout.note .tag     { background: rgba(78,161,255,.15); color: var(--accent); }
.callout p { font-size: var(--fs-body); }

/* Placeholder for instructor-owned / unverified content */
.placeholder {
  border: 2px dashed var(--warn);
  background: repeating-linear-gradient(45deg, rgba(255,180,84,.04) 0 12px, transparent 12px 24px);
  border-radius: var(--radius); padding: 1.6rem; margin-top: 1.4rem;
  color: var(--ink-soft);
}
.placeholder .ph-tag { color: var(--warn); font-weight: 800; text-transform: uppercase; letter-spacing:.08em; font-size: var(--fs-small); }

/* ----------------------------- Activity slide ------------------------ */
.slide.activity::before { background:
  radial-gradient(1200px 700px at 50% -20%, rgba(177,140,255,.16), transparent 60%); }
.activity .badge {
  display:inline-flex; gap:.5rem; align-items:center;
  background: rgba(177,140,255,.15); color: var(--violet);
  border:1px solid var(--violet); padding:.4rem 1rem; border-radius:999px;
  font-weight:800; letter-spacing:.08em; text-transform:uppercase; font-size: var(--fs-small);
}
.timer { font-variant-numeric: tabular-nums; color: var(--violet); font-weight: 800; }

/* ----------------------------- Live checkpoint ---------------------- */
.checkpoint-slide::before {
  background:
    radial-gradient(1000px 600px at 50% 0%, rgba(56,214,192,.18), transparent 65%);
}
.checkpoint-inner {
  text-align: center;
  display: grid;
  justify-items: center;
}
.checkpoint-inner .kicker { color: var(--accent-2); }
.checkpoint-slot {
  min-height: 2rem;
  margin-top: 1.4rem;
  color: var(--ink-soft);
  font-size: var(--fs-body);
}

/* Section divider slides */
.slide.section { text-align: center; align-items: center; }
.slide.section .slide-inner { display:grid; place-items:center; }
.slide.section .num { font-size: clamp(4rem,12vw,9rem); font-weight: 900; color: var(--bg-3); line-height:.9; -webkit-text-stroke: 2px var(--accent); }
.slide.section h1 { margin-top: .4rem; }

/* ----------------------------- Concept map (SVG-ish) ----------------- */
.conceptmap { width: 100%; margin-top: 1rem; }
.conceptmap text { font-family: var(--font); }

/* ----------------------------- Chrome / UI --------------------------- */
.topbar {
  position: fixed; top: 0; left: 0; right: 0; height: 6px; z-index: 50;
  background: var(--bg-3);
}
.topbar .fill { height: 100%; width: 0; background: linear-gradient(90deg,var(--accent),var(--accent-2)); transition: width .3s ease; }

.footer {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between;
  padding: .55rem clamp(1rem,3vw,2.4rem);
  font-size: var(--fs-small); color: var(--ink-soft);
  background: linear-gradient(0deg, rgba(13,23,38,.92), transparent);
  pointer-events: none;
}
.footer .course { font-weight: 700; color: var(--ink); }
.footer .right { display: flex; gap: 1.2rem; align-items: center; }
.footer .sec-name { color: var(--accent); font-weight: 600; }
.counter { font-variant-numeric: tabular-nums; }

/* Navigation cluster — centered at the bottom so footer text stays visible */
.nav-btns { position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 45; display: flex; gap: .5rem; }
.nav-btns button, .ui-btn {
  background: var(--bg-3); color: var(--ink); border: 1px solid var(--line);
  width: 44px; height: 44px; border-radius: 12px; font-size: 1.2rem; cursor: pointer;
  display: grid; place-items: center; transition: .15s;
}
.nav-btns button:hover, .ui-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Overview grid */
.overview {
  position: fixed; inset: 0; z-index: 100; background: rgba(7,12,22,.97);
  display: none; padding: 2rem; overflow: auto;
}
.overview.open { display: block; }
.overview h2 { text-align:center; margin-bottom: 1.5rem; }
.ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 1rem; max-width: 1400px; margin: 0 auto; }
.ov-card {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px;
  padding: 1rem; cursor: pointer; transition: .15s; min-height: 90px;
}
.ov-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.ov-card .ov-num { font-size: .8rem; color: var(--accent); font-weight: 800; }
.ov-card .ov-title { font-size: .95rem; margin-top: .3rem; line-height: 1.25; }
.ov-card .ov-sec { font-size: .7rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .06em; margin-top:.4rem; }

/* Help overlay */
.help {
  position: fixed; inset: 0; z-index: 110; background: rgba(7,12,22,.96);
  display: none; place-items: center; padding: 2rem;
}
.help.open { display: grid; }
.help .panel { background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 2rem 2.4rem; max-width: 560px; }
.help h2 { margin-bottom: 1rem; }
.help kbd {
  font-family: var(--mono); background: var(--bg-3); border: 1px solid var(--line);
  border-bottom-width: 3px; border-radius: 7px; padding: .15rem .55rem; font-size: .85rem; color: var(--ink);
}
.help table { width: 100%; border-collapse: collapse; }
.help td { padding: .55rem .4rem; border-bottom: 1px solid var(--line); font-size: 1rem; }
.help td:first-child { white-space: nowrap; width: 40%; }

/* ----------------------------- Light theme --------------------------- */
:root[data-theme="light"] {
  --bg:        #f4f7fc;
  --bg-2:      #ffffff;
  --bg-3:      #e9f0fa;
  --ink:       #0f1b2d;
  --ink-soft:  #4a5b73;
  --line:      #cfdcec;
  --accent:    #1769d6;
  --accent-2:  #0c8f80;
  --warn:      #b9700f;
  --danger:    #d23b3b;
  --good:      #1d9b53;
  --violet:    #6f47cf;
}
:root[data-theme="light"] body { color: var(--ink); }
:root[data-theme="light"] strong { color: #0b1422; }
:root[data-theme="light"] .slide::before {
  background:
    radial-gradient(1200px 600px at 85% -10%, rgba(23,105,214,.07), transparent 60%),
    radial-gradient(900px 500px at -10% 110%, rgba(12,143,128,.06), transparent 60%);
}
:root[data-theme="light"] .footer { background: linear-gradient(0deg, rgba(244,247,252,.95), transparent); }
:root[data-theme="light"] .slide.section .num { color: #dde7f4; }

/* ----------------------------- Fragments (click reveal) -------------- */
.fragment {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity .35s ease, transform .35s ease;
}
.fragment.revealed { opacity: 1; transform: none; }

/* "more to reveal" hint — sits just above the centered nav cluster */
.frag-hint {
  position: fixed; bottom: 66px; left: 50%; transform: translateX(-50%);
  z-index: 44; display: none;
  align-items: center; gap: .5rem;
  background: var(--bg-3); border: 1px solid var(--line);
  color: var(--ink-soft); padding: .35rem .9rem; border-radius: 999px;
  font-size: var(--fs-small);
}
.frag-hint.show { display: inline-flex; }
.frag-hint .chev { color: var(--accent); animation: bob 1.4s ease-in-out infinite; }
@keyframes bob { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(3px);} }

/* Reveal box used for hidden quiz answers */
.reveal-answer {
  margin-top: 1.2rem;
  background: var(--bg-2);
  border: 1px solid var(--accent-2);
  border-left: 6px solid var(--accent-2);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 1.1rem 1.4rem;
}
.reveal-answer .ra-tag {
  color: var(--accent-2); font-weight: 800; text-transform: uppercase;
  letter-spacing: .08em; font-size: var(--fs-small); display:block; margin-bottom:.4rem;
}

/* ----------------------------- Control buttons ----------------------- */
.controls { position: fixed; top: 16px; right: 16px; z-index: 46; display: flex; gap: .5rem; }
.controls .ui-btn {
  background: var(--bg-3); color: var(--ink); border: 1px solid var(--line);
  height: 40px; min-width: 40px; padding: 0 .7rem; border-radius: 10px;
  font-size: .95rem; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; gap: .4rem; transition: .15s;
}
.controls .ui-btn:hover { border-color: var(--accent); color: var(--accent); }

/* small caption under figures */
.figure-note { font-size: var(--fs-small); color: var(--ink-soft); margin-top: .8rem; font-style: italic; }

/* compact stat grid */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 1rem; margin-top: 1.3rem; }
.stat {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 1.2rem 1.3rem; border-top: 4px solid var(--danger);
}
.stat .big { font-size: clamp(1.8rem,3.4vw,2.6rem); font-weight: 900; line-height: 1; color: var(--ink); }
.stat .lbl { font-size: var(--fs-small); color: var(--ink-soft); margin-top: .5rem; }
.stat.cost { border-top-color: var(--warn); }
.stat.legal { border-top-color: var(--violet); }
.stat.people { border-top-color: var(--accent); }
.stat.good-stat { border-top-color: var(--good); }

/* Print: one slide per page */
@media print {
  html, body { overflow:
`;

export const DECK_SCRIPT = `/* =====================================================================
   Generated lecture deck presenter engine
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
    fragHint: ["click to reveal", "clic para revelar"],
    checkpointReady: ["Ready to send from the class controls.", "Lista para enviar desde los controles de la clase."],
    checkpointSent: ["Question sent to students.", "Pregunta enviada a estudiantes."],
    checkpointRevealed: ["Answer revealed.", "Respuesta mostrada."]
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
    updateCheckpointSlot();
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
    notifyParent({
      type: "deck.slide_changed",
      slide: current + 1,
      teaching_slide: Number(s.getAttribute("data-teaching-slide")) || null
    });
    var checkpointKey = s.getAttribute("data-checkpoint-key");
    if (checkpointKey) {
      notifyParent({
        type: "deck.checkpoint_entered",
        checkpoint_key: checkpointKey,
        after_slide: Number(s.getAttribute("data-after-slide"))
      });
    }
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
  function updateCheckpointSlot() {
    var slide = slides[current];
    var slot = slide && slide.querySelector(".checkpoint-slot");
    if (!slot) return;
    var state = slide.getAttribute("data-checkpoint-state");
    var copy = state === "ready" ? uiText.checkpointReady
      : state === "sent" ? uiText.checkpointSent
      : state === "revealed" ? uiText.checkpointRevealed
      : null;
    slot.textContent = copy ? copy[lang === "es" ? 1 : 0] : "";
  }

  /* ---- Same-origin parent bridge ---- */
  function notifyParent(message) {
    if (parent === window) return;
    var payload = {};
    Object.keys(message).forEach(function (key) { payload[key] = message[key]; });
    payload.version = 1;
    parent.postMessage(payload, location.origin);
  }

  function validParentMessage(value) {
    if (!value || typeof value !== "object") return false;
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    var ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(function (key) { return typeof key !== "string"; })) return false;
    var descriptors = Object.getOwnPropertyDescriptors(value);
    if (ownKeys.some(function (key) {
      return !Object.prototype.hasOwnProperty.call(descriptors[key], "value")
        || !descriptors[key].enumerable
        || typeof descriptors[key].value === "function";
    })) return false;
    var keys = Object.getOwnPropertyNames(value).sort();
    if (keys.join(",") !== "checkpoint_key,type,version") return false;
    if (value.version !== 1 || typeof value.checkpoint_key !== "string" || !value.checkpoint_key.trim()) {
      return false;
    }
    return [
      "checkpoint.question_ready",
      "checkpoint.question_sent",
      "checkpoint.answer_revealed",
      "checkpoint.resume"
    ].indexOf(value.type) >= 0;
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (!validParentMessage(event.data)) return;
    var slide = slides[current];
    var checkpointKey = slide.getAttribute("data-checkpoint-key");
    if (!checkpointKey || event.data.checkpoint_key !== checkpointKey) return;

    if (event.data.type === "checkpoint.resume") {
      next();
      return;
    }
    var state = event.data.type === "checkpoint.question_ready" ? "ready"
      : event.data.type === "checkpoint.question_sent" ? "sent"
      : "revealed";
    slide.setAttribute("data-checkpoint-state", state);
    updateCheckpointSlot();
  });

  /* ---- Keyboard / presenter remote ---- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        var checkpointKey = slides[current].getAttribute("data-checkpoint-key");
        if (checkpointKey) {
          notifyParent({
            type: "deck.checkpoint_skipped",
            checkpoint_key: checkpointKey
          });
        }
        next();
        break;
      case " ":
        e.preventDefault();
        var checkpointKey = slides[current].getAttribute("data-checkpoint-key");
        if (checkpointKey) {
          notifyParent({
            type: "deck.checkpoint_action",
            checkpoint_key: checkpointKey
          });
        } else next();
        break;
      case "ArrowDown": case "PageDown":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); show(0, "back"); break;
      case "End":  e.preventDefault(); show(total - 1, "back"); break;
      case "f": case "F": toggleFullscreen(); break;
      case "o": case "O": toggleOverview(); break;
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
  notifyParent({ type: "deck.ready", slide: current + 1 });
})();
`;
