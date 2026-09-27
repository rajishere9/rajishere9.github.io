// The Scale of AI: a log-scale descent through the training compute of every notable AI model.
// Vertical position = training compute (one screen-ish per power of ten); horizontal = publication date.
const $ = (s) => document.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const H100 = 989e12;            // NVIDIA H100 SXM, dense BF16 peak, FLOP/s
const PEOPLE = 8.2e9;           // UN World Population Prospects 2024
const UNIVERSE_S = 13.8e9 * 365.25 * 86400;

const DOMAINS = [
  ["Language", "#f4b860"], ["Multimodal", "#ff9f6e"], ["Vision", "#b494e8"], ["Image generation", "#e58bd6"],
  ["Games", "#6fd6a8"], ["Speech", "#7cc7ff"], ["Biology", "#9be15d"], ["Robotics", "#5fd3d3"],
];
const OTHER = "#a69daa";
const colorOf = (m) => (DOMAINS.find(([d]) => d === m.m) || [0, OTHER])[1];
const domainOf = (m) => (DOMAINS.some(([d]) => d === m.m) ? m.m : "Other");

// Short context for landmark models. Numbers on the cards always come from the dataset itself.
const STORIES = {
  "Theseus": "Claude Shannon's mechanical mouse learned its way through a maze by trial and error, one of the first demonstrations of machine learning.",
  "Perceptron Mark I": "Frank Rosenblatt's perceptron learned to sort simple images into categories. Today's neural networks are its direct descendants.",
  "TD-Gammon": "A backgammon program that taught itself by playing against itself, and became one of the strongest players of its day.",
  "LeNet-5": "Yann LeCun's convolutional network learned to read handwritten digits, and versions of it were used to read bank checks.",
  "AlexNet": "Trained on two gaming GPUs, it won the 2012 ImageNet image-recognition challenge by a wide margin and set off the deep learning boom.",
  "Transformer": "The “Attention Is All You Need” paper introduced the Transformer, the architecture behind nearly every modern language model.",
  "AlphaGo Lee": "The version of DeepMind's AlphaGo that beat Go world champion Lee Sedol 4–1 in 2016.",
  "AlphaGo Zero": "Learned Go entirely by playing itself, with no human games, and beat the version that defeated Lee Sedol 100 games to 0.",
  "BERT-Large": "Google's BERT learned language by filling in blanked-out words, and soon helped power Google Search.",
  "GPT-2 (1.5B)": "OpenAI first held back the full model over misuse concerns, then released it in stages through 2019.",
  "GPT-3 175B (davinci)": "Showed that a big enough language model could pick up new tasks from just a few examples in its prompt.",
  "AlphaFold 2": "Predicted protein structures with accuracy rivaling lab experiments. Its creators went on to share the 2024 Nobel Prize in Chemistry.",
  "DALL-E": "Turned text descriptions into images, from avocado-shaped armchairs to radishes walking dogs.",
  "Chinchilla": "Showed that most big models were undertrained: a smaller model fed far more data beat much larger ones.",
  "PaLM (540B)": "Google's 540-billion-parameter language model.",
  "GPT-4 (Mar 2023)": "The model behind ChatGPT's big 2023 upgrade. OpenAI never disclosed its size, so the compute here is Epoch's estimate.",
  "Llama 3.1-405B": "Meta's largest open-weight model of 2024, which anyone could download and run.",
  "DeepSeek-V3": "An open-weight model from China that reached frontier-level results with a strikingly small training budget.",
  "Grok 3": "xAI's model, trained on its Colossus supercomputer.",
};
const HUMAN_NOTES = [
  { f: 1, eyebrow: "Where we start", title: "One calculation", body: "A single floating-point operation, or FLOP: one multiplication or addition of two decimal numbers, like 3.7 × 1.2. Everything on this page is counted in these." },
  { f: 86400, eyebrow: "Human scale", title: "A day of arithmetic", body: "Do one sum every second for 24 hours straight, no breaks, and you'd reach 86,400." },
  { f: 80 * 365.25 * 86400, eyebrow: "Human scale", title: "A whole lifetime", body: "One sum a second, every second of an 80-year life, comes to about 2.5 billion." },
  { f: H100, eyebrow: "Machine scale", title: "One second of a GPU", body: "NVIDIA's H100, a workhorse of today's AI data centers, peaks at about 989 trillion operations per second.", link: ["NVIDIA H100 specs", "https://www.nvidia.com/en-us/data-center/h100/"] },
  { f: PEOPLE * 365.25 * 86400, eyebrow: "Human scale", title: "All of humanity, for a year", body: "If all 8.2 billion people on Earth did one sum a second, nonstop, for a full year, together they'd reach about 2.6 × 10¹⁷.", link: ["UN population data", "https://population.un.org/wpp/"] },
  { f: H100 * 86400, eyebrow: "Machine scale", title: "One GPU, one day", body: "A single H100 running flat out for 24 hours." },
  { f: H100 * 365.25 * 86400, eyebrow: "Machine scale", title: "One GPU, one year", body: "A single H100 running flat out for a full year." },
  { f: H100 * 365.25 * 86400 * 1e4, eyebrow: "Machine scale", title: "Ten thousand GPUs, one year", body: "Ten thousand H100s running flat out for a year. The biggest training runs are now around here." },
];

