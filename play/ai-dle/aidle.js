// AI-dle: guess the mystery AI organisation or model from six clues. Everything runs in the browser;
// progress and stats live in localStorage.
const $ = (s) => document.querySelector(s);
const MAX = 6;
const KEY = "aidle:v1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const ICONS = {
  org: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-5h6v5M9 10h.01M15 10h.01M9 13.5h.01M15 13.5h.01"/></svg>',
  model: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M10 10h4v4h-4zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};
const FLAGS = { USA: "🇺🇸", China: "🇨🇳", UK: "🇬🇧", "United Kingdom": "🇬🇧", France: "🇫🇷", Canada: "🇨🇦", Germany: "🇩🇪", Japan: "🇯🇵", "South Korea": "🇰🇷", Israel: "🇮🇱", India: "🇮🇳", UAE: "🇦🇪", Singapore: "🇸🇬", Switzerland: "🇨🇭", Netherlands: "🇳🇱", Taiwan: "🇹🇼", Russia: "🇷🇺", "Saudi Arabia": "🇸🇦", Australia: "🇦🇺", Finland: "🇫🇮", Sweden: "🇸🇪", Italy: "🇮🇹", Spain: "🇪🇸", Denmark: "🇩🇰", Austria: "🇦🇹", Belgium: "🇧🇪", Brazil: "🇧🇷", Poland: "🇵🇱", Norway: "🇳🇴", Ireland: "🇮🇪", "Hong Kong": "🇭🇰", Qatar: "🇶🇦", Czechia: "🇨🇿", Vietnam: "🇻🇳", Turkey: "🇹🇷", Iran: "🇮🇷", Egypt: "🇪🇬" };
const flag = (c) => FLAGS[c] || "🌐";

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const niceDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

function unseal(text, date) {
  const key = new TextEncoder().encode(`rkj-${date}-aidle`);
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0)).map((b, i) => b ^ key[i % key.length]);
  return JSON.parse(new TextDecoder().decode(bytes));
}

let save = {};
try { save = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
save.results ||= {};
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };

let index = [], puzzle, secret, entities = [], pool = [], game, today;

