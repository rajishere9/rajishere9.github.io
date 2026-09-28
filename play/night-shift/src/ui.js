// In-canvas interface: dialogue, choices, the pager, notes, toasts, title and end cards.
import { P, W, H, LINE, rect, dot, text, textWidth, wrap } from "./gfx.js";
import { portrait } from "./content/people.js";

export const NAMES = { you: "You", ray: "Ray", mope: "MOP-E", pip: "PIP", pager: "Marguerite" };
const VOICE = { you: "you", ray: "ray", mope: "mope", pip: "pip", pager: "pager" };

export function box(x, X, Y, w, h, { fill = "#0a0e17", edge = "#3a475d", hi = "#1c2433" } = {}) {
  rect(x, X + 1, Y, w - 2, h, fill); rect(x, X, Y + 1, w, h - 2, fill);
  rect(x, X + 1, Y, w - 2, 1, edge); rect(x, X + 1, Y + h - 1, w - 2, 1, edge); rect(x, X, Y + 1, 1, h - 2, edge); rect(x, X + w - 1, Y + 1, 1, h - 2, edge);
  rect(x, X + 1, Y + 1, w - 2, 1, hi);
}
const inside = (p, b) => p && p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;

// A set of buttons that works by tap, mouse, arrows and A.
export class Buttons {
  constructor(list) { this.list = list; this.focus = 0; }
  update(inp, g) {
    const L = this.list.filter((b) => !b.off);
    if (!L.length) return null;
    if (inp.hover) { const h = L.findIndex((b) => inside(inp.hover, b)); if (h >= 0 && L[h] !== this.cur) { this.focus = this.list.indexOf(L[h]); } }
    if (inp.tap) { const b = L.find((b) => inside(inp.tap, b)); if (b) { this.focus = this.list.indexOf(b); g.audio.sfx("select"); return b; } }
    const cur = this.list[this.focus]?.off ? L[0] : this.list[this.focus] || L[0];
    for (const [d, dx, dy] of [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]]) {
      if (!inp.pressed[d]) continue;
      let best = null, bs = Infinity;
      for (const b of L) {
        if (b === cur) continue;
        const vx = b.x + b.w / 2 - (cur.x + cur.w / 2), vy = b.y + b.h / 2 - (cur.y + cur.h / 2);
        const along = vx * dx + vy * dy;
        if (along <= 0) continue;
        const s = along + Math.abs(vx * dy + vy * dx) * 2.5;
        if (s < bs) { bs = s; best = b; }
      }
      if (best) { this.focus = this.list.indexOf(best); g.audio.sfx("tick"); }
    }
    this.cur = this.list[this.focus];
    if (inp.pressed.a && this.cur && !this.cur.off) { g.audio.sfx("select"); return this.cur; }
    return null;
  }
  get current() { return this.list[this.focus]; }
}

export function key(x, b, focused, { fill = "#2b3140", ink = P.pale, down = false } = {}) {
  const y = b.y + (down ? 1 : 0);
  rect(x, b.x + 1, b.y + b.h - 1, b.w - 2, 1, "#07090f");
  rect(x, b.x, y, b.w, b.h - 1, focused ? "#3c4558" : fill);
  rect(x, b.x, y, b.w, 1, focused ? "#59647a" : "#3c4558");
  if (focused) { rect(x, b.x - 1, y, 1, b.h - 1, P.amber); rect(x, b.x + b.w, y, 1, b.h - 1, P.amber); }
  if (b.label) text(x, b.label, b.x + b.w / 2, y + Math.floor((b.h - 1 - 7) / 2), b.off ? "#566076" : ink, { align: "center" });
}

