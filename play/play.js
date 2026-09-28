// Play index: frosted header on scroll, plus today's status from each game.
const topbar = document.querySelector(".top");
const onScroll = () => topbar.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
document.getElementById("yr").textContent = new Date().getFullYear();

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
fetch("ai-dle/puzzles/index.json").then((r) => r.json()).then((index) => {
  const p = index.filter((x) => x.date <= localDate()).pop();
  if (!p) return;
  let save = {}; try { save = JSON.parse(localStorage.getItem("aidle:v1")) || {}; } catch {}
  const res = save.results?.[p.date], no = String(p.n).padStart(3, "0");
  const el = document.getElementById("aidle-status");
  el.innerHTML = res?.status === "won" ? `You solved case ${no} on clue ${res.guesses.length}.` : res?.status === "lost" ? `Case ${no} is closed. The next one opens at midnight.` : `<b>Case ${no} is open.</b>`;
  if ((save.streak || 0) > 1) el.innerHTML += ` Your streak is ${save.streak} days.`;
}).catch(() => {});
fetch("scale-of-ai/data.json").then((r) => r.json()).then((d) => {
  document.getElementById("scale-status").textContent = `${d.models.length} models, data from Epoch AI updated ${new Date(`${d.updated}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.`;
}).catch(() => {});
try {
  const d = JSON.parse(localStorage.getItem("nightshift:v1")) || {}, n = (d.meta?.endings || []).length, el = document.getElementById("night-status");
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  if (d.run) el.innerHTML = `<b>Your shift is paused at ${hhmm(d.run.minute)}.</b>`;
  else if (n) el.textContent = n === 3 ? "You've found all three endings." : `Endings found: ${n} of 3.`;
} catch {}
