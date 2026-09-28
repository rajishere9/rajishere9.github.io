// The chilled water panel: four valves share one loop. Row C needs three units of flow,
// valve B has seized at two, and the loop can only carry six before the relief valve lifts.
import { P, W, rect, dot, text } from "../gfx.js";
import { Buttons, box, key } from "../ui.js";

const NEED = [1, 1, 3, 0], STUCK = 1, MAX = 6, ROWS = ["Row A", "Row B", "Row C", "Row D"];

export class Valves {
  constructor(g) {
    this.g = g; this.t = 0; this.win = 0; this.msg = "Row C needs three units of flow. The loop carries six.";
    this.v = (g.flags.valves || [2, 2, 0, 2]).slice();
    this.temps = this.target().slice();
    this.X = 10; this.Y = 8;
    const list = [];
    for (let i = 0; i < 4; i++) {
      const y = this.Y + 32 + i * 24;
      list.push({ id: `-${i}`, label: "-", x: this.X + 152, y, w: 18, h: 16 }, { id: `+${i}`, label: "+", x: this.X + 206, y, w: 18, h: 16 });
    }
    list.push({ id: "done", label: "Close", x: this.X + 242, y: this.Y + 142, w: 50, h: 15 });
    this.btn = new Buttons(list);
    this.btn.focus = 5;
  }
  target() {
    const over = this.sum() > MAX;
    return this.v.map((f, i) => (i === 3 ? 0 : 19 + Math.max(0, NEED[i] - (over ? f - 1 : f)) * 8));
  }
  sum() { return this.v.reduce((a, b) => a + b, 0); }
  turn(i, d) {
    const g = this.g;
    if (i === STUCK) { this.msg = "Valve B won't turn. It's seized at two."; g.audio.sfx("stuck"); g.shake(0.15); return; }
    const n = Math.max(0, Math.min(3, this.v[i] + d));
    if (n === this.v[i]) { g.audio.sfx("bump"); return; }
    this.v[i] = n; g.flags.valves = this.v.slice(); g.audio.sfx("valve");
    this.msg = this.sum() > MAX ? "The relief valve is lifting. Too much flow for the loop." : "Row C needs three units of flow. The loop carries six.";
  }
  solved() { return this.sum() <= MAX && this.v.every((f, i) => f >= NEED[i]) && this.v[3] === 0; }
  update(dt, inp) {
    this.t += dt;
    const T = this.target();
    this.temps = this.temps.map((c, i) => c + (T[i] - c) * Math.min(1, dt * 2.5));
    if (this.win) { this.win += dt; if (this.win > 2.2 && (inp.pressed.a || inp.tap || this.win > 5)) { this.done = true; this.result = true; } return; }
    if (inp.pressed.b) { this.done = true; this.result = false; return; }
    // Up and down pick a row, left and right turn its valve; taps use the keys.
    const cur = this.btn.current;
    if (cur && cur.id !== "done" && (inp.pressed.left || inp.pressed.right) && !inp.tap) {
      const i = +cur.id.slice(1);
      this.turn(i, inp.pressed.right ? 1 : -1);
      this.btn.focus = i * 2 + (inp.pressed.right ? 1 : 0);
      return;
    }
    const b = this.btn.update({ ...inp, pressed: { ...inp.pressed, left: false, right: false } }, this.g);
    if (b) {
      if (b.id === "done") { this.done = true; this.result = false; return; }
      this.turn(+b.id.slice(1), b.id[0] === "+" ? 1 : -1);
    }
    if (this.solved()) { this.win = 0.001; this.msg = "Row C is coming down. 21C and falling."; this.g.audio.sfx("ok"); }
  }
  draw(x) {
    const { X, Y } = this, t = this.t;
    rect(x, 0, 0, W, 180, "rgba(7,9,15,.7)");
    box(x, X, Y, 300, 164, { fill: "#1f2530", edge: "#4a5264", hi: "#2b3240" });
    text(x, "Chilled water loop, Hall B", X + 10, Y + 7, P.pale);
    rect(x, X + 10, Y + 17, 280, 1, "#343c4c");
    // The chiller, and a header pipe feeding four branches.
    rect(x, X + 12, Y + 34, 30, 88, "#3a4659"); rect(x, X + 12, Y + 34, 30, 2, P.steel2);
    text(x, "CH-1", X + 27, Y + 72, P.pale, { align: "center" });
    rect(x, X + 42, Y + 38, 8, 84, "#2d4a66");
    for (let i = 0; i < 4; i++) {
      const y = Y + 32 + i * 24, f = this.v[i], sel = this.btn.current?.id?.slice(1) === String(i);
      rect(x, X + 50, y + 6, 40, 4, "#2d4a66");
      for (let k = 0; k < f * 3; k++) { const px = X + 50 + ((k * 13 + Math.floor(t * 40)) % 40); dot(x, px, y + 7, "#8fc6f5"); }
      // valve wheel
      const vx = X + 98, vy = y + 8, spin = i === STUCK ? 0 : f;
      rect(x, vx - 5, vy - 5, 11, 11, i === STUCK ? "#6b2427" : "#a8383c");
      rect(x, vx - 3, vy - 3, 7, 7, "#1f2530");
      dot(x, vx + [0, 3, 0, -3][spin], vy + [-3, 0, 3, 0][spin], P.white); dot(x, vx, vy, P.white);
      text(x, ROWS[i], X + 110, y + 4, sel ? P.white : P.pale);
      // flow gauge between the keys
      for (let k = 0; k < 3; k++) rect(x, X + 174 + k * 10, y + 4, 8, 8, k < f ? (i === STUCK ? P.amber : P.cold) : "#2b3240");
      // row temperature
      const tc = this.temps[i];
      const label = i === 3 ? "spare, idle" : `${Math.round(tc)}C`;
      text(x, label, X + 232, y + 4, i === 3 ? "#6c7a8c" : tc > 30 ? P.red : tc > 22 ? P.amber : P.led);
    }
    // Loop pressure
    const s = this.sum(), over = s > MAX;
    text(x, "Loop", X + 12, Y + 130, P.pale);
    for (let k = 0; k < 8; k++) rect(x, X + 40 + k * 12, Y + 131, 10, 6, k < s ? (k >= MAX ? P.red : P.cold) : "#2b3240");
    rect(x, X + 40 + MAX * 12 - 1, Y + 128, 1, 12, P.amber);
    text(x, `${s} of ${MAX}`, X + 140, Y + 130, over ? P.red : P.pale);
    if (this.msg) text(x, this.msg, X + 12, Y + 146, this.win ? P.led : over ? P.red : this.msg.startsWith("Row C needs") ? "#8b98ab" : P.amber);
    this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus && !this.win, { fill: b.id === "done" ? "#2b3140" : "#343b4a" }));
  }
}
