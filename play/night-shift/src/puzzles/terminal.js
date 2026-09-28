// The NOC terminal: a small shell. Type on a keyboard, or tap the suggested commands.
import { P, W, H, rect, text, textWidth, wrap } from "../gfx.js";
import { Buttons, key } from "../ui.js";
import { clockText } from "../content/data.js";

const FILES = {
  "handover.txt": "Nights: check LARK-7's loss at 04:00 and log it. If Row C runs hot, cooling plant, valve panel. Row D is the spare, leave it idle. Don't feed MOP-E. -M",
  ".bash_history": "ssh rm-0\nping pip\n# why is there a 2016 box on the network\n# asked M. she said there's no such thing as rm-0\nexit",
  "lark7/loss.log": "03:06  2.2981  spike\n03:14  2.2912\n03:23  2.2964  spike\n03:31  2.2905\n03:40  2.2949  spike",
};

export class Terminal {
  constructor(g) {
    this.g = g; this.t = 0; this.line = ""; this.hist = []; this.hi = -1;
    this.out = ["Kestrel NOC  tty2", `Last login: ${clockText((g.minute || 240) - 431)} from lobby-kiosk`, "Type help, or tap a command below.", ""];
    this.prompt = "night@noc:~$ ";
    g.input.typing = g.input.mode === "touch" ? false : true;
    this.makeChips();
  }
  chips() {
    const f = this.g.flags;
    const base = ["help", "ls", "cat handover.txt", "ps"];
    if (this.seenPs) return ["ssh rm-0", "kill 4411", "ping pip", "cat .bash_history", "exit"];
    return base.concat(["exit"]);
  }
  makeChips() {
    let x = 8;
    const list = this.chips().map((c) => { const w = textWidth(c) + 10, b = { id: c, label: c, x, y: 160, w, h: 14 }; x += w + 4; return b; });
    this.btn = new Buttons(list);
  }
  print(s) { for (const l of s.split("\n")) this.out.push(...wrap(l, 300)); }
  run(cmd) {
    const g = this.g, c = cmd.trim(), [name, ...args] = c.split(/\s+/);
    this.out.push(this.prompt + c);
    if (c) { this.hist.push(c); this.hi = -1; }
    const f = g.flags;
    switch (name) {
      case "": break;
      case "help": this.print("ls  cat <file>  ps  top  whoami  date  ping <host>  ssh <host>  kill <pid>  clear  exit"); break;
      case "ls": this.print(args[0] === "lark7" || args[0] === "lark7/" ? "checkpoints/  loss.log" : "handover.txt  lark7/  .bash_history"); break;
      case "cat": {
        const file = FILES[args[0]] ?? FILES[(args[0] || "").replace(/^\.\//, "")];
        this.print(file ?? `cat: ${args[0] || ""}: No such file`);
        break;
      }
      case "history": this.print(FILES[".bash_history"]); break;
      case "ps": case "top":
        for (const r of [["PID", "USER", "HOST", "CPU", "COMMAND"], ["1203", "lark7", "hallb-a01", "96.0%", "train --run lark-7"], ["1204", "lark7", "hallb-c04", "95.8%", "train --run lark-7"], ["3310", "root", "noc", "0.3%", "monitord"], ["4411", "pip", "rm-0", "3.1%", "pip --read --every 17m"]]) this.out.push(r);
        if (!this.seenPs) { this.seenPs = true; this.makeChips(); }
        f.foundPip = true;
        break;
      case "whoami": this.print("night"); break;
      case "date": this.print(`Thu 27 Sep 2026 ${clockText(g.minute || 240)}`); break;
      case "ping": this.print(args[0] === "pip" || args[0] === "rm-0" ? "64 bytes from rm-0: time=0.4 ms\nThat's close. That's really close." : `ping: ${args[0] || "?"}: unknown host`); break;
      case "ssh": this.print(args[0] === "rm-0" ? "ssh: connect to rm-0: no route to host\nLast seen on patch port C-08." : `ssh: ${args[0] || "?"}: unknown host`); break;
      case "kill": this.print(args[0] === "4411" ? "kill: (4411): Operation not permitted.\nThe process lives on rm-0, not here." : `kill: (${args[0] || ""}): No such process`); break;
      case "sudo": this.print("Nice try. This incident will be reported to Marguerite."); break;
      case "hello": case "hi": this.print("It's just bash. Bash doesn't talk back."); break;
      case "clear": this.out = []; break;
      case "exit": case "logout": this.close(); return;
      default: this.print(`${name}: command not found`);
    }
    this.out.push("");
  }
  close() { this.done = true; this.result = !!this.g.flags.foundPip; this.g.input.typing = false; }
  update(dt, inp) {
    this.t += dt;
    const g = this.g;
    if (inp.pressed.b) return this.close();
    for (const ch of inp.typed) {
      if (ch === "\n") { this.run(this.line); this.line = ""; if (this.done) return; }
      else if (ch === "\b") this.line = this.line.slice(0, -1);
      else if (ch === "ArrowUp" && this.hist.length) { this.hi = this.hi < 0 ? this.hist.length - 1 : Math.max(0, this.hi - 1); this.line = this.hist[this.hi]; }
      else if (ch === "ArrowDown" && this.hi >= 0) { this.hi = Math.min(this.hist.length, this.hi + 1); this.line = this.hist[this.hi] || ""; }
      else if (ch.length === 1 && this.line.length < 40) { this.line += ch; }
      g.audio.sfx("type");
    }
    const b = this.btn.update(g.input.typing === true ? { ...inp, pressed: { ...inp.pressed, a: false } } : inp, g);
    if (b) this.run(b.id);
  }
  draw(x) {
    rect(x, 0, 0, W, H, "#040a06");
    rect(x, 2, 2, W - 4, H - 4, "#061109");
    const lines = this.out.concat([this.prompt + this.line]);
    const view = lines.slice(-13);
    view.forEach((l, i) => {
      const c = i === view.length - 1 ? P.led : "#5fc98a";
      if (Array.isArray(l)) l.forEach((cell, k) => text(x, cell, 8 + [0, 30, 64, 116, 150][k], 8 + i * 11, l[1] === "pip" ? P.amber : c));
      else text(x, l, 8, 8 + i * 11, c);
    });
    const last = view.length - 1;
    if (Math.floor(this.t * 2) % 2) rect(x, 8 + textWidth(this.prompt + this.line) + 2, 8 + last * 11, 4, 8, P.led);
    rect(x, 4, 155, W - 8, 1, "#0f2a17");
    this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus, { fill: "#0c2213", ink: "#8fe0b0" }));
  }
}
