// The Scale of AI: a log-scale descent through the training compute of every notable AI model.
// Down = more training compute (a log ruler on the left); across = publication date.
const $ = (s) => document.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const H100 = 989e12;            // NVIDIA H100 SXM, dense BF16 peak, FLOP/s
const PEOPLE = 8.2e9;           // UN World Population Prospects 2024
const UNIVERSE_S = 13.8e9 * 365.25 * 86400;

const FIELDS = [
  ["Language", "#f2b45c"], ["Multimodal", "#e88f6a"], ["Vision", "#a98be0"], ["Image generation", "#d67fc0"],
  ["Games", "#7cc9a0"], ["Speech", "#79b6e6"], ["Biology", "#a9cf6b"], ["Robotics", "#6cc4c4"],
];
const OTHER = "#8d8591";
const fieldOf = (m) => (FIELDS.some(([d]) => d === m.m) ? m.m : "Other");
const colorOf = (m) => (FIELDS.find(([d]) => d === m.m) || [0, OTHER])[1];

// Short context for landmark models. Numbers always come from the dataset itself.
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
  { f: 1, when: "Where we start", title: "One calculation", body: "A single floating-point operation, or FLOP: one multiplication or addition of two decimal numbers, like 3.7 × 1.2. Everything below is counted in these." },
  { f: 86400, when: "Human scale", title: "A day of arithmetic", body: "Do one sum every second for 24 hours straight, no breaks, and you'd reach 86,400." },
  { f: 80 * 365.25 * 86400, when: "Human scale", title: "A whole lifetime", body: "One sum a second, every second of an 80-year life, comes to about 2.5 billion." },
  { f: H100, when: "Machine scale", title: "One second of a GPU", body: "NVIDIA's H100, a workhorse of today's AI data centers, peaks at about 989 trillion operations per second.", link: ["NVIDIA's H100 specs", "https://www.nvidia.com/en-us/data-center/h100/"] },
  { f: PEOPLE * 365.25 * 86400, when: "Human scale", title: "All of humanity, for a year", body: "If all 8.2 billion people on Earth did one sum a second, nonstop, for a full year, together they'd reach about 2.6 × 10¹⁷.", link: ["UN population data", "https://population.un.org/wpp/"] },
  { f: H100 * 86400, when: "Machine scale", title: "One GPU, one day", body: "A single H100 running flat out for 24 hours." },
  { f: H100 * 365.25 * 86400, when: "Machine scale", title: "One GPU, one year", body: "A single H100 running flat out for a full year." },
  { f: H100 * 365.25 * 86400 * 1e4, when: "Machine scale", title: "Ten thousand GPUs, one year", body: "Ten thousand H100s running flat out for a year. The biggest training runs are now around here." },
];

