// The patch panel, in the dark. A small torch shows each cable's true colour;
// follow C-08's cable down through the tangle to wherever it really goes.
import { P, W, rect, dot, text, hash } from "../gfx.js";
import { Buttons, box, key } from "../ui.js";

const TOP = ["A-01", "A-05", "B-02", "B-07", "C-03", "C-08", "D-01", "NOC"];
const BOT = ["P1", "P2", "P3", "P4", "RM-0", "P6", "P7", "P8"];
const LINKS = [[0, 6], [1, 2], [2, 7], [3, 0], [4, 5], [5, 4], [6, 1], [7, 3]];
const COLS = [P.cold, P.led, P.red, "#c77dd6", P.pale, P.amber, "#e07a3c", "#6fd6c8"];
const WRONG = { P1: "the storage uplink", P2: "the spare switch", P3: "the badge system", P4: "the NOC printer", P6: "Row A's backup link", P7: "the vending machine. Really", P8: "the roof camera" };

export class Patch {
  constructor(g) {
    this.g = g; this.t = 0; this.win = 0;
    this.X = 10; this.Y = 6;
    this.top = TOP.map((_, i) => ({ x: this.X + 26 + i * 36, y: this.Y + 30 }));
    this.bot = BOT.map((_, i) => ({ x: this.X + 26 + i * 36, y: this.Y + 132 }));
    this.cables = LINKS.map(([a, b], k) => {
      const A = this.top[a], B = this.bot[b], pts = [];
      const c1 = { x: A.x + (hash(k, 1) - 0.5) * 140, y: A.y + 30 + hash(k, 2) * 30 }, c2 = { x: B.x + (hash(k, 3) - 0.5) * 140, y: B.y - 30 - hash(k, 4) * 30 };
      for (let i = 0; i <= 120; i++) {
        const s = i / 120, u = 1 - s;
        pts.push({ x: u * u * u * A.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * B.x, y: u * u * u * A.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * B.y });
      }
      return { a, b, color: COLS[k], pts };
    });
    this.light = { x: this.top[5].x, y: this.top[5].y + 8 };
    this.msg = "C-08 is lit. Follow its cable down with the light.";
    this.btn = new Buttons([{ id: "pick", label: "This port", x: 120, y: 160, w: 60, h: 14 }, { id: "done", label: "Close", x: 252, y: 160, w: 50, h: 14 }]);
  }
  update(dt, inp) {
    this.t += dt;
    if (this.win) { this.win += dt; if (this.win > 1.2 && (inp.pressed.a || inp.tap || inp.pressed.b)) { this.done = true; this.result = true; } return; }
    if (inp.pressed.b) { this.done = true; this.result = false; return; }
    const d = inp.dir, sp = 70;
    this.light.x = Math.max(this.X + 8, Math.min(this.X + 292, this.light.x + d.x * sp * dt));
    this.light.y = Math.max(this.Y + 20, Math.min(this.Y + 146, this.light.y + d.y * sp * dt));
    if (inp.drag?.down && inp.drag.y < 156) { this.light.x = inp.drag.x; this.light.y = inp.drag.y - (this.g.input.mode === "touch" ? 14 : 0); }
    if (inp.tap && inp.tap.y < 150) {
      const port = this.bot.findIndex((p) => Math.abs(p.x - inp.tap.x) < 14 && Math.abs(p.y - inp.tap.y) < 14);
      if (port >= 0 && Math.hypot(this.bot[port].x - this.light.x, this.bot[port].y - this.light.y) < 30) return this.pick(port);
      return;
    }
    const b = this.btn.update({ ...inp, pressed: { ...inp.pressed, up: false, down: false, left: false, right: false } }, this.g);
    if (b?.id === "done") { this.done = true; this.result = false; return; }
    if (b?.id === "pick" || (inp.pressed.a && !b)) {
      const port = this.bot.findIndex((p) => Math.hypot(p.x - this.light.x, p.y - this.light.y) < 18);
      if (port < 0) { this.msg = "Point the light at a port along the bottom row."; return; }
      this.pick(port);
    }
  }
  pick(port) {
    const name = BOT[port];
    if (name === "RM-0") { this.win = 0.001; this.msg = "Port RM-0. It isn't in the port index."; this.g.audio.sfx("ok"); }
    else { this.msg = `${name} is ${WRONG[name]}. Not C-08's cable.`; this.g.audio.sfx("bump"); }
  }
  draw(x) {
    const { X, Y } = this, L = this.light, R = this.win ? 400 : 26;
    rect(x, 0, 0, W, 180, "rgba(7,9,15,.85)");
    box(x, X, Y, 300, 150, { fill: "#0b0e14", edge: "#2b3240", hi: "#141a24" });
    const lit = (px, py) => (px - L.x) ** 2 + (py - L.y) ** 2 < R * R;
    for (const c of this.cables) for (const p of c.pts) {
      const on = lit(p.x, p.y);
      dot(x, p.x, p.y, on ? c.color : "#1d2330"); dot(x, p.x + 1, p.y, on ? c.color : "#161b26");
    }
    const hot = this.cables.find((c) => c.a === 5);
    if (!this.win) for (const p of hot.pts.slice(0, 6)) dot(x, p.x, p.y, P.amber);
    const port = (p, label, i, top) => {
      const on = lit(p.x, p.y) || (top && i === 5);
      rect(x, p.x - 5, p.y - 4, 11, 8, on ? "#3a4457" : "#161b26"); rect(x, p.x - 2, p.y - 2, 5, 4, P.ink);
      if (on) text(x, label, p.x, top ? p.y - 14 : p.y + 7, top && i === 5 ? P.amber : label === "RM-0" ? P.white : P.pale, { align: "center" });
    };
    this.top.forEach((p, i) => port(p, TOP[i], i, true));
    this.bot.forEach((p, i) => port(p, BOT[i], i, false));
    // the torch
    if (!this.win) for (let a = 0; a < 40; a++) { const an = (a / 40) * Math.PI * 2; dot(x, L.x + Math.cos(an) * R, L.y + Math.sin(an) * R, a % 2 ? "rgba(255,179,71,.35)" : "rgba(255,179,71,.15)"); }
    text(x, this.msg, W / 2, Y + 152 - 147 + 3, this.win ? P.white : P.pale, { align: "center" });
    if (!this.win) this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus));
  }
}