// ---- Dialogue ----
export class Dialogue {
  constructor(g, who, str, opts = {}) {
    this.g = g; this.who = who; this.opts = opts;
    this.face = who && who !== "note" && who !== "sign";
    this.tw = this.face ? 250 : 290;
    const lines = wrap(str, this.tw);
    this.pages = [];
    for (let i = 0; i < lines.length; i += 3) this.pages.push(lines.slice(i, i + 3));
    this.page = 0; this.shown = 0; this.acc = 0; this.t = 0;
    g.announce(`${NAMES[who] ? NAMES[who] + ": " : ""}${str}`);
  }
  get full() { return this.pages[this.page].join("\n"); }
  update(dt, inp) {
    this.t += dt;
    const g = this.g, cps = [28, 48, 110][g.settings.speed ?? 1], s = this.full;
    if (this.shown < s.length) {
      this.acc += dt * cps;
      while (this.acc >= 1 && this.shown < s.length) {
        const ch = s[this.shown++];
        this.acc -= ch === "." || ch === "?" || ch === "!" ? 7 : ch === "," ? 3 : 1;
        if (ch !== " " && this.shown % 2 === 0 && this.who !== "note" && this.who !== "sign") g.audio.blip(VOICE[this.who] || "sign");
      }
      g.talking = this.who;
    } else g.talking = null;
    if (inp.pressed.a || inp.pressed.b || inp.tap) {
      if (this.shown < s.length) this.shown = s.length;
      else if (this.page < this.pages.length - 1) { this.page++; this.shown = 0; this.acc = 0; }
      else { this.done = true; g.talking = null; }
    }
  }
  draw(x) {
    const X = 6, Y = 127, w = 308, h = 47;
    box(x, X, Y, w, h, this.who === "note" ? { fill: "#e7e1d1", edge: "#8f8775", hi: "#f3eee2" } : {});
    const ink = this.who === "note" ? "#2a2620" : P.white;
    let tx = X + 10;
    if (this.face) {
      const talk = this.shown < this.full.length && Math.floor(this.t * 9) % 2;
      const blink = Math.floor(this.t * 10) % 37 === 0;
      rect(x, X + 7, Y + 8, 32, 32, "#141a26");
      x.drawImage(portrait(this.who, talk ? 1 : 0, blink), X + 9, Y + 10);
      tx = X + 46;
      const name = NAMES[this.who] || "";
      const nw = textWidth(name) + 10;
      box(x, X + 6, Y - 10, nw, 12, { fill: "#0a0e17", edge: "#3a475d", hi: "#0a0e17" });
      text(x, name, X + 11, Y - 8, this.who === "pip" ? P.phosphor : this.who === "pager" ? P.lcd : P.amber);
    }
    const vis = this.full.slice(0, this.shown).split("\n");
    vis.forEach((l, i) => text(x, l, tx, Y + 7 + i * LINE, ink));
    if (this.shown >= this.full.length && Math.floor(this.t * 3) % 2) text(x, "▾", X + w - 12, Y + h - 11, this.who === "note" ? "#8f8775" : P.amber);
  }
}

// ---- Choices ----
export class Choice {
  constructor(g, opts, prompt) {
    this.g = g; this.opts = opts; this.prompt = prompt;
    const w = Math.max(...opts.map((o) => textWidth(o))) + 22, h = opts.length * 13 + 8;
    this.X = W - 8 - w; this.Y = 120 - h; this.w = w; this.h = h;
    this.btn = new Buttons(opts.map((o, i) => ({ id: i, label: o, x: this.X + 4, y: this.Y + 4 + i * 13, w: w - 8, h: 13 })));
    g.announce(`Choose: ${opts.join(". ")}`);
  }
  update(dt, inp) {
    const b = this.btn.update(inp, this.g);
    if (b) { this.done = true; this.result = b.id; }
  }
  draw(x) {
    if (this.prompt) this.prompt.draw(x);
    box(x, this.X, this.Y, this.w, this.h);
    this.btn.list.forEach((b, i) => {
      const f = i === this.btn.focus;
      if (f) rect(x, b.x, b.y, b.w, b.h, "#1c2433");
      text(x, b.label, b.x + 12, b.y + 3, f ? P.white : P.pale);
      if (f) text(x, "▸", b.x + 3, b.y + 3, P.amber);
    });
  }
}

