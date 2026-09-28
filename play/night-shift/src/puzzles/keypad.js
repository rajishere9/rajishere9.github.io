// A four-digit keypad, used by locker 4 and the Room 0 door.
import { P, W, rect, text } from "../gfx.js";
import { Buttons, box, key } from "../ui.js";

export class Keypad {
  constructor(g, { title, code, note }) {
    this.g = g; this.title = title; this.code = code; this.note = note;
    this.entry = ""; this.flash = 0; this.state = null; this.t = 0;
    this.X = Math.round((W - 156) / 2); this.Y = 10;
    const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
    this.btn = new Buttons(labels.map((l, i) => ({ id: l, label: l, x: this.X + 33 + (i % 3) * 31, y: this.Y + 56 + Math.floor(i / 3) * 24, w: 28, h: 21 })));
    this.btn.focus = 4;
    g.input.typing = "digits";
  }
  close(result) { this.done = true; this.result = result; this.g.input.typing = false; }
  press(k) {
    const g = this.g;
    if (this.state) return;
    if (k === "C" || k === "\b") { this.entry = this.entry.slice(0, -1); g.audio.sfx("key"); return; }
    if (k === "OK" || k === "\n") {
      if (this.entry === this.code) { this.state = "open"; this.flash = 0.8; g.audio.sfx("ok"); }
      else { this.state = "denied"; this.flash = 0.9; g.audio.sfx("err"); g.shake(0.2); }
      return;
    }
    if (this.entry.length < 4) { this.entry += k; g.audio.sfx("key"); }
    if (this.entry.length === 4 && k !== "OK") setTimeout(() => this.press("OK"), 220);
  }
  update(dt, inp) {
    this.t += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) { if (this.state === "open") return this.close(true); this.state = null; this.entry = ""; }
      return;
    }
    if (inp.pressed.b) return this.close(false);
    for (const ch of inp.typed) this.press(ch);
    const b = this.btn.update(inp, this.g);
    if (b) this.press(b.id);
  }
  draw(x) {
    const { X, Y } = this;
    rect(x, 0, 0, 320, 180, "rgba(7,9,15,.6)");
    box(x, X, Y, 156, 160, { fill: "#232833", edge: "#4a5264", hi: "#2f3542" });
    text(x, this.title, X + 78, Y + 7, P.pale, { align: "center" });
    rect(x, X + 32, Y + 22, 92, 26, "#0a0f0a");
    const col = this.state === "denied" ? P.red : this.state === "open" ? P.led : P.amber;
    if (this.state) text(x, this.state === "open" ? "OPEN" : "DENIED", X + 78, Y + 31, col, { align: "center" });
    else for (let i = 0; i < 4; i++) {
      const cx = X + 43 + i * 21;
      rect(x, cx, Y + 41, 14, 1, "#3a2a10");
      if (this.entry[i]) text(x, this.entry[i], cx + 7, Y + 29, col, { align: "center", scale: 1 });
      else if (i === this.entry.length && Math.floor(this.t * 2) % 2) rect(x, cx, Y + 40, 14, 2, P.amberDark);
    }
    this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus, { fill: b.id === "OK" ? "#2c4a36" : b.id === "C" ? "#4a2c2e" : "#2b3140" }));
    if (this.note) text(x, this.note, X + 78, Y + 150, "#6c7a8c", { align: "center" });
  }
}