// ---------- formatting ----------
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).split("").map((d) => (d === "-" ? "⁻" : SUP[+d])).join("");
const NAMES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion"];
function sci(v, digits = 2) {
  const e = Math.floor(Math.log10(v)), m = v / 10 ** e;
  const ms = m.toFixed(digits - 1).replace(/\.0+$/, "");
  return e < 4 ? Math.round(v).toLocaleString() : `${ms === "1" ? "" : `${ms} × `}10${sup(e)}`;
}
function words(v) {
  if (v < 1000) return `${Math.round(v).toLocaleString()}`;
  const g = Math.min(NAMES.length - 1, Math.floor(Math.log10(v) / 3));
  const lead = v / 10 ** (g * 3);
  return `${lead >= 100 ? Math.round(lead) : +lead.toPrecision(2)} ${NAMES[g]}`;
}
function duration(s) {
  if (s < 1e-9) return "under a billionth of a second";
  if (s < 1e-6) return `${+(s * 1e9).toPrecision(2)} nanoseconds`;
  if (s < 1e-3) return `${+(s * 1e6).toPrecision(2)} microseconds`;
  if (s < 1) return `${+(s * 1e3).toPrecision(2)} milliseconds`;
  if (s < 90) return `${+s.toPrecision(2)} second${s >= 1.5 ? "s" : ""}`;
  if (s < 5400) return `${Math.round(s / 60)} minutes`;
  if (s < 172800) return `${+(s / 3600).toPrecision(2)} hours`;
  if (s < 3.156e7 * 2) return `${Math.round(s / 86400)} days`;
  const y = s / 3.156e7;
  if (s > UNIVERSE_S * 2) return `${words(s / UNIVERSE_S)} times the age of the universe`;
  if (y < 1000) return `${Math.round(y)} years`;
  return `${words(y)} years`;
}
const money = (v) => (v >= 1e9 ? `$${+(v / 1e9).toPrecision(2)}B` : v >= 1e6 ? `$${+(v / 1e6).toPrecision(2)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);
const params = (p) => (p >= 1e12 ? `${+(p / 1e12).toPrecision(3)}T` : p >= 1e9 ? `${+(p / 1e9).toPrecision(3)}B` : p >= 1e6 ? `${+(p / 1e6).toPrecision(3)}M` : p >= 1e3 ? `${+(p / 1e3).toPrecision(3)}K` : `${p}`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const year = (m) => m.d.slice(0, 4);
const CONF = { c: "Confident", l: "Likely", s: "Speculative" };

// ---------- geometry ----------
const BREAKS = [[1950, 0], [2005, 0.13], [2016, 0.36], [2027, 1]];
function xOf(d) {
  const [y, mo, da] = d.split("-").map(Number);
  const t = y + ((mo - 1) * 30.4 + da) / 365.25;
  for (let i = 1; i < BREAKS.length; i++) {
    const [y0, x0] = BREAKS[i - 1], [y1, x1] = BREAKS[i];
    if (t <= y1 || i === BREAKS.length - 1) return 13 + 84 * (x0 + ((Math.min(t, y1) - y0) / (y1 - y0)) * (x1 - x0));
  }
}

let data, models, logs, DEC, PAD, END_LOG, stage, plot, stageTop = 0, H = [], CUM = [0];
const active = new Set(DOMAINS.map(([d]) => d).concat("Other"));

// Each power of ten gets room in proportion to how many models live there, so empty early decades
// pass quickly and the crowded modern era spreads out. Every decade stays labeled.
function yOf(logv) {
  const e = Math.max(0, Math.min(H.length - 1, Math.floor(logv)));
  return PAD + CUM[e] + (logv - e) * H[e];
}
function logOf(y) {
  const t = y - PAD;
  let e = 0;
  while (e < H.length - 1 && CUM[e + 1] <= t) e++;
  return e + (t - CUM[e]) / H[e];
}

function layout() {
  stage = $("#stage"); plot = $("#plot");
  DEC = Math.round(Math.max(380, Math.min(760, innerHeight * 0.66)));
  PAD = Math.round(DEC * 0.45);
  END_LOG = Math.log10(models[models.length - 1].f) + 0.35;
  const counts = Array(Math.ceil(END_LOG) + 1).fill(0);
  for (const l of logs) counts[Math.floor(l)]++;
  // Story cards need room too: a decade holding several of them gets stretched to fit.
  const noteCounts = Array(counts.length).fill(0);
  for (const f of noteFs()) noteCounts[Math.min(counts.length - 1, Math.floor(Math.log10(f)))]++;
  const cardH = innerWidth < 900 ? 330 : 290;
  H = counts.map((n, e) => Math.round(Math.max(DEC * Math.max(0.55, Math.min(1.5, 0.5 + n * 0.018)), noteCounts[e] * cardH)));
  CUM = [0];
  H.forEach((h, i) => (CUM[i + 1] = CUM[i] + h));
  const height = yOf(END_LOG) + Math.round(innerHeight * 0.3);
  stage.style.height = `${height}px`;
  plot.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (let e = 0; e <= Math.floor(END_LOG); e++) {
    const line = document.createElement("div");
    line.className = `decade${e % 3 === 0 ? " major" : ""}`;
    line.style.top = `${yOf(e)}px`;
    line.innerHTML = `<b>10${sup(e)}</b><small>${e === 0 ? "one" : words(10 ** e)}</small>`;
    frag.appendChild(line);
  }
  for (const y of [1960, 1980, 2000, 2010, 2015, 2020, 2022, 2024, 2026]) {
    const l = document.createElement("div");
    l.className = "yearline"; l.style.left = `${xOf(`${y}-01-01`)}%`;
    frag.appendChild(l);
  }
  const ticks = plot.clientWidth < 600 ? [1950, 2010, 2016, 2020, 2022, 2024, 2026] : [1950, 1990, 2010, 2015, 2020, 2022, 2024, 2026];
  $("#axis-in").innerHTML = ticks.map((y) => `<span class="${y >= 2010 ? "era" : ""}" style="left:${xOf(`${y}-01-01`)}%">${y}</span>`).join("");

  // Dots
  models.forEach((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `dot${m.k === "s" ? " spec" : ""}${m.x ? " frontier" : ""}`;
    const s = m.p ? Math.max(6, Math.min(16, 5 + (Math.log10(m.p) - 3) * 0.8)) : 8;
    b.style.cssText = `--c:${colorOf(m)};--s:${s.toFixed(1)}px;left:${xOf(m.d)}%;top:${yOf(Math.log10(m.f))}px`;
    b.dataset.i = i;
    b.setAttribute("aria-label", `${m.n}, ${m.o}, ${year(m)}: ${sci(m.f)} FLOP`);
    m.el = b;
    frag.appendChild(b);
  });
  plot.appendChild(frag);

  // Labels: landmarks first, then frontier models, skipping any that would collide.
  const width = plot.clientWidth, placed = [];
  const rank = (m) => (STORIES[m.n] ? 3 : m.x ? 2 : 0) + Math.log10(m.f) / 100;
  const order = models.map((m, i) => i).sort((a, b) => rank(models[b]) - rank(models[a]));
  const maxLabels = width < 500 ? 40 : 110;
  for (const i of order) {
    const m = models[i];
    if (placed.length >= maxLabels || rank(m) < 1) break;
    const x = (xOf(m.d) / 100) * width, y = yOf(Math.log10(m.f));
    const w = (m.n.length + 6) * 6.7 + 10, h = 18;
    const left = x > width * 0.62;
    const rect = left ? [x - w - 10, y - h / 2, x - 10, y + h / 2] : [x + 10, y - h / 2, x + w + 10, y + h / 2];
    if (rect[0] < 44 || rect[2] > width - 2) continue;
    if (placed.some((r) => r[0] < rect[2] + 4 && rect[0] < r[2] + 4 && r[1] < rect[3] + 3 && rect[1] < r[3] + 3)) continue;
    placed.push(rect);
    const l = document.createElement("span");
    l.className = `label${left ? " left" : ""}`;
    l.style.left = `${left ? x - 10 : x + 10}px`; l.style.top = `${y}px`;
    l.innerHTML = `${esc(m.n)}<small>${year(m)}</small>`;
    m.label = l;
    plot.appendChild(l);
  }

  buildNotes();
  applyFilter();
  observe();
  stageTop = stage.getBoundingClientRect().top + scrollY;
  update();
}

function noteFs() {
  const top = models[models.length - 1];
  return [...HUMAN_NOTES.map((n) => n.f), ...models.filter((m) => STORIES[m.n]).map((m) => m.f), ...(STORIES[top.n] ? [] : [top.f])];
}

function noteHtml(n) {
  if (n.model) {
    const m = n.model;
    const chips = [
      `${sci(m.f)} FLOP${m.k === "s" ? " (estimate)" : ""}`,
      m.p ? `${params(m.p)} parameters` : "",
      m.q && m.h ? `${Math.round(m.q).toLocaleString()} × ${esc(m.h.replace(/^NVIDIA |^Google /, ""))}` : "",
      m.$ ? `≈ ${money(m.$)} to train` : "",
      `= ${duration(m.f / H100)} on one H100`,
    ].filter(Boolean);
    return `<div class="note-card" style="--c:${colorOf(m)}"><p class="eyebrow">${year(m)}<span>${esc(m.o)}</span></p><h3>${esc(m.n)}</h3><p>${esc(n.body)}</p><div class="stat">${chips.map((c) => `<span>${c}</span>`).join("")}</div>${m.u ? `<a class="more" href="${esc(m.u)}" target="_blank" rel="noopener">Source ↗</a>` : ""}</div><span class="tick" style="--c:${colorOf(m)}"></span>`;
  }
  return `<div class="note-card" style="--c:var(--flame)"><p class="eyebrow">${esc(n.eyebrow)}<span>≈ ${sci(n.f)} FLOP</span></p><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>${n.link ? `<a class="more" href="${n.link[1]}" target="_blank" rel="noopener">${esc(n.link[0])} ↗</a>` : ""}</div><span class="tick"></span>`;
}

function buildNotes() {
  const box = $("#notes");
  box.innerHTML = "";
  const top = models[models.length - 1];
  const notes = [...HUMAN_NOTES.map((n) => ({ ...n }))];
  for (const m of models) if (STORIES[m.n]) notes.push({ f: m.f, model: m, body: STORIES[m.n] });
  if (!STORIES[top.n]) notes.push({ f: top.f, model: top, body: `The largest training run in the dataset.${top.k !== "c" ? " The compute is Epoch's estimate, since the developer hasn't published it." : ""}` });
  notes.sort((a, b) => a.f - b.f);
  let bottom = -Infinity;
  for (const n of notes) {
    const el = document.createElement("div");
    el.className = `note${n.model ? "" : " human"}`;
    el.innerHTML = noteHtml(n);
    box.appendChild(el);
    const ideal = yOf(Math.log10(n.f)) - 26;
    const t = Math.max(ideal, bottom + 22);
    el.style.top = `${t}px`;
    el.querySelector(".tick").style.top = `${Math.max(14, Math.min(el.offsetHeight - 14, ideal + 26 - t))}px`;
    bottom = t + el.offsetHeight;
  }
  if (bottom + 60 > stage.offsetHeight) stage.style.height = `${bottom + 60}px`;
}

let io;
function observe() {
  io?.disconnect();
  io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".dot, .label, .note").forEach((el) => (reduced ? el.classList.add("in") : io.observe(el)));
}

// ---------- scroll ----------
let hot = [], ticking = false, eqIdx = 0;
function lower(v) { let lo = 0, hi = logs.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (logs[mid] < v) lo = mid + 1; else hi = mid; } return lo; }

function update() {
  ticking = false;
  const center = scrollY + innerHeight / 2 - stageTop;
  const logv = Math.max(0, Math.min(END_LOG - 0.35, logOf(center)));
  const inStage = center > PAD * 0.5 && center < yOf(END_LOG) + innerHeight * 0.1;
  document.body.classList.toggle("diving", inStage);
  const v = 10 ** logv;
  document.documentElement.style.setProperty("--depth", (logv / (END_LOG - 0.35)).toFixed(4));
  $("#hud-exp").textContent = sci(v);
  $("#hud-words").textContent = v < 1.5 ? "1 calculation (FLOP)" : v < 1e4 ? "calculations (FLOP)" : `${words(v)} FLOP`;
  $("#scan-label").textContent = `10${sup(Math.floor(logv))}`;
  $("#eq-you").textContent = duration(v);
  $("#eq-earth").textContent = duration(v / PEOPLE);
  $("#eq-gpu").textContent = duration(v / H100);
  const passed = lower(logv);
  $("#hud-passed").textContent = passed;
  $("#hud-of").textContent = `of ${models.length} models passed`;

  const a = lower(logv - 0.06), b = lower(logv + 0.06);
  for (const m of hot) m.el.classList.remove("hot");
  hot = models.slice(a, b);
  for (const m of hot) m.el.classList.add("hot");
  if (pinned && Math.abs(yOf(Math.log10(pinned.f)) - center) > innerHeight * 0.8) closeCard();
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
let rt;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const keep = logOf(scrollY + innerHeight / 2 - stageTop); layout(); if (keep > 0) scrollTo(0, stageTop + yOf(keep) - innerHeight / 2); }, 200); });

// Mobile HUD shows one comparison at a time; tap to cycle.
function cycleEquiv() {
  const items = [...document.querySelectorAll(".equiv div")];
  items.forEach((d, i) => d.classList.toggle("on", i === eqIdx % items.length));
  eqIdx++;
}
$("#hud").addEventListener("click", cycleEquiv);
setInterval(() => { if (document.body.classList.contains("diving") && innerWidth <= 760) cycleEquiv(); }, 3800);
cycleEquiv();

// ---------- detail card ----------
const card = $("#card");
let pinned = null;
function showCard(m, pin, anchor) {
  const eq = m.f / H100;
  card.style.setProperty("--c", colorOf(m));
  card.innerHTML = `<button class="icon-btn x" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <span class="dom"><i></i>${esc(domainOf(m))}${m.x ? " · Frontier model" : ""}</span>
  <h3 id="card-name">${esc(m.n)}</h3>
  <p class="by">${esc(m.o)} · ${new Date(`${m.d}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}${m.c ? ` · ${esc(m.c)}` : ""}</p>
  <p class="flop">${sci(m.f, 3)}<small>FLOP</small><span class="conf ${m.k}">${CONF[m.k]}</span></p>
  <dl>
    ${m.p ? `<dt>Parameters</dt><dd>${params(m.p)}</dd>` : ""}
    ${m.h ? `<dt>Hardware</dt><dd>${m.q ? `${Math.round(m.q).toLocaleString()} × ` : ""}${esc(m.h)}</dd>` : ""}
    ${m.$ ? `<dt>Est. training cost</dt><dd>${money(m.$)} <small>(2023 USD)</small></dd>` : ""}
    <dt>On one H100</dt><dd>${duration(eq)}</dd>
    <dt>By hand</dt><dd>${duration(m.f)}</dd>
  </dl>
  ${m.a ? `<p class="abs">“${esc(m.a)}”</p>` : ""}
  ${m.u ? `<a class="src" href="${esc(m.u)}" target="_blank" rel="noopener">Source ↗</a>` : ""}`;
  card.hidden = false;
  if (innerWidth > 760) {
    const r = anchor.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
    let left = r.right + 16; if (left + cw > innerWidth - 12) left = r.left - cw - 16;
    let top = Math.min(innerHeight - ch - 110, Math.max(80, r.top - ch / 2));
    card.style.left = `${Math.max(12, left)}px`; card.style.top = `${top}px`;
  }
  document.querySelectorAll(".dot.sel").forEach((d) => d.classList.remove("sel"));
  if (pin) { pinned = m; m.el.classList.add("sel"); }
  card.querySelector(".x").onclick = closeCard;
}
function closeCard() { card.hidden = true; pinned = null; document.querySelectorAll(".dot.sel").forEach((d) => d.classList.remove("sel")); }

$("#plot").addEventListener("click", (e) => {
  const d = e.target.closest(".dot");
  if (!d) return;
  const m = models[+d.dataset.i];
  if (pinned === m) closeCard(); else showCard(m, true, d);
});
$("#plot").addEventListener("pointerover", (e) => {
  const d = e.target.closest(".dot");
  if (!d || e.pointerType !== "mouse" || pinned) return;
  showCard(models[+d.dataset.i], false, d);
});
$("#plot").addEventListener("pointerout", (e) => { if (e.target.closest(".dot") && !pinned && e.pointerType === "mouse") card.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCard(); });
document.addEventListener("pointerdown", (e) => { if (pinned && !card.contains(e.target) && !e.target.closest(".dot")) closeCard(); });

// ---------- find ----------
const find = $("#find"), findList = $("#find-list");
let found = [], fIdx = 0;
function goTo(m) {
  findList.hidden = true; find.value = m.n; find.blur();
  if (!active.has(domainOf(m))) { active.add(domainOf(m)); syncLegend(); applyFilter(); }
  const target = stageTop + yOf(Math.log10(m.f)) - innerHeight / 2;
  smoothScroll(target, Math.min(2600, 700 + Math.abs(target - scrollY) / 12), () => {
    m.el.classList.add("in", "ping");
    setTimeout(() => m.el.classList.remove("ping"), 3000);
    showCard(m, true, m.el);
  });
}
find.addEventListener("input", () => {
  const q = find.value.trim().toLowerCase();
  if (!q) { findList.hidden = true; return; }
  found = models.filter((m) => m.n.toLowerCase().includes(q) || m.o.toLowerCase().includes(q))
    .sort((a, b) => (a.n.toLowerCase().startsWith(q) ? 0 : 1) - (b.n.toLowerCase().startsWith(q) ? 0 : 1) || b.f - a.f).slice(0, 8);
  fIdx = 0;
  findList.innerHTML = found.length ? found.map((m, i) => `<li role="option" data-i="${i}" aria-selected="${i === 0}"><span>${esc(m.n)}</span><small>${esc(m.o.split(",")[0])} · ${year(m)}</small></li>`).join("") : `<li aria-disabled="true"><span>No model found</span></li>`;
  findList.hidden = false;
});
find.addEventListener("keydown", (e) => {
  if (findList.hidden || !found.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); fIdx = (fIdx + (e.key === "ArrowDown" ? 1 : found.length - 1)) % found.length;
    [...findList.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === fIdx)));
  } else if (e.key === "Enter") { e.preventDefault(); goTo(found[fIdx]); }
  else if (e.key === "Escape") findList.hidden = true;
});
findList.addEventListener("pointerdown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); goTo(found[+li.dataset.i]); } });
find.addEventListener("blur", () => setTimeout(() => (findList.hidden = true), 150));

// ---------- legend ----------
function syncLegend() { document.querySelectorAll(".legend button").forEach((b) => b.setAttribute("aria-pressed", String(active.has(b.dataset.d)))); }
function applyFilter() {
  for (const m of models) {
    const on = active.has(domainOf(m));
    m.el.classList.toggle("dim", !on);
    m.label?.classList.toggle("dim", !on);
  }
}
function buildLegend() {
  const counts = {};
  for (const m of models) counts[domainOf(m)] = (counts[domainOf(m)] || 0) + 1;
  const list = [...DOMAINS.filter(([d]) => counts[d]), ["Other", OTHER]];
  $("#legend").innerHTML = list.map(([d, c]) => `<button type="button" data-d="${d}" aria-pressed="true" style="--c:${c}" title="${counts[d] || 0} models"><i></i>${d}</button>`).join("");
  $("#legend").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset.d;
    // First click solos a field; clicking the soloed field again brings everything back.
    if (active.size === list.length) { active.clear(); active.add(d); }
    else if (active.has(d) && active.size === 1) list.forEach(([x]) => active.add(x));
    else if (active.has(d)) active.delete(d); else active.add(d);
    syncLegend(); applyFilter();
  });
}

