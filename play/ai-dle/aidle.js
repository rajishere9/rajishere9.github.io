// AI-dle: identify the day's subject from six clues. Runs entirely in the browser;
// progress and your record are kept in localStorage.
const $ = (s) => document.querySelector(s);
const MAX = 6;
const KEY = "aidle:v1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const WORDS = ["", "one", "two", "three", "four", "five", "six"];

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const caseNo = (n) => String(n).padStart(3, "0");

function unseal(text, date) {
  const key = new TextEncoder().encode(`rkj-${date}-aidle`);
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0)).map((b, i) => b ^ key[i % key.length]);
  return JSON.parse(new TextDecoder().decode(bytes));
}

let save = {};
try { save = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
save.results ||= {};
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };

let index = [], puzzle, secret, pool = [], game, today;

function toast(msg) {
  const t = $(".toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- the sheet ----------
// Redacted clues are drawn from placeholder letters of the same length (the font is monospaced),
// so the bars have the real clue's shape without the text ever being in the page.
function words(text, hidden) {
  let i = 0;
  return text.split(/(\s+)/).map((part) => {
    if (/^\s+$/.test(part) || !part) return part;
    const shown = hidden ? part.replace(/./g, "x") : esc(part);
    return `<span class="w" style="--i:${i++}">${shown}</span>`;
  }).join("");
}

function shownCount() { return game.status === "playing" ? Math.min(MAX, game.guesses.length + 1) : MAX; }

function renderClues(lift = -1) {
  const shown = shownCount();
  $("#clues").innerHTML = puzzle.clues.map((clue, i) => {
    const open = i < shown;
    const cls = ["clue", open ? (i === lift ? "lifting" : "open") : "redacted", open && i === shown - 1 && game.status === "playing" ? "latest" : ""].join(" ");
    const label = open ? "" : ` aria-label="Clue ${i + 1}, redacted"`;
    return `<li class="${cls}"${label}><span class="n">${i + 1}</span><span class="t"${open ? "" : ' aria-hidden="true"'}>${words(clue, !open)}</span></li>`;
  }).join("");
  if (lift >= 0) {
    const li = $("#clues").children[lift];
    const n = li.querySelectorAll(".w").length;
    setTimeout(() => li.classList.replace("lifting", "open"), reduced ? 0 : n * 28 + 500);
  }
  $("#progress").textContent = `${shown} of ${MAX}`;
}

function note(g) {
  if (g.fb === "pass") return "";
  if (puzzle.type === "org") {
    if (!g.c) return `<span class="note">No country on file</span>`;
    return g.fb === "same" ? `<span class="note"><mark>Same country as the subject</mark> (${esc(g.c)})</span>` : `<span class="note">Based in ${esc(g.c)}, not a match</span>`;
  }
  if (!g.o) return `<span class="note">Maker not on file</span>`;
  return g.fb === "same" ? `<span class="note"><mark>Same maker as the subject</mark></span>` : `<span class="note">Made by ${esc(g.o)}, not a match</span>`;
}

function renderAttempts(fresh = false) {
  const list = game.guesses.filter((g) => g.fb !== "win");
  $("#attempts").innerHTML = list.map((g, i) => {
    const isNew = fresh && i === list.length - 1;
    return g.fb === "pass"
      ? `<li${isNew ? ' class="fresh"' : ""}><span class="skipped">Skipped</span></li>`
      : `<li${isNew ? ' class="fresh"' : ""}><span class="who">${esc(g.n)}</span>${note(g)}</li>`;
  }).join("");
}

function renderSkip() {
  const next = game.guesses.length + 2;
  $("#skip").textContent = next <= MAX ? `Skip and declassify clue ${next}` : "Skip the last guess";
}

function renderVerdict(fresh) {
  const won = game.status === "won";
  const used = game.guesses.length;
  $("#guess").hidden = true;
  $("#result").hidden = false;
  const stamp = $("#stamp");
  stamp.textContent = won ? "Identified" : "Unsolved";
  stamp.classList.toggle("lost", !won);
  stamp.classList.add("on");
  if (fresh && !reduced) { stamp.classList.remove("hit"); void stamp.offsetWidth; stamp.classList.add("hit"); }
  $("#subject").innerHTML = `<span class="ans-inline">${esc(secret.answer)}</span>`;
  $("#result-line").innerHTML = won
    ? `It was <span class="ans">${esc(secret.answer)}</span>. You got it on clue ${WORDS[used]}.`
    : `It was <span class="ans">${esc(secret.answer)}</span>.`;
  $("#blurb").textContent = secret.blurb || "";
  const posts = secret.posts || [];
  $("#reads").innerHTML = posts.length ? `<p>The reporting behind this case</p>${posts.map((p) => `<a href="/blog/${encodeURIComponent(p.slug)}/">${esc(p.title)}</a>`).join("")}` : "";
  renderNext();
}

function renderNext() {
  const el = $("#next");
  if (puzzle.date !== today) { el.innerHTML = `This is case ${caseNo(puzzle.n)} from the archive. <a href="./">Open today's case</a>`; return; }
  const tick = () => {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    el.innerHTML = `Next case opens in <b>${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}</b>`;
  };
  tick(); clearInterval(renderNext.t); renderNext.t = setInterval(tick, 1000);
}

function render({ lift = -1, fresh = false } = {}) {
  renderClues(lift);
  renderAttempts(fresh);
  if (game.status === "playing") { $("#guess").hidden = false; $("#result").hidden = true; renderSkip(); }
  else renderVerdict(fresh);
}

// ---------- suggestions ----------
const input = $("#guess-input"), list = $("#suggest");
let matches = [], active = -1;

function suggest() {
  const raw = input.value.trim(), q = norm(raw);
  if (!q) { closeList(); return; }
  const tried = new Set(game.guesses.map((g) => norm(g.n)));
  matches = pool
    .map((e) => { const at = e.k.indexOf(q); return at < 0 ? null : [(at === 0 ? 0 : e.k[at - 1] === " " ? 1 : 3) + e.k.length / 100, e]; })
    .filter(Boolean).sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]);
  if (!matches.length) { list.innerHTML = `<li class="none">No match in the index. Check the spelling.</li>`; openList(); active = -1; return; }
  list.innerHTML = matches.map((e, i) => {
    const at = e.n.toLowerCase().indexOf(raw.toLowerCase());
    const name = at >= 0 ? `${esc(e.n.slice(0, at))}<b>${esc(e.n.slice(at, at + raw.length))}</b>${esc(e.n.slice(at + raw.length))}` : esc(e.n);
    const meta = puzzle.type === "org" ? e.c || "" : e.o || "";
    return `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="false" class="${tried.has(e.k) ? "used" : ""}"><span>${name}</span><small>${esc(meta)}</small></li>`;
  }).join("");
  active = 0; mark(); openList();
}
function openList() { list.hidden = false; input.setAttribute("aria-expanded", "true"); }
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