// ---------- formatting ----------
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).split("").map((d) => SUP[+d]).join("");
const NAMES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion"];
function parts(v, digits = 2) {
  const e = Math.floor(Math.log10(v)), m = v / 10 ** e;
  return { e, m: m.toFixed(digits - 1).replace(/\.0+$/, "") };
}
// Plain-text form (for notes and tables) and HTML form with a real <sup> (for the big numbers).
function sci(v, digits = 2) { if (v < 1e4) return Math.round(v).toLocaleString(); const { e, m } = parts(v, digits); return `${m === "1" ? "" : `${m} × `}10${sup(e)}`; }
function sciHtml(v, digits = 2) { if (v < 1e4) return Math.round(v).toLocaleString(); const { e, m } = parts(v, digits); return `${m === "1" ? "" : `${m} × `}10<sup>${e}</sup>`; }
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
  if (s > UNIVERSE_S * 2) return `${words(s / UNIVERSE_S)} times the age of the universe`;
  const y = s / 3.156e7;
  return y < 1000 ? `${Math.round(y)} years` : `${words(y)} years`;
}
const money = (v) => (v >= 1e9 ? `$${+(v / 1e9).toPrecision(2)} billion` : v >= 1e6 ? `$${+(v / 1e6).toPrecision(2)} million` : v >= 1e3 ? `$${Math.round(v / 1e3)},000` : `$${Math.round(v)}`);
const params = (p) => (p >= 1e12 ? `${+(p / 1e12).toPrecision(3)} trillion` : p >= 1e9 ? `${+(p / 1e9).toPrecision(3)} billion` : p >= 1e6 ? `${+(p / 1e6).toPrecision(3)} million` : p >= 1e3 ? `${+(p / 1e3).toPrecision(3)} thousand` : `${p}`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const year = (m) => m.d.slice(0, 4);
const CONF = { c: "Epoch is confident in this figure", l: "Epoch's likely estimate", s: "Epoch's speculative estimate" };

// ---------- geometry ----------
const BREAKS = [[1950, 0], [2005, 0.13], [2016, 0.36], [2027, 1]];
function xOf(d) {
  const [y, mo, da] = d.split("-").map(Number);
  const t = y + ((mo - 1) * 30.4 + da) / 365.25;
  for (let i = 1; i < BREAKS.length; i++) {
    const [y0, x0] = BREAKS[i - 1], [y1, x1] = BREAKS[i];
    if (t <= y1 || i === BREAKS.length - 1) return 4 + 92 * (x0 + ((Math.min(t, y1) - y0) / (y1 - y0)) * (x1 - x0));
  }
}

let data, models, logs, DEC, PAD, END_LOG, stage, plot, stageTop = 0, H = [], CUM = [0];
const active = new Set(FIELDS.map(([d]) => d).concat("Other"));

// Each power of ten gets room in proportion to how many models and notes live there,
// so empty early decades pass quickly and the crowded modern era spreads out.
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
function noteFs() {
  const top = models[models.length - 1];
  return [...HUMAN_NOTES.map((n) => n.f), ...models.filter((m) => STORIES[m.n]).map((m) => m.f), ...(STORIES[top.n] ? [] : [top.f])];
}

function layout() {
  stage = $("#stage"); plot = $("#plot");
  DEC = Math.round(Math.max(380, Math.min(760, innerHeight * 0.66)));
  PAD = Math.round(DEC * 0.4);
  END_LOG = Math.log10(models[models.length - 1].f) + 0.35;
  const counts = Array(Math.ceil(END_LOG) + 1).fill(0), noteCounts = Array(counts.length).fill(0);
  for (const l of logs) counts[Math.floor(l)]++;
  for (const f of noteFs()) noteCounts[Math.min(counts.length - 1, Math.floor(Math.log10(f)))]++;
  const cardH = innerWidth < 900 ? 300 : 250;
  H = counts.map((n, e) => Math.round(Math.max(DEC * Math.max(0.55, Math.min(1.5, 0.5 + n * 0.018)), noteCounts[e] * cardH)));
  CUM = [0];
  H.forEach((h, i) => (CUM[i + 1] = CUM[i] + h));
  stage.style.height = `${yOf(END_LOG) + Math.round(innerHeight * 0.3)}px`;

  // The ruler: a major tick and exponent at every power of ten, log-spaced minor ticks between.
  let ruler = "";
  for (let e = 0; e <= Math.floor(END_LOG); e++) {
    ruler += `<i class="major" style="top:${yOf(e)}px"></i><b style="top:${yOf(e)}px">10<sup>${e}</sup></b>`;
    for (let k = 2; k <= 9; k++) if (e + Math.log10(k) < END_LOG) ruler += `<i style="top:${yOf(e + Math.log10(k)).toFixed(1)}px"></i>`;
  }
  $("#ruler").innerHTML = ruler;

  plot.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let e = 0; e <= Math.floor(END_LOG); e++) {
    const line = document.createElement("div");
    line.className = "decade";
    line.style.top = `${yOf(e)}px`;
    line.innerHTML = `<small>${e === 0 ? "one" : words(10 ** e)}</small>`;
    frag.appendChild(line);
  }
  for (const y of [1960, 1980, 2000, 2010, 2015, 2020, 2022, 2024, 2026]) {
    const l = document.createElement("div");
    l.className = "yearline"; l.style.left = `${xOf(`${y}-01-01`)}%`;
    frag.appendChild(l);
  }
  const ticks = plot.clientWidth < 600 ? [1950, 2010, 2016, 2020, 2022, 2024, 2026] : [1950, 1990, 2010, 2015, 2020, 2022, 2024, 2026];
  $("#axis-in").innerHTML = ticks.map((y) => `<span style="left:${xOf(`${y}-01-01`)}%">${y}</span>`).join("");

  models.forEach((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `dot${m.k === "s" ? " spec" : ""}${m.x ? " frontier" : ""}`;
    const s = m.p ? Math.max(6, Math.min(15, 5 + (Math.log10(m.p) - 3) * 0.75)) : 7;
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
    const w = (m.n.length + 6) * 6.6 + 10, h = 18;
    const left = x > width * 0.62;
    const rect = left ? [x - w - 10, y - h / 2, x - 10, y + h / 2] : [x + 10, y - h / 2, x + w + 10, y + h / 2];
    if (rect[0] < 4 || rect[2] > width - 2) continue;
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
  stageTop = stage.getBoundingClientRect().top + scrollY;
  update();
}

function noteHtml(n) {
  if (n.model) {
    const m = n.model;
    const facts = [
      `<b>${sci(m.f)}</b> FLOP${m.k === "s" ? " (a speculative estimate)" : ""}`,
      m.p ? `${params(m.p)} parameters` : "",
      m.$ ? `about ${money(m.$)} to train` : "",
      `${duration(m.f / H100)} on one H100`,
    ].filter(Boolean).join(", ");
    return `<p class="when">${year(m)}, ${esc(m.o)}</p><h3>${esc(m.n)}</h3><p>${esc(n.body)}</p><p class="facts">${facts}.</p>${m.u ? `<a href="${esc(m.u)}" target="_blank" rel="noopener">Source</a>` : ""}<span class="lead"></span>`;
  }
  return `<p class="when">${esc(n.when)}, about ${sci(n.f)} FLOP</p><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>${n.link ? `<a href="${n.link[1]}" target="_blank" rel="noopener">${esc(n.link[0])}</a>` : ""}<span class="lead"></span>`;
}

function buildNotes() {
  const box = $("#notes");
  box.innerHTML = "";
  const top = models[models.length - 1];
  const notes = HUMAN_NOTES.map((n) => ({ ...n }));
  for (const m of models) if (STORIES[m.n]) notes.push({ f: m.f, model: m, body: STORIES[m.n] });
  if (!STORIES[top.n]) notes.push({ f: top.f, model: top, body: `The largest training run in the dataset.${top.k !== "c" ? " The developer hasn't published its compute, so this is Epoch's estimate." : ""}` });
  notes.sort((a, b) => a.f - b.f);
  let bottom = -Infinity;
  for (const n of notes) {
    const el = document.createElement("div");
    el.className = `note${n.model ? "" : " human"}`;
    if (n.model) el.style.setProperty("--c", colorOf(n.model));
    el.innerHTML = noteHtml(n);
    box.appendChild(el);
    const ideal = yOf(Math.log10(n.f)) - 34;
    const t = Math.max(ideal, bottom + 40);
    el.style.top = `${t}px`;
    el.querySelector(".lead").style.top = `${Math.max(10, Math.min(el.offsetHeight - 6, ideal + 34 - t))}px`;
    bottom = t + el.offsetHeight;
  }
  if (bottom + 60 > stage.offsetHeight) stage.style.height = `${bottom + 60}px`;
}

// ---------- the reading ----------
let hot = [], ticking = false;
function lower(v) { let lo = 0, hi = logs.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (logs[mid] < v) lo = mid + 1; else hi = mid; } return lo; }

function update() {
  ticking = false;
  const center = scrollY + innerHeight / 2 - stageTop;
  const logv = Math.max(0, Math.min(END_LOG - 0.35, logOf(center)));
  document.body.classList.toggle("diving", center > PAD * 0.6 && center < yOf(END_LOG) + innerHeight * 0.05);
  const v = 10 ** logv;
  document.documentElement.style.setProperty("--depth", (logv / (END_LOG - 0.35)).toFixed(4));
  $("#exp").innerHTML = sciHtml(v);
  $("#words").textContent = v < 1.5 ? "one calculation" : v < 1e4 ? "calculations" : `${words(v)} calculations`;
  $("#eq-you").textContent = duration(v);
  $("#eq-earth").textContent = duration(v / PEOPLE);
  $("#eq-gpu").textContent = duration(v / H100);

  const a = lower(logv - 0.06), b = lower(logv + 0.06);
  for (const m of hot) m.el.classList.remove("hot");
  hot = models.slice(a, b);
  for (const m of hot) m.el.classList.add("hot");
  if (pinned && Math.abs(yOf(Math.log10(pinned.f)) - center) > innerHeight * 0.8) closeCard();
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
let rt;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const keep = logOf(scrollY + innerHeight / 2 - stageTop); layout(); if (keep > 0) scrollTo(0, stageTop + yOf(keep) - innerHeight / 2); }, 200); });