// ---------- motion helpers ----------
function smoothScroll(to, ms, done) {
  if (reduced) { scrollTo(0, to); done?.(); return; }
  const from = scrollY, start = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    scrollTo(0, from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(step); else done?.();
  };
  requestAnimationFrame(step);
}

function toast(msg) {
  const t = $(".toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- boot ----------
const topbar = $(".top");
addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 8), { passive: true });

async function boot() {
  data = await fetch("data.json").then((r) => r.json());
  models = data.models.filter((m) => m.f >= 1).sort((a, b) => a.f - b.f);
  logs = models.map((m) => Math.log10(m.f));
  const first = models[0], top = models[models.length - 1];
  const orders = Math.round(Math.log10(top.f / first.f));

  $("#lede").innerHTML = `In ${year(first)}, <b>${esc(first.n)}</b>${first.n === "Theseus" ? ", a maze-solving mechanical mouse," : ""} learned with about <em>${sci(first.f)}</em> calculations. In ${year(top)}, <b>${esc(top.n)}</b> from ${esc(top.o)} was trained with an estimated <em>${sci(top.f)}</em>. That's ${orders} orders of magnitude apart. Scroll down and fall through every one of them.`;
  $("#intro-meta").textContent = `${models.length} models · data from Epoch AI, updated ${new Date(`${data.updated}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  buildLegend();
  layout();

  // Finale
  $("#finale-title").innerHTML = `You've reached <em>${esc(top.n).replace(/-/g, "\u2011")}</em>.`;
  $("#facts").innerHTML = [
    [models.length, `notable AI models with known training compute, from ${year(first)} to ${year(top)}`],
    [`${orders}`, "orders of magnitude between the first and the largest"],
    data.growth ? [`${data.growth}×`, `per year: how fast frontier training compute has grown since 2010 (fit to ${data.frontierCount} frontier models)`] : null,
  ].filter(Boolean).map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");
  $("#finale-line").textContent = `Doing ${top.n}'s training run by hand, one sum a second, would take ${duration(top.f)}. All of humanity working together would need ${duration(top.f / PEOPLE)}.`;
  $("#method-text").innerHTML = `Training compute figures come from <a href="${esc(data.source.url)}" target="_blank" rel="noopener">${esc(data.source.name)}</a> (${esc(data.source.license)}), last updated ${esc(data.updated)}. Most are Epoch's estimates, each with a confidence level; hollow dots are speculative. Dot size shows parameter count where known, and ringed dots are models Epoch lists as frontier models. Human comparisons assume one operation per second per person and a world population of 8.2 billion (UN World Population Prospects 2024). GPU comparisons use one NVIDIA H100 SXM at its dense BF16 peak of about 989 trillion FLOP per second. Real training runs don't reach peak speed, so treat those as rough.`;
  $("#table tbody").innerHTML = models.slice().reverse().map((m) => `<tr><td>${esc(m.n)}</td><td>${esc(m.o)}</td><td>${m.d}</td><td>${sci(m.f, 3)}</td><td>${CONF[m.k]}</td></tr>`).join("");
}