function toast(msg) {
  const t = $(".toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- rendering ----------
function scrambleIn(el, text) {
  if (reduced) { el.textContent = text; return; }
  const glyphs = "▚▞▖▗▘▝░▒01<>/{}#*";
  const start = performance.now(), dur = Math.min(900, 300 + text.length * 6);
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur), upto = Math.floor(text.length * p);
    let out = esc(text.slice(0, upto));
    const tail = text.slice(upto, upto + 14).replace(/\S/g, () => glyphs[(Math.random() * glyphs.length) | 0]);
    el.innerHTML = out + (p < 1 ? `<span class="scramble">${esc(tail)}</span>` : "");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderClues(animateIdx = -1) {
  const shown = game.status === "playing" ? Math.min(MAX, game.guesses.length + 1) : MAX;
  const ol = $("#clues");
  ol.innerHTML = "";
  puzzle.clues.forEach((clue, i) => {
    const li = document.createElement("li");
    li.className = "clue";
    if (i < shown) {
      li.classList.add("open");
      if (i === shown - 1 && game.status === "playing") li.classList.add("latest");
      if (i === animateIdx) li.classList.add("fresh");
      li.innerHTML = `<span class="n">${i + 1}</span><span class="txt"></span>`;
      const txt = li.querySelector(".txt");
      if (i === animateIdx) scrambleIn(txt, clue); else txt.textContent = clue;
    } else {
      li.classList.add("locked");
      li.innerHTML = `<span class="n">${i + 1}</span><span class="txt">${ICONS.lock}<span class="bars"><i style="--w:${60 + ((i * 37) % 35)}%"></i></span></span>`;
      li.setAttribute("aria-label", `Clue ${i + 1}, locked`);
    }
    ol.appendChild(li);
  });
}

function renderTries() {
  const el = $("#tries");
  el.innerHTML = "";
  for (let i = 0; i < MAX; i++) {
    const g = game.guesses[i];
    const b = document.createElement("i");
    if (g) b.className = g.fb;
    else if (i === game.guesses.length && game.status === "playing") b.className = "now";
    el.appendChild(b);
  }
}

function feedbackChip(g) {
  if (g.fb === "pass") return `<span class="chip">Skipped</span>`;
  if (puzzle.type === "org") {
    if (!g.c) return `<span class="chip">Not it</span>`;
    return g.fb === "same" ? `<span class="chip same">${flag(g.c)} Same country</span>` : `<span class="chip">${flag(g.c)} Wrong country</span>`;
  }
  if (!g.o) return `<span class="chip">Not it</span>`;
  return g.fb === "same" ? `<span class="chip same">Same maker</span>` : `<span class="chip">Other maker · ${esc(g.o)}</span>`;
}

function renderGuesses() {
  const ul = $("#guesses");
  ul.innerHTML = "";
  game.guesses.filter((g) => g.fb !== "win").slice().reverse().forEach((g) => {
    const li = document.createElement("li");
    li.className = g.fb;
    li.innerHTML = `<span class="x">${g.fb === "pass" ? "–" : "✕"}</span><span class="name">${g.fb === "pass" ? "Skipped" : esc(g.n)}</span>${feedbackChip(g)}`;
    ul.appendChild(li);
  });
}

const EMOJI = { miss: "🟥", same: "🟨", pass: "⬛", win: "🟩" };
function emojiRow() { return game.guesses.map((g) => EMOJI[g.fb]).join(""); }

function renderResult(celebrate) {
  const won = game.status === "won";
  const box = $("#result");
  box.hidden = false;
  box.classList.toggle("lost", !won);
  $("#guess").hidden = true;
  const used = game.guesses.length;
  $("#result-kicker").textContent = won ? ["Genius", "Brilliant", "Impressive", "Nice one", "Phew", "Just in time"][used - 1] : "Not this time";
  $("#answer").innerHTML = [...secret.answer].map((ch, i) => (ch === " " ? `<span class="gap" style="--i:${i}"></span>` : `<span style="--i:${i}">${esc(ch)}</span>`)).join("");
  $("#answer").setAttribute("aria-label", `The answer was ${secret.answer}`);
  $("#result-line").textContent = won ? `Solved with ${used} of ${MAX} clue${used > 1 ? "s" : ""}` : `The answer was ${secret.answer}`;
  $("#emoji").textContent = emojiRow();
  $("#blurb").textContent = secret.blurb || "";
  $("#reads").innerHTML = (secret.posts || []).map((p) => `<a href="/blog/${encodeURIComponent(p.slug)}/"><span><small>Read the story</small>${esc(p.title)}</span></a>`).join("");
  renderCountdown();
  if (celebrate && won) confetti();
  if (celebrate) setTimeout(() => box.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 250);
}

function renderCountdown() {
  const el = $("#next");
  if (puzzle.date !== today) { el.innerHTML = `This was puzzle #${puzzle.n}. <a href="./">Play today's</a>`; return; }
  const tick = () => {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    el.innerHTML = `Next puzzle in <b>${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}</b>`;
  };
  tick(); clearInterval(renderCountdown.t); renderCountdown.t = setInterval(tick, 1000);
}

function render(animateIdx) {
  renderClues(animateIdx);
  renderTries();
  renderGuesses();
  if (game.status !== "playing") renderResult(false);
  else { $("#guess").hidden = false; $("#result").hidden = true; }
}

// ---------- autocomplete ----------
const input = $("#guess-input"), list = $("#suggest");
let matches = [], active = -1;

function suggest() {
  const q = norm(input.value);
  if (!q) { closeList(); return; }
  const guessed = new Set(game.guesses.map((g) => norm(g.n)));
  const scored = [];
  for (const e of pool) {
    const n = e.k;
    const at = n.indexOf(q);
    if (at < 0) continue;
    const score = (at === 0 ? 0 : n[at - 1] === " " ? 1 : 3) + n.length / 100;
    scored.push([score, e]);
  }
  matches = scored.sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]);
  if (!matches.length) { list.innerHTML = `<li aria-disabled="true"><span>No match in our list</span></li>`; open(); active = -1; return; }
  list.innerHTML = matches.map((e, i) => {
    const name = esc(e.n), at = e.n.toLowerCase().indexOf(input.value.trim().toLowerCase());
    const label = at >= 0 && input.value.trim() ? `${esc(e.n.slice(0, at))}<mark>${esc(e.n.slice(at, at + input.value.trim().length))}</mark>${esc(e.n.slice(at + input.value.trim().length))}` : name;
    const meta = puzzle.type === "org" ? (e.c ? `${flag(e.c)} ${esc(e.c)}` : "") : e.o ? esc(e.o) : "";
    return `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="false" class="${guessed.has(e.k) ? "used" : ""}"><span>${label}</span><small>${meta}</small></li>`;
  }).join("");
  active = 0; mark(); open();
}
function open() { list.hidden = false; input.setAttribute("aria-expanded", "true"); }
function closeList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); }
function mark() {
  [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
  if (active >= 0 && list.children[active]) { input.setAttribute("aria-activedescendant", `opt-${active}`); list.children[active].scrollIntoView({ block: "nearest" }); }
}
input.addEventListener("input", suggest);
input.addEventListener("keydown", (e) => {
  if (list.hidden || !matches.length) return;
  if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % matches.length; mark(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + matches.length) % matches.length; mark(); }
  else if (e.key === "Escape") closeList();
  else if (e.key === "Tab" && active >= 0) { e.preventDefault(); input.value = matches[active].n; closeList(); }
});
list.addEventListener("pointerdown", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  e.preventDefault();
  input.value = matches[+li.dataset.i].n;
  closeList();
  submitGuess();
});
input.addEventListener("blur", () => setTimeout(closeList, 120));

