// Motion for the home page. Everything here is optional polish: the page reads the same without it.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const narrow = matchMedia("(max-width: 720px)");

  const header = document.querySelector(".top");
  const tl = document.querySelector(".tl");
  const burn = tl && tl.querySelector(".burn");
  const entries = tl ? [...tl.querySelectorAll(".entry")] : [];

  // Header frosting and the flame burning down the timeline, both driven by scroll.
  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }
  function dotY(entry) {
    if (narrow.matches) {
      const when = entry.querySelector(".when").getBoundingClientRect();
      return when.top + 12;
    }
    return entry.querySelector(".body").getBoundingClientRect().top + 14;
  }
  function update() {
    queued = false;
    header.classList.toggle("scrolled", window.scrollY > 24);
    if (!tl) return;
    const box = tl.getBoundingClientRect();
    const top = narrow.matches ? 10 : 14;
    const reach = window.innerHeight * 0.6 - box.top - top;
    const height = Math.max(0, Math.min(box.height - top, reach));
    burn.style.setProperty("--burn", height + "px");
    const tip = box.top + top + height;
    entries.forEach((entry, i) => entry.classList.toggle("reached", i === 0 || dotY(entry) <= tip + 1));
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();

  // Mark the nav link for the section on screen.
  const links = [...document.querySelectorAll(".top nav a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((items) => {
      items.forEach((item) => {
        if (!item.isIntersecting) return;
        links.forEach((a) => {
          if (a.getAttribute("href") === "#" + item.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => io.observe(s));
  }

  // Website screenshots scroll through the whole page: on hover with a mouse, once in view on touch.
  document.querySelectorAll(".browser").forEach((fig) => {
    const view = fig.querySelector(".viewport");
    const img = view && view.querySelector("img");
    if (!img) return;
    const pan = (down) => {
      const distance = Math.max(0, img.offsetHeight - view.offsetHeight);
      fig.style.setProperty("--pan-time", down ? Math.max(3, distance / 240) + "s" : "1.4s");
      fig.style.setProperty("--pan", down ? -distance + "px" : "0px");
    };
    if (reduce) return;
    if (finePointer) {
      fig.addEventListener("mouseenter", () => pan(true));
      fig.addEventListener("mouseleave", () => pan(false));
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => pan(e.isIntersecting), { threshold: 0.7 }).observe(fig);
    }
  });

  if (reduce || !finePointer) return;

  // A faint candle light that follows the pointer, eased so it trails a little.
  const lantern = document.querySelector(".lantern");
  let tx = innerWidth * 0.3, ty = innerHeight * 0.3, x = tx, y = ty, running = false;
  function glide() {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    lantern.style.setProperty("--mx", x + "px");
    lantern.style.setProperty("--my", y + "px");
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) requestAnimationFrame(glide);
    else running = false;
  }
  addEventListener("pointermove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
    lantern.classList.add("on");
    if (!running) { running = true; requestAnimationFrame(glide); }
  }, { passive: true });
  document.addEventListener("pointerleave", () => lantern.classList.remove("on"));

  // The portrait leans slightly toward the pointer.
  const portrait = document.querySelector(".portrait");
  const frame = portrait && portrait.querySelector(".frame");
  if (frame) {
    portrait.addEventListener("pointermove", (e) => {
      const r = frame.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      frame.style.setProperty("--ry", (px * 8).toFixed(2) + "deg");
      frame.style.setProperty("--rx", (py * -8).toFixed(2) + "deg");
    });
    portrait.addEventListener("pointerleave", () => {
      frame.style.setProperty("--ry", "0deg");
      frame.style.setProperty("--rx", "0deg");
    });
  }
})();