// ---- Notes, floppy logs and signs: a full paper or screen view ----
export class Note {
  constructor(g, { title, body, style = "paper", foot }) {
    this.g = g; this.title = title; this.style = style; this.foot = foot; this.t = 0;
    this.lines = wrap(body, style === "disk" ? 236 : 200);
    g.announce(`${title}. ${body}`);
  }
  update(dt, inp) { this.t += dt; if (this.t > 0.25 && (inp.pressed.a || inp.pressed.b || inp.tap)) this.done = true; }
  draw(x) {
    rect(x, 0, 0, W, H, "rgba(7,9,15,.72)");
    if (this.style === "disk") {
      const w = 260, h = 40 + this.lines.length * LINE, X = (W - w) / 2, Y = (H - h) / 2;
      rect(x, X, Y, w, h, "#0c1a2c"); rect(x, X, Y, w, 11, "#3b6fb0");
      text(x, this.title, X + 5, Y + 2, P.white);
      this.lines.forEach((l, i) => text(x, l, X + 12, Y + 18 + i * LINE, "#cfe3f4"));
      if (this.foot) text(x, this.foot, X + w - 6, Y + h - 11, "#6d93bd", { align: "right" });
      if (Math.floor(this.t * 2) % 2) rect(x, X + 12, Y + 18 + this.lines.length * LINE - 1, 5, 1, "#cfe3f4");
      return;
    }
    const w = 220, h = 34 + this.lines.length * LINE, X = (W - w) / 2, Y = (H - h) / 2;
    rect(x, X + 3, Y + 3, w, h, "rgba(0,0,0,.4)");
    rect(x, X, Y, w, h, this.style === "sticky" ? "#f2d563" : "#e7e1d1");
    if (this.style === "sticky") { rect(x, X, Y, w, 5, "#d9bb47"); rect(x, X + w - 40, Y + h - 22, 26, 16, "rgba(107,65,40,.25)"); }
    text(x, this.title, X + 10, Y + 9, this.style === "sticky" ? "#6b4b1f" : "#8f8775");
    this.lines.forEach((l, i) => text(x, l, X + 10, Y + 22 + i * LINE, "#2a2620"));
  }
}

// ---- Toasts: short, top of screen, never block play ----
export class Toasts {
  constructor() { this.q = []; }
  push(s, dur = 3.2) { this.q.push({ s, t: 0, dur }); }
  update(dt) { if (this.q[0]) { this.q[0].t += dt; if (this.q[0].t > this.q[0].dur) this.q.shift(); } }
  draw(x) {
    const q = this.q[0];
    if (!q) return;
    const a = Math.min(1, q.t * 5, (q.dur - q.t) * 4), w = textWidth(q.s) + 14, X = Math.round((W - w) / 2), Y = Math.round(22 - (1 - a) * 8);
    x.globalAlpha = Math.max(0, a);
    box(x, X, Y, w, 13, { fill: "#0a0e17", edge: "#59647a", hi: "#1c2433" });
    text(x, q.s, X + 7, Y + 3, P.white);
    x.globalAlpha = 1;
  }
}