// ---------- game flow ----------
function shake() { const c = $(".combo"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }

function submitGuess() {
  if (game.status !== "playing") return;
  let text = input.value.trim();
  if (!list.hidden && active >= 0 && matches[active] && norm(matches[active].n) !== norm(text) && norm(matches[active].n).includes(norm(text))) text = matches[active].n;
  if (!text) { shake(); input.focus(); return; }
  const k = norm(text);
  if (game.guesses.some((g) => norm(g.n) === k)) { toast("You already tried that"); shake(); return; }
  const answers = [secret.answer, ...(secret.aliases || [])].map(norm);
  const entity = pool.find((e) => e.k === k);
  if (answers.includes(k)) {
    game.guesses.push({ n: secret.answer, fb: "win" });
    finish("won");
    return;
  }
  if (!entity) { toast("Pick a name from the list"); shake(); return; }
  const g = { n: entity.n, fb: "miss" };
  if (puzzle.type === "org") { g.c = entity.c; if (entity.c && secret.country && entity.c === secret.country) g.fb = "same"; }
  else { g.o = entity.o; if (entity.o && secret.maker && (norm(entity.o).includes(norm(secret.maker)) || norm(secret.maker).includes(norm(entity.o)))) g.fb = "same"; }
  advance(g);
}

function advance(g) {
  game.guesses.push(g);
  input.value = ""; closeList();
  if (game.guesses.length >= MAX) { finish("lost"); return; }
  store();
  render(game.guesses.length);
  if (g.fb === "same") toast(puzzle.type === "org" ? "Warm: same country!" : "Warm: same maker!");
  if (matchMedia("(hover: hover)").matches) input.focus();
}

function finish(status) {
  game.status = status;
  input.value = ""; closeList();
  if (game.daily) {
    const prev = index.filter((p) => p.date < puzzle.date).pop();
    if (status === "won") { save.streak = save.lastWin && prev && save.lastWin === prev.date ? (save.streak || 0) + 1 : 1; save.lastWin = puzzle.date; }
    else save.streak = 0;
    save.maxStreak = Math.max(save.maxStreak || 0, save.streak);
  }
  store();
  render();
  renderResult(true);
}

function store() { save.results[puzzle.date] = game; persist(); }

$("#guess").addEventListener("submit", (e) => { e.preventDefault(); submitGuess(); });
$("#skip").addEventListener("click", () => { if (game.status === "playing") advance({ n: "", fb: "pass" }); });

$("#share").addEventListener("click", async () => {
  const used = game.guesses.length;
  const text = `AI-dle #${puzzle.n} ${game.status === "won" ? `${used}/${MAX}` : `X/${MAX}`}\n${emojiRow()}\nwww.rkjdev.com/play/ai-dle/`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast("Result copied. Paste it anywhere!"); }
  } catch (e) { if (e.name !== "AbortError") toast("Couldn't share, sorry"); }
});

// ---------- dialogs ----------
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-open]");
  if (opener) { const d = document.getElementById(opener.dataset.open); if (opener.dataset.open === "stats") renderStats(); if (opener.dataset.open === "archive") renderArchive(); d.showModal(); }
  if (e.target.closest("[data-close]")) e.target.closest("dialog").close();
  if (e.target.tagName === "DIALOG") e.target.close();
});