// ---------- detail card ----------
const card = $("#card");
let pinned = null;
function showCard(m, pin, anchor) {
  card.style.setProperty("--c", colorOf(m));
  card.innerHTML = `<button class="x" type="button" aria-label="Close">×</button>
  <span class="field"><i></i>${esc(fieldOf(m))}${m.x ? ", frontier model" : ""}</span>
  <h3 id="card-name">${esc(m.n)}</h3>
  <p class="by">${esc(m.o)}, ${new Date(`${m.d}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
  <p class="flop">${sciHtml(m.f, 3)} FLOP</p>
  <p class="conf">${CONF[m.k]}</p>
  <dl>
    ${m.p ? `<dt>Parameters</dt><dd>${params(m.p)}</dd>` : ""}
    ${m.h ? `<dt>Hardware</dt><dd>${m.q ? `${Math.round(m.q).toLocaleString()} × ` : ""}${esc(m.h)}</dd>` : ""}
    ${m.$ ? `<dt>Training cost</dt><dd>about ${money(m.$)}</dd>` : ""}
    <dt>On one H100</dt><dd>${duration(m.f / H100)}</dd>
    <dt>By hand</dt><dd>${duration(m.f)}</dd>
  </dl>
  ${m.a ? `<p class="abs">From the paper: “${esc(m.a)}”</p>` : ""}
  ${m.u ? `<a href="${esc(m.u)}" target="_blank" rel="noopener">Source</a>` : ""}`;
  card.hidden = false;
  if (innerWidth > 760) {
    const r = anchor.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
    let left = r.right + 16; if (left + cw > innerWidth - 12) left = r.left - cw - 16;
    const top = Math.min(innerHeight - ch - 150, Math.max(80, r.top - ch / 2));
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
  if (!active.has(fieldOf(m))) { active.add(fieldOf(m)); syncLegend(); applyFilter(); }
  const target = stageTop + yOf(Math.log10(m.f)) - innerHeight / 2;
  smoothScroll(target, Math.min(2600, 700 + Math.abs(target - scrollY) / 12), () => {
    m.el.classList.add("found");
    setTimeout(() => m.el.classList.remove("found"), 2400);
    showCard(m, true, m.el);
  });
}
find.addEventListener("input", () => {
  const q = find.value.trim().toLowerCase();
  if (!q) { findList.hidden = true; return; }
  found = models.filter((m) => m.n.toLowerCase().includes(q) || m.o.toLowerCase().includes(q))
    .sort((a, b) => (a.n.toLowerCase().startsWith(q) ? 0 : 1) - (b.n.toLowerCase().startsWith(q) ? 0 : 1) || b.f - a.f).slice(0, 8);
  fIdx = 0;
  findList.innerHTML = found.length ? found.map((m, i) => `<li role="option" data-i="${i}" aria-selected="${i === 0}"><span>${esc(m.n)}</span><small>${esc(m.o.split(",")[0])}, ${year(m)}</small></li>`).join("") : `<li aria-disabled="true"><span>No model by that name</span></li>`;
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

// ---------- fields ----------
let fieldList = [];
function syncLegend() { document.querySelectorAll(".legend button").forEach((b) => b.setAttribute("aria-pressed", String(active.has(b.dataset.d)))); }
function applyFilter() {
  for (const m of models) {
    const on = active.has(fieldOf(m));
    m.el.classList.toggle("dim", !on);
    m.label?.classList.toggle("dim", !on);
  }
}
function buildLegend() {
  const counts = {};
  for (const m of models) counts[fieldOf(m)] = (counts[fieldOf(m)] || 0) + 1;
  fieldList = [...FIELDS.filter(([d]) => counts[d]), ["Other", OTHER]];
  $("#legend").innerHTML = fieldList.map(([d, c]) => `<button type="button" data-d="${d}" aria-pressed="true" style="--c:${c}" title="${counts[d] || 0} models"><i></i>${d}</button>`).join("");
  $("#legend").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset.d;
    // First click shows only that field; clicking it again shows everything.
    if (active.size === fieldList.length) { active.clear(); active.add(d); }
    else if (active.has(d) && active.size === 1) fieldList.forEach(([x]) => active.add(x));
    else if (active.has(d)) active.delete(d); else active.add(d);
    syncLegend(); applyFilter();
  });
}

// ---------- helpers ----------
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

const topbar = $(".top");
addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 8), { passive: true });

async function boot() {
  data = await fetch("data.json").then((r) => r.json());
  models = data.models.filter((m) => m.f >= 1).sort((a, b) => a.f - b.f);
  logs = models.map((m) => Math.log10(m.f));
  const first = models[0], top = models[models.length - 1];
  const orders = Math.round(Math.log10(top.f / first.f));

  $("#standfirst").textContent = `All ${models.length} notable AI models since ${year(first)} with a known training budget, placed by how many calculations it took to train them.`;
  $("#prompt").innerHTML = `Scroll down. The largest, ${esc(top.n)}, took about ${sciHtml(top.f)}.`;

  buildLegend();
  layout();

  $("#finale-title").textContent = `That's ${top.n.replace(/-/g, "‑")}, the bottom for now.`;
  $("#summary").textContent = `You just passed ${models.length} models across ${orders} orders of magnitude, from ${first.n} in ${year(first)} to ${top.n} in ${year(top)}.${data.growth ? ` Since 2010, the compute used by frontier models has grown about ${data.growth} times every year.` : ""}`;
  $("#finale-line").textContent = `Doing ${top.n}'s training run by hand, one sum a second, would take ${duration(top.f)}. All of humanity working together would need ${duration(top.f / PEOPLE)}.`;
  $("#method-text").innerHTML = `Training compute comes from <a href="${esc(data.source.url)}" target="_blank" rel="noopener">${esc(data.source.name)}</a> (${esc(data.source.license)}), last updated ${esc(data.updated)}. Most figures are Epoch's estimates, each with a confidence level; hollow dots are speculative. Dot size shows parameter count where it's known, and ringed dots are models Epoch lists as frontier models. The growth rate is a straight-line fit through the ${data.frontierCount} frontier models since 2010. Human comparisons assume one operation per second per person and a world population of 8.2 billion (UN World Population Prospects 2024). GPU comparisons use one NVIDIA H100 SXM at its dense BF16 peak of about 989 trillion operations per second; real training runs don't reach peak speed, so treat those as rough.`;
  $("#table tbody").innerHTML = models.slice().reverse().map((m) => `<tr><td>${esc(m.n)}</td><td>${esc(m.o)}</td><td>${m.d}</td><td>${sci(m.f, 3)}</td><td>${{ c: "Confident", l: "Likely", s: "Speculative" }[m.k]}</td></tr>`).join("");
}

$("#ascend").addEventListener("click", () => smoothScroll(0, Math.min(4200, 1400 + scrollY / 20)));
$("#share").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText("https://www.rkjdev.com/play/scale-of-ai/"); toast("Link copied"); }
  catch { toast("Your browser blocked copying. The address is rkjdev.com/play/scale-of-ai"); }
});

boot().catch(() => { $("#standfirst").textContent = "The model data didn't load. Check your connection, then reload."; });