// ---- The pager: tasks, pages, a hint line and settings ----
export class Pager {
  constructor(g, tab = 0) {
    this.g = g; this.tab = tab; this.scroll = 0; this.hint = null; this.t = 0;
    this.X = 36; this.Y = 14; this.w = 248; this.h = 152;
    const kx = this.X + 12, ky = this.Y + this.h - 24;
    this.keys = new Buttons(["Tasks", "Pages", "Hint", "Options"].map((l, i) => ({ id: i, label: l, x: kx + i * 50, y: ky, w: 46, h: 14 })).concat([{ id: "x", label: "Close", x: this.X + this.w - 46, y: ky, w: 36, h: 14 }]));
    this.keys.focus = tab;
    this.opts = null;
    g.state.unread = 0;
  }
  optList() {
    const s = this.g.settings;
    return [
      `Sound: ${s.sound ? "on" : "off"}`,
      `Text speed: ${["slow", "normal", "fast"][s.speed ?? 1]}`,
      `Flashing lights: ${s.flashing ? "on" : "off"}`,
      "Restart the shift",
    ];
  }
  update(dt, inp) {
    this.t += dt;
    const g = this.g;
    if (inp.pressed.b || inp.pressed.menu) { this.done = true; g.audio.sfx("back"); return; }
    if (inp.tap && !inside(inp.tap, { x: this.X, y: this.Y, w: this.w, h: this.h })) { this.done = true; return; }
    const LCD = { x: this.X + 12, y: this.Y + 12, w: this.w - 24, h: this.h - 44 };
    // In the options tab, arrows move through the list; elsewhere they switch tabs.
    if (this.tab === 3 && (inp.pressed.up || inp.pressed.down) && !inp.tap) {
      this.opt = ((this.opt ?? 0) + (inp.pressed.down ? 1 : 3)) % 4; g.audio.sfx("tick");
    } else if ((this.tab === 1) && (inp.pressed.up || inp.pressed.down)) {
      this.scroll = Math.max(0, this.scroll + (inp.pressed.down ? 1 : -1));
    } else if (inp.pressed.left || inp.pressed.right) {
      this.tab = (this.tab + (inp.pressed.right ? 1 : 3)) % 4; this.keys.focus = this.tab; this.scroll = 0; g.audio.sfx("tick");
      return;
    }
    if (inp.tap && inside(inp.tap, LCD)) {
      if (this.tab === 3) { const i = Math.floor((inp.tap.y - LCD.y - 18) / 13); if (i >= 0 && i < 4) { this.opt = i; this.toggle(i); } }
      else if (this.tab === 2) this.askHint();
      else if (this.tab === 1) this.scroll++;
      return;
    }
    const k = this.keys.update({ ...inp, pressed: { ...inp.pressed, a: false, up: false, down: false, left: false, right: false } }, g);
    if (k) { if (k.id === "x") { this.done = true; return; } this.tab = k.id; this.scroll = 0; }
    if (inp.pressed.a) {
      if (this.tab === 2) this.askHint();
      else if (this.tab === 3) this.toggle(this.opt ?? 0);
    }
  }
  askHint() {
    const g = this.g;
    this.hint = g.story.hint(g);
    g.audio.sfx("pager");
  }
  toggle(i) {
    const g = this.g, s = g.settings;
    if (i === 0) { s.sound = !s.sound; g.audio.setOn(s.sound); }
    if (i === 1) s.speed = ((s.speed ?? 1) + 1) % 3;
    if (i === 2) s.flashing = !s.flashing;
    if (i === 3) { this.done = true; g.confirmRestart(); return; }
    g.audio.sfx("select");
    g.saveSettings();
  }
  draw(x) {
    const g = this.g, { X, Y, w, h } = this;
    rect(x, 0, 0, W, H, "rgba(7,9,15,.6)");
    rect(x, X + 2, Y + 3, w, h, "rgba(0,0,0,.45)");
    rect(x, X, Y, w, h, "#2b2f38"); rect(x, X, Y, w, 2, "#454b58"); rect(x, X, Y + h - 3, w, 3, "#1d2027");
    rect(x, X + 6, Y + 6, w - 12, h - 38, "#1d2027");
    const LX = X + 12, LY = Y + 12, LW = w - 24, LH = h - 44;
    rect(x, LX, LY, LW, LH, P.lcd);
    for (let j = 0; j < LH; j += 2) rect(x, LX, LY + j, LW, 1, "rgba(40,51,31,.05)");
    const ink = P.lcdInk, faint = "#6c7a58";
    const tabs = ["Tasks", "Pages", "Hint", "Options"];
    text(x, tabs[this.tab], LX + 5, LY + 4, ink);
    text(x, g.clock(), LX + LW - 5, LY + 4, ink, { align: "right" });
    rect(x, LX + 4, LY + 14, LW - 8, 1, faint);
    let y = LY + 19;
    if (this.tab === 0) {
      const list = g.story.objectives(g);
      for (const o of list.slice(-6)) {
        rect(x, LX + 6, y + 1, 5, 5, o.done ? ink : faint); if (!o.done) rect(x, LX + 7, y + 2, 3, 3, P.lcd);
        text(x, o.text, LX + 16, y, o.done ? faint : ink);
        y += 12;
      }
      text(x, `Disks found: ${g.state.disks.length} of 6`, LX + 5, LY + LH - 11, faint);
    } else if (this.tab === 1) {
      const pages = g.state.pages.slice().reverse();
      const lines = [];
      for (const p of pages) { lines.push({ s: p.at, c: faint }); for (const l of wrap(p.text, LW - 14)) lines.push({ s: l, c: ink }); lines.push(null); }
      this.scroll = Math.min(this.scroll, Math.max(0, lines.length - 7));
      lines.slice(this.scroll, this.scroll + 8).forEach((l) => { if (l) text(x, l.s, LX + 6, y, l.c); y += 10; });
      if (!pages.length) text(x, "No pages yet.", LX + 6, y, faint);
    } else if (this.tab === 2) {
      if (!this.hint) { text(x, "Stuck? Page Marguerite.", LX + 6, y, ink); text(x, g.input.mode === "touch" ? "Tap here to send." : "Press Space to send.", LX + 6, y + 12, faint); }
      else wrap(this.hint, LW - 14).forEach((l, i) => text(x, l, LX + 6, y + i * 11, ink));
    } else {
      this.optList().forEach((l, i) => {
        const f = (this.opt ?? 0) === i;
        if (f) rect(x, LX + 3, y - 2, LW - 6, 12, "#a5b287");
        text(x, l, LX + 12, y, ink);
        if (f) text(x, "▸", LX + 5, y, ink);
        y += 13;
      });
    }
    this.keys.list.forEach((b, i) => key(x, b, b.id === this.tab || (b.id === "x" && this.keys.focus === 4), { fill: "#383d49", ink: b.id === "x" ? "#e59a9d" : P.pale }));
    rect(x, X + w - 18, Y + 4, 6, 3, Math.floor(this.t * 2) % 2 ? P.red : "#6b2427");
  }
}

