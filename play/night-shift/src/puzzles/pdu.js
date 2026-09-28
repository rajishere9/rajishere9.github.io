// Row C's power distribution unit: one rack draws power it has no machines to use.
import { P, W, rect, text, wrap } from "../gfx.js";
import { Buttons, box, key } from "../ui.js";
import { PDU, ODD_RACK } from "../content/data.js";

export class Power {
  constructor(g) {
    this.g = g; this.t = 0; this.win = 0;
    this.msg = "Each node draws 1.1 kW. Flag the rack that doesn't add up.";
    this.X = 40; this.Y = 5;
    this.btn = new Buttons(PDU.map((r, i) => ({ id: i, x: this.X + 10, y: this.Y + 30 + i * 13, w: 220, h: 12 })).concat([{ id: "done", label: "Close", x: this.X + 182, y: this.Y + 150, w: 50, h: 14 }]));
  }
  update(dt, inp) {
    this.t += dt;
    if (this.win) { this.win += dt; if (this.win > 1 && (inp.pressed.a || inp.tap || inp.pressed.b)) { this.done = true; this.result = true; } return; }
    if (inp.pressed.b) { this.done = true; this.result = false; return; }
    const b = this.btn.update(inp, this.g);
    if (b == null) return;
    if (b.id === "done") { this.done = true; this.result = false; return; }
    const r = PDU[b.id];
    if (b.id === ODD_RACK) { this.win = 0.001; this.msg = "C-08 lists two nodes but draws 3.3 kW. Something extra is plugged in."; this.g.audio.sfx("ok"); }
    else { this.msg = `${r.rack}: ${r.nodes} nodes at 1.1 kW is ${(r.nodes * 1.1).toFixed(1)} kW. That adds up.`; this.g.audio.sfx("bump"); }
  }
  draw(x) {
    const { X, Y } = this;
    rect(x, 0, 0, W, 180, "rgba(7,9,15,.7)");
    box(x, X, Y, 240, 170, { fill: "#1f2530", edge: "#4a5264", hi: "#2b3240" });
    rect(x, X + 8, Y + 6, 224, 132, P.lcd);
    text(x, "PDU C   Row C power", X + 14, Y + 9, P.lcdInk);
    text(x, "Rack    Nodes    Load", X + 14, Y + 20, "#6c7a58");
    this.btn.list.forEach((b, i) => {
      if (b.id === "done") return key(x, b, i === this.btn.focus, { fill: "#2b3140" });
      const r = PDU[b.id], f = i === this.btn.focus, flagged = this.win && b.id === ODD_RACK;
      if (f || flagged) rect(x, b.x, b.y, b.w, b.h, flagged ? "#c9a58a" : "#a5b287");
      text(x, r.rack, X + 20, b.y + 2, P.lcdInk);
      text(x, String(r.nodes), X + 72, b.y + 2, P.lcdInk);
      text(x, `${r.kw.toFixed(1)} kW`, X + 112, b.y + 2, P.lcdInk);
      for (let k = 0; k < Math.round(r.kw * 4); k++) rect(x, X + 160 + k * 3, b.y + 3, 2, 6, P.lcdInk);
      if (f) text(x, "▸", X + 12, b.y + 2, P.lcdInk);
    });
    wrap(this.msg, this.win ? 220 : 166).slice(0, 2).forEach((l, i) => text(x, l, X + 10, Y + 143 + i * 11, this.win ? P.led : P.pale));
  }
}
