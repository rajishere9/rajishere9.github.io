// The loss log: find the spikes on LARK-7's training curve and the pattern gives itself away.
import { P, W, rect, dot, text } from "../gfx.js";
import { Buttons, box, key } from "../ui.js";
import { loss, SPIKES, CHART, clockText } from "../content/data.js";

const NEED = 3;

export class LossChart {
  constructor(g) {
    this.g = g; this.t = 0; this.marks = []; this.msg = "Tap the spikes, or move the cursor and mark them."; this.win = 0;
    this.X = 8; this.Y = 6; this.cx = { x: 30, y: 30, w: 272, h: 96 };
    this.cur = 0.1;
    this.btn = new Buttons([{ id: "mark", label: "Mark spike", x: 110, y: 154, w: 64, h: 16 }, { id: "done", label: "Close", x: 250, y: 154, w: 50, h: 16 }]);
    if (g.input.mode !== "touch") this.msg = "Left and right move the cursor. Space marks a spike.";
    this.hold = 0;
  }
  minute(p) { return CHART.from + p * (CHART.to - CHART.from); }
  yOf(v) { const c = this.cx; return c.y + c.h - 10 - ((v - 2.28) / 0.06) * (c.h - 20); }
  tryMark() {
    const g = this.g, m = this.minute(this.cur), hit = SPIKES.find((s) => s >= CHART.from && Math.abs(s - m) <= 2.2);
    if (!hit) { this.msg = "That's just noise."; g.audio.sfx("bump"); return; }
    if (this.marks.includes(hit)) { this.msg = "Already marked."; return; }
    this.marks.push(hit); this.marks.sort((a, b) => a - b); g.audio.sfx("key");
    this.msg = `Marked ${clockText(hit)}.`;
    if (this.marks.length >= NEED) {
      const gaps = this.marks.slice(1).map((m, i) => m - this.marks[i]);
      this.msg = `${this.marks.map(clockText).join(", ")}. ${gaps.every((d) => d === 17) ? "Exactly 17 minutes apart." : "Multiples of 17 minutes."}`;
      this.win = 0.001; g.audio.sfx("ok");
    }
  }
  update(dt, inp) {
    this.t += dt;
    const c = this.cx;
    if (this.win) { this.win += dt; if (this.win > 1.2 && (inp.pressed.a || inp.tap || inp.pressed.b)) { this.done = true; this.result = true; } return; }
    if (inp.pressed.b) { this.done = true; this.result = false; return; }
    const d = (inp.held.right ? 1 : 0) - (inp.held.left ? 1 : 0);
    if (d) { this.hold += dt; this.cur = Math.max(0, Math.min(1, this.cur + d * dt * (this.hold > 0.6 ? 0.28 : 0.09))); } else this.hold = 0;
    const p = inp.drag?.down ? inp.drag : null;
    if (p && p.x >= c.x && p.x < c.x + c.w && p.y >= c.y - 6 && p.y < c.y + c.h + 6) this.cur = (p.x - c.x) / c.w;
    if (inp.tap && inp.tap.x >= c.x && inp.tap.x < c.x + c.w && inp.tap.y >= c.y - 6 && inp.tap.y < c.y + c.h + 6) {
      this.cur = (inp.tap.x - c.x) / c.w;
      const m = this.minute(this.cur);
      if (SPIKES.some((s) => s >= CHART.from && Math.abs(s - m) <= 2.2 && !this.marks.includes(s))) this.tryMark();
      return;
    }
    const b = this.btn.update({ ...inp, pressed: { ...inp.pressed, left: false, right: false } }, this.g);
    if (b?.id === "mark") this.tryMark();
    if (b?.id === "done") { this.done = true; this.result = false; }
  }
  draw(x) {
    const c = this.cx;
    rect(x, 0, 0, W, 180, "rgba(7,9,15,.75)");
    box(x, this.X, this.Y, 304, 168, { fill: "#0b1320", edge: "#2d4a66", hi: "#13233a" });
    text(x, "LARK-7  training loss, last two hours", this.X + 10, this.Y + 6, "#8fb2d4");
    for (let i = 0; i <= 4; i++) {
      const gx = c.x + Math.round((i / 4) * c.w);
      rect(x, gx, c.y, 1, c.h, "#13233a");
      text(x, clockText(CHART.from + i * 30), gx, c.y + c.h + 4, "#4f6f92", { align: "center" });
    }
    for (let j = 0; j < 4; j++) rect(x, c.x, c.y + 8 + j * 24, c.w, 1, "#13233a");
    let prev = null;
    for (let i = 0; i < c.w; i++) {
      const m = this.minute(i / c.w), y = Math.round(this.yOf(loss(m)));
      if (prev != null) for (let k = Math.min(prev, y); k <= Math.max(prev, y); k++) dot(x, c.x + i, k, P.cold);
      prev = y;
    }
    for (const m of this.marks) {
      const mx = c.x + Math.round(((m - CHART.from) / (CHART.to - CHART.from)) * c.w), my = Math.round(this.yOf(loss(m)));
      rect(x, mx - 3, my - 3, 7, 1, P.red); rect(x, mx - 3, my + 3, 7, 1, P.red); rect(x, mx - 3, my - 3, 1, 7, P.red); rect(x, mx + 3, my - 3, 1, 7, P.red);
    }
    if (this.marks.length >= 2) for (let i = 1; i < this.marks.length; i++) {
      const a = c.x + ((this.marks[i - 1] - CHART.from) / 120) * c.w, b = c.x + ((this.marks[i] - CHART.from) / 120) * c.w;
      rect(x, a, c.y + 4, b - a, 1, P.red); text(x, "17m", (a + b) / 2, c.y - 6, P.red, { align: "center" });
    }
    const cxp = c.x + Math.round(this.cur * c.w), m = this.minute(this.cur);
    for (let y = c.y; y < c.y + c.h; y += 2) dot(x, cxp, y, P.amber);
    text(x, `${clockText(m)}  ${loss(m).toFixed(3)}`, this.X + 294, this.Y + 6, P.amber, { align: "right" });
    text(x, `${this.marks.length} of ${NEED}`, this.X + 10, this.Y + 151, "#4f6f92");
    text(x, this.msg, this.X + 152, this.Y + 136, this.win ? P.white : "#8fb2d4", { align: "center" });
    if (!this.win) this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus, { fill: "#13233a", ink: "#cfe3f4" }));
    else if (Math.floor(this.t * 2) % 2) text(x, "▾", this.X + 290, this.Y + 154, P.amber);
  }
}