// ---- End card ----
export class EndCard {
  constructor(g, ending) {
    this.g = g; this.e = ending; this.t = 0;
    this.btn = new Buttons([{ id: "again", label: "New shift", x: 80, y: 146, w: 76, h: 16 }, { id: "play", label: "More games", x: 164, y: 146, w: 76, h: 16 }]);
  }
  update(dt, inp) {
    this.t += dt;
    if (this.t < 1) return;
    const b = this.btn.update(inp, this.g);
    if (b?.id === "again") this.g.newShift();
    if (b?.id === "play") location.href = "/play/";
  }
  draw(x) {
    const g = this.g, e = this.e, a = Math.min(1, this.t);
    rect(x, 0, 0, W, H, P.ink);
    x.globalAlpha = a;
    text(x, "Ending", W / 2, 22, "#6c7a8c", { align: "center" });
    text(x, e.title, W / 2, 34, e.color || P.amber, { align: "center", scale: 2 });
    wrap(e.line, 280).forEach((l, i) => text(x, l, W / 2, 66 + i * LINE, P.pale, { align: "center" }));
    const found = g.meta.endings.length;
    const stats = [`Endings found: ${found} of 3`, `Disks found: ${g.state.disks.length} of 6`, `Shift length: ${g.playTime()}`];
    stats.forEach((s, i) => text(x, s, W / 2, 104 + i * 11, i === 0 ? P.white : "#8b98ab", { align: "center" }));
    x.globalAlpha = 1;
    if (this.t >= 1) this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus));
  }
}