// ---------- play ----------
function nope(msg) {
  toast(msg);
  const f = $(".field"); f.classList.remove("nope"); void f.offsetWidth; f.classList.add("nope");
}

function submitGuess() {
  if (game.status !== "playing") return;
  let text = input.value.trim();
  if (!list.hidden && active >= 0 && matches[active] && norm(matches[active].n).includes(norm(text))) text = matches[active].n;
  if (!text) { nope("Type a name first"); input.focus(); return; }
  const k = norm(text);
  if (game.guesses.some((g) => norm(g.n) === k)) { nope("Already tried. Pick another name."); return; }
  const answers = [secret.answer, ...(secret.aliases || [])].map(norm);
  if (answers.includes(k)) { game.guesses.push({ n: secret.answer, fb: "win" }); finish("won"); return; }
  const entity = pool.find((e) => e.k === k);
  if (!entity) { nope("Pick a name from the list"); return; }
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
  render({ lift: game.guesses.length, fresh: true });
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
  render({ fresh: true });
  setTimeout(() => $("#result").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }), 60);
}

function store() { save.results[puzzle.date] = game; persist(); }

$("#guess").addEventListener("submit", (e) => { e.preventDefault(); submitGuess(); });
$("#skip").addEventListener("click", () => { if (game.status === "playing") advance({ n: "", fb: "pass" }); });

