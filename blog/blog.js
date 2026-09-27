// Blog polish: header frosting, reading progress, relative times, the table of contents, copy link.
(() => {
  const header = document.querySelector(".top");
  const bar = document.querySelector(".progress span");
  const article = document.querySelector(".prose");
  let queued = false;
  function update() {
    queued = false;
    header && header.classList.toggle("scrolled", scrollY > 4);
    if (bar && article) {
      const r = article.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.35 - r.top) / r.height));
      bar.style.setProperty("--p", p.toFixed(4));
    }
  }
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  // "3h ago" for recent stories, in the reader's own time zone on hover.
  const rtf = "Intl" in window && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
  document.querySelectorAll("time[data-rel]").forEach((el) => {
    const t = Date.parse(el.getAttribute("datetime"));
    if (!t) return;
    el.title = new Date(t).toLocaleString();
    if (!rtf) return;
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 0 || mins > 60 * 24 * 6) return;
    const rel = mins < 60 ? rtf.format(-Math.max(1, mins), "minute") : mins < 1440 ? rtf.format(-Math.round(mins / 60), "hour") : rtf.format(-Math.round(mins / 1440), "day");
    el.textContent = el.classList.contains("abs") ? `${el.textContent} (${rel})` : rel;
  });

  // Highlight the section being read.
  const links = [...document.querySelectorAll(".toc a")];
  if (links.length && "IntersectionObserver" in window) {
    const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove("active"));
        map.get(e.target.id)?.classList.add("active");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    map.forEach((_, id) => { const h = document.getElementById(id); h && io.observe(h); });
  }

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const label = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = label), 1600);
      } catch {}
    });
  });
})();
