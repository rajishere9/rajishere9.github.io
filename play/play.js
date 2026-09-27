// Hub: frosted header on scroll, cards that lean toward the pointer, and live status from each game.
const top = document.querySelector(".top");
const onScroll = () => top.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
document.getElementById("yr").textContent = new Date().getFullYear();

const fine = matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches;
for (const card of document.querySelectorAll(".game:not(.soon)")) {
  if (!fine) break;
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", `${x * 100}%`); card.style.setProperty("--my", `${y * 100}%`);
    card.style.setProperty("--rx", `${(0.5 - y) * 6}deg`); card.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
  });
  card.addEventListener("pointerleave", () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
}

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
fetch("ai-dle/puzzles/index.json").then((r) => r.json()).then((index) => {
  const today = localDate(), p = index.filter((x) => x.date <= today).pop();
  if (!p) return;
  let save = {}; try { save = JSON.parse(localStorage.getItem("aidle:v1")) || {}; } catch {}
  const res = save.results?.[p.date];
  const status = document.getElementById("aidle-status");
  status.textContent = res?.status === "won" ? `#${p.n} solved in ${res.guesses.length}` : res?.status === "lost" ? `#${p.n} done` : `#${p.n} is live`;
  if (res && res.status !== "playing") status.classList.remove("live");
  const streak = save.streak || 0;
  if (streak > 1) { const s = document.getElementById("aidle-streak"); s.hidden = false; s.textContent = `🔥 ${streak}-day streak`; }
}).catch(() => {});
fetch("scale-of-ai/data.json").then((r) => r.json()).then((d) => {
  document.getElementById("scale-count").textContent = `${d.models.length} models · 1950 to ${d.models.reduce((y, m) => (m.d > y ? m.d : y), "").slice(0, 4)}`;
}).catch(() => {});