$("#dive").addEventListener("click", () => smoothScroll(stageTop - 20, 1200));
$("#ascend").addEventListener("click", () => smoothScroll(0, Math.min(4200, 1400 + scrollY / 20)));
$("#share").addEventListener("click", async () => {
  const text = `I just fell through ${Math.round(Math.log10(models[models.length - 1].f / models[0].f))} orders of magnitude of AI compute, from a 1950 robot mouse to today's frontier models.`;
  const url = "https://www.rkjdev.com/play/scale-of-ai/";
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "The Scale of AI", text, url });
    else { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied!"); }
  } catch (e) { if (e.name !== "AbortError") toast("Couldn't share, sorry"); }
});

boot().catch(() => { $("#lede").textContent = "Couldn't load the data. Check your connection and refresh."; });

// Dust drifting upward as you fall, in three parallax layers.
(function motes() {
  const cv = $("#motes"), ctx = cv.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const colors = ["244,184,96", "180,148,232", "239,231,220"];
  let W, Hh, pts;
  const size = () => {
    W = innerWidth; Hh = innerHeight; cv.width = W * dpr; cv.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = Array.from({ length: Math.round(Math.min(110, W / 12)) }, () => ({ x: Math.random() * W, y: Math.random() * Hh, z: [0.25, 0.55, 1][(Math.random() * 3) | 0], r: Math.random() * 1.4 + 0.4, c: colors[(Math.random() * 3) | 0], a: Math.random() * 0.35 + 0.1, t: Math.random() * 6 }));
  };
  size(); addEventListener("resize", size);
  let last = scrollY;
  const draw = (now) => {
    const dy = scrollY - last; last = scrollY;
    ctx.clearRect(0, 0, W, Hh);
    const heat = +getComputedStyle(document.documentElement).getPropertyValue("--depth") || 0;
    for (const p of pts) {
      p.y -= dy * p.z * 0.6 + (reduced ? 0 : 0.08 * p.z);
      if (p.y < -4) p.y += Hh + 8; if (p.y > Hh + 4) p.y -= Hh + 8;
      const tw = reduced ? 1 : 0.75 + 0.25 * Math.sin(now / 900 + p.t);
      ctx.fillStyle = `rgba(${p.c},${(p.a * tw * (0.6 + heat * 0.8)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.8 + p.z * 0.6), 0, 7); ctx.fill();
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();