function renderStats() {
  const daily = Object.values(save.results).filter((r) => r.daily && r.status !== "playing");
  const wins = daily.filter((r) => r.status === "won");
  $("#stat-grid").innerHTML = [[daily.length, "Played"], [daily.length ? Math.round((wins.length / daily.length) * 100) : 0, "Win %"], [save.streak || 0, "Streak"], [save.maxStreak || 0, "Best"]]
    .map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join("");
  const counts = Array(MAX).fill(0);
  wins.forEach((r) => counts[r.guesses.length - 1]++);
  const top = Math.max(1, ...counts);
  const mine = game?.status === "won" ? game.guesses.length : 0;
  $("#dist").innerHTML = counts.map((c, i) => `<div class="${mine === i + 1 ? "hit" : ""}"><b>${i + 1}</b><span style="--w:${Math.max(8, (c / top) * 100)}%">${c}</span></div>`).join("");
}

function renderArchive() {
  $("#archive-list").innerHTML = index.filter((p) => p.date <= today).slice().reverse().map((p) => {
    const r = save.results[p.date];
    const st = !r ? "" : r.status === "won" ? `<span class="st won">Solved in ${r.guesses.length}</span>` : r.status === "lost" ? `<span class="st lost">Missed</span>` : `<span class="st">In progress</span>`;
    return `<li><a href="?d=${p.date}"><span class="no">#${p.n}</span><span class="when">${niceDate(p.date)}${p.date === today ? " · Today" : ""}</span>${st || '<span class="st">Play →</span>'}</a></li>`;
  }).join("") || "<li class='muted'>The archive fills up as the days go by.</li>";
}

// ---------- confetti ----------
function confetti() {
  if (reduced) return;
  const cv = $("#confetti"), ctx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const colors = ["#f4b860", "#ffd9a0", "#b494e8", "#6fd6a8", "#ef6f7c", "#efe7dc"];
  const bits = Array.from({ length: 160 }, (_, i) => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 15 - 6, r: Math.random() * 6 + 4,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], shape: i % 3,
  }));
  const start = performance.now();
  const frame = (now) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const t = (now - start) / 1000;
    for (const b of bits) {
      b.vy += 0.42; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.globalAlpha = Math.max(0, 1 - t / 3.2); ctx.fillStyle = b.c;
      if (b.shape === 0) ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2);
      else if (b.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, b.r / 2.6, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -b.r / 2); ctx.lineTo(b.r / 2, b.r / 2); ctx.lineTo(-b.r / 2, b.r / 2); ctx.fill(); }
      ctx.restore();
    }
    if (t < 3.3) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// ---------- boot ----------
const topbar = document.querySelector(".top");
addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 8), { passive: true });

async function boot() {
  today = localDate();
  try {
    index = await fetch("puzzles/index.json", { cache: "no-cache" }).then((r) => r.json());
  } catch { $("#day").textContent = "Couldn't load the puzzle. Check your connection and refresh."; return; }
  const want = new URLSearchParams(location.search).get("d");
  const avail = index.filter((p) => p.date <= today);
  const pick = (want && avail.find((p) => p.date === want)) || avail[avail.length - 1] || index[0];
  if (!pick) { $("#day").textContent = "The first puzzle is on its way. Check back soon!"; return; }
  const [p, ents] = await Promise.all([
    fetch(`puzzles/${pick.date}.json`).then((r) => r.json()),
    fetch("entities.json").then((r) => r.json()).catch(() => []),
  ]);
  puzzle = p; secret = unseal(p.secret, p.date); entities = ents;
  pool = entities.filter((e) => e.t === puzzle.type).map((e) => ({ ...e, k: norm(e.n) }));
  if (!pool.some((e) => e.k === norm(secret.answer))) pool.push({ n: secret.answer, t: puzzle.type, k: norm(secret.answer) });

  const isToday = puzzle.date === today || (!want && pick === avail[avail.length - 1]);
  game = save.results[puzzle.date] || { status: "playing", guesses: [], daily: isToday && !save.results[puzzle.date] };
  $("#day").innerHTML = `<b>#${puzzle.n}</b> · ${niceDate(puzzle.date)}${puzzle.date === today ? "" : " · from the archive"}`;
  $("#mystery").hidden = false;
  $("#mystery-icon").innerHTML = ICONS[puzzle.type];
  $("#mystery-type").textContent = puzzle.type === "org" ? "an AI company or lab" : "an AI model or product";
  input.placeholder = puzzle.type === "org" ? "Type a company or lab…" : "Type a model or product…";
  render(game.guesses.length === 0 && game.status === "playing" ? 0 : -1);

  if (!save.seenHelp) { save.seenHelp = true; persist(); setTimeout(() => $("#help").showModal(), 700); }
}
boot();