const SQUARE = { miss: "🟥", same: "🟨", pass: "⬛", win: "🟩" };
$("#share").addEventListener("click", async () => {
  const used = game.guesses.length;
  const text = `AI-dle case ${caseNo(puzzle.n)}: ${game.status === "won" ? `${used}/${MAX}` : `X/${MAX}`}\n${game.guesses.map((g) => SQUARE[g.fb]).join("")}\nwww.rkjdev.com/play/ai-dle/`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast("Result copied"); }
  } catch (e) { if (e.name !== "AbortError") toast("Your browser blocked copying. Select the text and copy it manually."); }
});

// ---------- memos ----------
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-open]");
  if (!opener) return;
  const id = opener.dataset.open;
  if (id === "stats") renderStats();
  if (id === "archive") renderArchive();
  document.getElementById(id).showModal();
});
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

function renderStats() {
  const daily = Object.values(save.results).filter((r) => r.daily && r.status !== "playing");
  const wins = daily.filter((r) => r.status === "won");
  $("#stat-grid").innerHTML = [["Played", daily.length], ["Solved", daily.length ? `${Math.round((wins.length / daily.length) * 100)}%` : "0%"], ["Streak", save.streak || 0], ["Best", save.maxStreak || 0]]
    .map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("");
  const counts = Array(MAX).fill(0);
  wins.forEach((r) => counts[r.guesses.length - 1]++);
  const top = Math.max(1, ...counts);
  const mine = game?.status === "won" ? game.guesses.length : 0;
  $("#dist").innerHTML = counts.map((c, i) => `<div class="${mine === i + 1 ? "hit" : ""}"><span>${i + 1}</span><span style="--w:${Math.max(6, (c / top) * 100)}%">${c}</span></div>`).join("");
}

function renderArchive() {
  const rows = index.filter((p) => p.date <= today).slice().reverse().map((p) => {
    const r = save.results[p.date];
    const st = !r ? `<span class="st">Not played</span>` : r.status === "won" ? `<span class="st won">Solved on clue ${r.guesses.length}</span>` : r.status === "lost" ? `<span class="st lost">Unsolved</span>` : `<span class="st">In progress</span>`;
    return `<li><a href="?d=${p.date}"><span class="no">${caseNo(p.n)}</span><span>${longDate(p.date)}${p.date === today ? " (today)" : ""}</span>${st}</a></li>`;
  });
  $("#archive-list").innerHTML = rows.join("") || `<li class="empty">The archive grows by one case a day.</li>`;
}

// ---------- start ----------
const topbar = document.querySelector(".top");
addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 8), { passive: true });

async function boot() {
  today = localDate();
  try { index = await fetch("puzzles/index.json", { cache: "no-cache" }).then((r) => r.json()); }
  catch { $("#subject").textContent = "Couldn't load today's case. Check your connection, then reload."; return; }
  const want = new URLSearchParams(location.search).get("d");
  const avail = index.filter((p) => p.date <= today);
  const pick = (want && avail.find((p) => p.date === want)) || avail[avail.length - 1] || index[0];
  if (!pick) { $("#subject").textContent = "The first case opens soon."; return; }
  const [p, ents] = await Promise.all([
    fetch(`puzzles/${pick.date}.json`).then((r) => r.json()),
    fetch("entities.json").then((r) => r.json()).catch(() => []),
  ]);
  puzzle = p; secret = unseal(p.secret, p.date);
  pool = ents.filter((e) => e.t === puzzle.type).map((e) => ({ ...e, k: norm(e.n) }));
  if (!pool.some((e) => e.k === norm(secret.answer))) pool.push({ n: secret.answer, t: puzzle.type, k: norm(secret.answer) });

  const latest = pick === avail[avail.length - 1];
  game = save.results[puzzle.date] || { status: "playing", guesses: [], daily: latest && !want };
  $("#case").textContent = caseNo(puzzle.n);
  $("#opened").textContent = longDate(puzzle.date);
  $("#subject").textContent = puzzle.type === "org" ? "An AI company or lab" : "An AI model or product";
  input.placeholder = puzzle.type === "org" ? "Company or lab name" : "Model or product name";
  render();

  if (!save.seenHelp) { save.seenHelp = true; persist(); $("#help").showModal(); }
}
boot();
