// Every object in the building. Sprites are drawn from rectangles once and cached;
// anything that glows (LEDs, screens, signs) is drawn again after the lighting pass.
import { P, T, rect, dot, sprite, canvas, text, textWidth, hash } from "../gfx.js";
import { loss, SPIKES, CHART, clockText } from "./data.js";

const S = new Map();
const still = (key, w, h, fn, outline) => { if (!S.has(key)) S.set(key, sprite(w, h, fn, outline)); return S.get(key); };
const at = (x, s, px, py, e, dx = 0, dy = 0) => x.drawImage(s, px + dx, py + e.fh * T - s.height + dy);
const blink = (t, rate, seed, duty = 0.5) => hash(seed, Math.floor(t * rate + seed * 3.7)) < duty;
const L = (x, y, r, c, a = 1) => ({ x, y, r, c, a });

// ---- Doors and triggers ----
function door(d) {
  const mat = d.style === "mat" || d.style === "side";
  if (d.style === "none") return { wall: true, solid: false, door: true };
  return {
    wall: !mat, solid: (g, e) => !!e.locked?.(g), door: true,
    draw: mat ? null : (x, px, py, e, t, g) => {
      const s = d.style || "office", locked = !!e.locked?.(g);
      if (s === "hidden") return drawHidden(x, px, py, e, t, g);
      rect(x, px + 1, py + 1, 14, 15, P.ink);
      const slab = s === "metal" ? "#4f5d73" : s === "glass" ? "#1d3350" : s === "stairs" ? "#5a4a3a" : "#56667e";
      rect(x, px + 2, py + 2, 12, 14, slab);
      rect(x, px + 2, py + 2, 12, 1, s === "glass" ? P.cold : P.steel2);
      if (s === "glass") { rect(x, px + 4, py + 4, 1, 8, "#2f5b86"); rect(x, px + 6, py + 4, 1, 4, "#2f5b86"); }
      else { rect(x, px + 4, py + 5, 8, 4, "rgba(7,9,15,.35)"); rect(x, px + 4, py + 5, 8, 1, "rgba(233,238,242,.12)"); }
      if (d.half === "l") rect(x, px + 15, py + 2, 1, 14, P.ink);
      rect(x, px + (d.half === "l" ? 12 : 3), py + 10, 1, 2, P.pale);
      if (d.reader) { rect(x, px + (d.half === "l" ? -3 : 16), py + 7, 3, 5, P.slate); }
      if (locked && s === "stairs") { rect(x, px + 3, py + 8, 10, 1, P.red); }
    },
    glow: d.reader || d.sign ? (x, px, py, e, t, g) => {
      if (d.sign) signGlow(x, px, py, d.sign);
      if (!d.reader) return;
      const ok = !e.locked?.(g);
      dot(x, px + (d.half === "l" ? -2 : 17), py + 8, ok ? P.led : blink(t, 1.5, e.x) ? P.red : "#6b2427");
    } : null,
    bake: mat ? (x, px, py) => {
      if (d.style === "side") { rect(x, px, py + 1, 16, 14, "#10141d"); rect(x, px + 2, py + 3, 12, 10, "#1a2130"); return; }
      rect(x, px + 1, py + 4, 14, 12, "#10141d"); for (let i = 2; i < 14; i += 2) rect(x, px + i, py + 6, 1, 8, "#1a2130");
    } : null,
  };
}
function signGlow(x, px, py, s) {
  const w = textWidth(s) + 6;
  rect(x, px + 8 - w / 2, py - 10, w, 10, "#0b111b");
  rect(x, px + 8 - w / 2, py - 1, w, 1, "#1b2638");
  text(x, s, px + 8, py - 9, "#8fa6c0", { align: "center" });
}

// The Room 0 door: first a poster on a blank panel, then a keypad, then an open door.
function drawHidden(x, px, py, e, t, g) {
  const f = g.flags;
  rect(x, px + 1, py + 1, 14, 15, "#28334a");
  rect(x, px + 1, py + 1, 14, 1, "#3a475d");
  if (!f.posterDown) {
    rect(x, px + 2, py + 1, 12, 14, "#d9d2c2"); rect(x, px + 2, py + 1, 12, 5, P.led);
    text(x, "♥", px + 5, py + 6, P.red);
    rect(x, px + 4, py + 12, 8, 1, "#9e978a");
    return;
  }
  if (f.room0Open) { rect(x, px + 2, py + 2, 12, 14, P.ink); rect(x, px + 3, py + 13, 10, 3, "#151b27"); return; }
  rect(x, px + 2, py + 2, 12, 14, "#3a4457"); rect(x, px + 2, py + 2, 12, 1, "#4c5870");
  rect(x, px + 11, py + 7, 3, 5, P.slate); dot(x, px + 12, py + 11, P.amber);
  text(x, "0", px + 5, py + 5, "#6b778c");
}

// ---- Hall B ----
const RACK = () => still("rack", 16, 32, (x) => {
  rect(x, 0, 0, 16, 32, P.ink);
  rect(x, 1, 1, 14, 5, P.slate2); rect(x, 1, 1, 14, 1, P.steel);
  for (let i = 3; i < 14; i += 3) rect(x, i, 3, 2, 1, P.slate);
  rect(x, 1, 6, 14, 25, "#1b2230");
  for (let u = 0; u < 8; u++) { rect(x, 2, 7 + u * 3, 12, 2, "#2a3446"); rect(x, 7, 7 + u * 3, 6, 1, "#323e52"); }
  rect(x, 1, 6, 1, 25, "#2d384b");
  rect(x, 0, 31, 16, 1, "#05070b");
}, null);
function rack(d) {
  return {
    hb: [0, 2, 16, 14],
    draw: (x, px, py, e) => at(x, RACK(), px, py, e),
    glow(x, px, py, e, t, g) {
      const top = py + 16 - 32, st = rackState(e, t, g);
      if (st === "dark") return;
      for (let u = 0; u < 8; u++) {
        const ly = top + 7 + u * 3;
        if (st === "idle") { if (u === 7) dot(x, px + 3, ly, P.amberDark); continue; }
        if (st === "boot") { dot(x, px + 3, ly, blink(t, 6, u + e.x) ? P.amber : P.amberDark); continue; }
        const seed = e.x * 13 + e.y + u;
        dot(x, px + 3, ly, P.led);
        if (blink(t, 3 + (seed % 5), seed, 0.6)) dot(x, px + 5, ly, P.led);
        if (hash(seed) > 0.82 && blink(t, 1, seed + 1, 0.7)) dot(x, px + 13, ly, P.amber);
        else if (blink(t, 9, seed + 2, 0.3)) dot(x, px + 12, ly, P.ledDark);
      }
    },
    lights(e, t, g) {
      const st = rackState(e, t, g);
      if (st === "dark") return [];
      return [L(e.x + 8, e.y + 20, 18, st === "idle" ? "#1a1408" : st === "boot" ? "#3d2a0c" : "#10331f")];
    },
  };
}
function rackState(e, t, g) {
  if (e.row === "D") return g.flags.spareNode && e.i === 3 ? "on" : "idle";
  if (e.row === "C" && g.flags.waveAt != null) {
    const dt = t - g.flags.waveAt - e.i * 0.14;
    if (dt > 0 && dt < 1.1) return "dark";
    if (dt >= 1.1 && dt < 2.6) return "boot";
  }
  return "on";
}

function pdu() {
  return {
    hb: [2, 4, 12, 12],
    draw: (x, px, py, e) => at(x, still("pdu", 16, 26, (c) => {
      rect(c, 1, 1, 14, 24, "#3a4659"); rect(c, 1, 1, 14, 2, P.steel2);
      rect(c, 3, 5, 10, 6, "#10160f");
      for (let i = 0; i < 4; i++) rect(c, 3, 13 + i * 3, 10, 2, P.slate);
      rect(c, 1, 23, 14, 2, P.slate);
    }), px, py, e),
    glow(x, px, py, e, t) {
      const top = py + 16 - 26;
      rect(x, px + 3, top + 5, 10, 6, P.lcd);
      rect(x, px + 4, top + 7, 3 + Math.floor(hash(Math.floor(t)) * 5), 1, P.lcdInk); rect(x, px + 4, top + 9, 5, 1, P.lcdInk);
      for (let i = 0; i < 4; i++) rect(x, px + 3, top + 13 + i * 3, 2 + Math.floor((hash(i, Math.floor(t)) * 0.3 + 0.6) * 8), 1, P.led);
    },
    lights: (e) => [L(e.x + 8, e.y + 10, 14, "#2a3320")],
  };
}

function decal(d) {
  return {
    solid: false, wall: false,
    bake(x, px, py) {
      if (d.letter) { text(x, d.letter, px + 3, py + 1, "#8b9bb2", { scale: 2 }); return; }
      for (let i = 0; i < (d.len || 1) * 16; i += 4) { rect(x, px + i, py + 13, 2, 2, "#b8952f"); rect(x, px + i + 2, py + 13, 2, 2, "#2b2b2b"); }
    },
  };
}

function crates() {
  return {
    hb: [1, 4, 14, 12],
    draw: (x, px, py, e) => at(x, still("crates", 16, 24, (c) => {
      rect(c, 1, 10, 14, 13, "#8a6a45"); rect(c, 1, 10, 14, 2, "#a07d52"); rect(c, 7, 12, 2, 11, "#6f5436");
      rect(c, 3, 2, 10, 8, "#94734b"); rect(c, 3, 2, 10, 2, "#aa885b"); rect(c, 5, 5, 6, 2, "#d9d2c2");
    }), px, py, e),
  };
}

function cylinders() {
  return {
    hb: [1, 6, 14, 10],
    draw: (x, px, py, e) => at(x, still("cyl", 16, 26, (c) => {
      for (const cx of [2, 9]) { rect(c, cx, 4, 5, 21, "#a8383c"); rect(c, cx, 4, 1, 21, "#c75054"); rect(c, cx + 1, 1, 3, 3, P.steel); rect(c, cx, 12, 5, 2, P.pale); }
    }), px, py, e),
  };
}

// ---- Cooling plant ----
function chiller() {
  return {
    fw: 2, fh: 1, hb: [0, 0, 32, 16],
    draw(x, px, py, e, t) {
      at(x, still("chiller", 32, 34, (c) => {
        rect(c, 1, 4, 30, 29, "#5a6980"); rect(c, 1, 4, 30, 2, P.steel2); rect(c, 1, 31, 30, 2, P.slate2);
        rect(c, 26, 6, 4, 25, "#4b5a70");
        rect(c, 4, 9, 14, 14, "#27303f");
        for (let i = 21; i < 26; i++) rect(c, i, 10, 1, 18, i % 2 ? "#4b5a70" : "#617189");
        rect(c, 6, 0, 3, 5, "#5f7d9c"); rect(c, 12, 0, 3, 5, "#9b5a4a");
        rect(c, 4, 25, 8, 3, P.slate); rect(c, 14, 25, 3, 3, P.slate);
      }), px, py, e);
      const cx = px + 11, cy = py + 16 - 34 + 16, a = t * (e.dead ? 0 : 9);
      x.strokeStyle = "#8595ab"; x.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const ang = a + (k * Math.PI * 2) / 3;
        for (let r = 1; r < 6; r++) dot(x, Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), "#8595ab");
      }
      dot(x, cx, cy, P.pale);
    },
    glow(x, px, py, e, t, g) { const on = g.flags.cooled || blink(t, 2, 4); dot(x, px + 5, py + 16 - 34 + 26, on ? P.led : P.red); rect(x, px + 15, py + 16 - 34 + 26, 1, 1, P.amber); },
    lights: (e) => [L(e.x + 6, e.y + 12, 10, "#12301c")],
  };
}

function valves() {
  return {
    wall: true, fw: 2,
    draw(x, px, py, e, t, g) {
      at(x, still("valvepanel", 32, 18, (c) => {
        rect(c, 1, 1, 30, 16, "#3a4659"); rect(c, 1, 1, 30, 1, P.steel2);
        rect(c, 3, 4, 26, 5, "#10160f");
      }), px, py - 2, e);
      const set = g.flags.valves || [2, 2, 0, 2];
      for (let i = 0; i < 4; i++) {
        const vx = px + 5 + i * 7, vy = py + 12;
        rect(x, vx - 2, vy - 1, 5, 3, "#a8383c"); dot(x, vx, vy - 2, "#a8383c"); dot(x, vx, vy + 2, "#a8383c");
        dot(x, vx, vy, "#e8eef2");
        rect(x, vx, vy + 3, 1, 3, P.steel);
        if (set[i]) dot(x, vx + 1, vy + 3, P.steel2);
      }
    },
    glow(x, px, py, e, t, g) {
      rect(x, px + 3, py + 2, 26, 5, P.lcd);
      text(x, g.flags.cooled ? "OK" : g.flags.walked ? "41C" : "21C", px + 16, py + 1, g.flags.walked && !g.flags.cooled && blink(t, 2, 1, 0.7) ? "#7a1f22" : P.lcdInk, { align: "center" });
    },
  };
}

function pipes(d) {
  return {
    wall: true, solid: false, fw: d.len || 4,
    bake(x, px, py) {
      const w = (d.len || 4) * 16;
      rect(x, px, py + 3, w, 3, "#5f7d9c"); rect(x, px, py + 3, w, 1, "#86a3c0");
      rect(x, px, py + 8, w, 3, "#9b5a4a"); rect(x, px, py + 8, w, 1, "#c07a67");
      for (let i = 6; i < w; i += 24) { rect(x, px + i, py + 2, 2, 10, P.steel); rect(x, px + i, py + 2, 2, 1, P.steel2); }
    },
  };
}

function drip() {
  return {
    solid: false,
    draw(x, px, py, e, t) {
      rect(x, px + 3, py + 9, 10, 3, "#1c2a3e"); rect(x, px + 5, py + 9, 5, 1, "#2b4262");
      const k = (t * 0.9 + e.t0) % 1.6;
      if (k < 1) dot(x, px + 8, py - 6 + Math.floor(k * k * 16), "#86a3c0");
      else if (k < 1.2) { dot(x, px + 6, py + 9, "#86a3c0"); dot(x, px + 10, py + 9, "#86a3c0"); }
    },
  };
}

function tank() {
  return {
    hb: [2, 4, 12, 12],
    draw: (x, px, py, e) => at(x, still("tank", 16, 26, (c) => {
      rect(c, 3, 3, 10, 20, "#a8383c"); rect(c, 2, 5, 12, 16, "#a8383c"); rect(c, 3, 5, 2, 16, "#c75054");
      rect(c, 6, 0, 4, 3, P.steel); rect(c, 3, 23, 3, 2, P.slate); rect(c, 10, 23, 3, 2, P.slate);
      rect(c, 5, 10, 6, 5, P.pale); rect(c, 6, 11, 4, 1, P.ink);
    }), px, py, e),
  };
}

// ---- NOC ----
function lossWall() {
  return {
    wall: true, fw: 4, solid: true,
    draw(x, px, py) { rect(x, px, py - 13, 64, 28, P.ink); rect(x, px + 1, py - 12, 62, 26, "#0a1220"); rect(x, px + 28, py + 15, 8, 1, P.slate); },
    glow(x, px, py, e, t, g) {
      const X0 = px + 3, Y0 = py - 10, w = 58, h = 22;
      rect(x, X0, Y0, w, h, "#0c1a2c");
      for (let i = 0; i < 4; i++) rect(x, X0, Y0 + 3 + i * 6, w, 1, "#13253b");
      const now = g.minute ?? 180, from = Math.max(CHART.from, now - 110), span = Math.max(1, now - from);
      let prev = null;
      for (let i = 0; i < w; i++) {
        const m = from + (i / w) * span, v = loss(m), yy = Y0 + h - 3 - Math.round((v - 2.27) / 0.09 * (h - 5));
        const c = SPIKES.some((s) => Math.abs(s - m) < 1.5) && g.flags.marked ? P.red : P.cold;
        if (prev != null) for (let k = Math.min(prev, yy); k <= Math.max(prev, yy); k++) dot(x, X0 + i, k, c);
        prev = yy;
      }
      text(x, "LARK-7", X0 + 1, Y0 + 1, "#6d93bd");
      if (blink(t, 1, 3, 0.5)) dot(x, X0 + w - 2, Y0 + 2, P.led);
    },
    lights: (e) => [L(e.x + 32, e.y + 18, 44, "#15314d")],
  };
}

function desk(d) {
  const kind = d.kind || "noc";
  return {
    fw: d.fw || 2, hb: [0, 2, (d.fw || 2) * 16, 14],
    draw(x, px, py, e) {
      at(x, still(`desk${kind}${e.fw}`, e.fw * 16, 24, (c) => {
        const w = e.fw * 16, top = kind === "security" ? "#6b5238" : "#4a5870";
        rect(c, 1, 10, w - 2, 5, top); rect(c, 1, 10, w - 2, 1, kind === "security" ? "#86694a" : P.steel2);
        rect(c, 2, 15, w - 4, 8, kind === "security" ? "#4e3b28" : "#323d50"); rect(c, 3, 16, 6, 6, kind === "security" ? "#5c4630" : "#3a475d");
        if (kind === "crt") return;
        const mons = kind === "terminal" ? [w / 2 - 7] : kind === "security" ? [4, w - 18] : [3, w - 17];
        for (const mx of mons) { rect(c, mx, 0, 14, 10, "#1b2230"); rect(c, mx + 6, 10, 2, 1, P.slate); }
        rect(c, w / 2 - 6, 12, 12, 2, "#263042");
        if (kind === "security") { rect(c, w - 30, 11, 7, 3, "#d9d2c2"); rect(c, w - 29, 11, 5, 1, "#9e978a"); }
      }), px, py, e);
    },
    glow(x, px, py, e, t, g) {
      if (kind === "crt") return;
      const w = e.fw * 16, base = py + 16 - 24;
      const mons = kind === "terminal" ? [w / 2 - 7] : kind === "security" ? [4, w - 18] : [3, w - 17];
      mons.forEach((mx, k) => {
        const X = px + mx + 1, Y = base + 1;
        if (kind === "security") {
          rect(x, X, Y, 12, 8, "#1e2a36");
          for (let i = 0; i < 12; i++) dot(x, X + i, Y + Math.floor(hash(i, Math.floor(t * 12) + k) * 8), "#3f5566");
          rect(x, X + 1, Y + 5, 4, 3, "#2c3c4a");
          if (blink(t, 1, k)) dot(x, X + 10, Y + 1, P.red);
        } else if (kind === "terminal") {
          rect(x, X, Y, 12, 8, "#07140c");
          for (let i = 0; i < 3; i++) rect(x, X + 1, Y + 1 + i * 2, 3 + Math.floor(hash(i, 9) * 8), 1, P.led);
          if (blink(t, 2, 7)) rect(x, X + 1, Y + 7, 2, 1, P.led);
        } else {
          rect(x, X, Y, 12, 8, "#0c1a2c");
          for (let i = 0; i < 12; i++) dot(x, X + i, Y + 5 - Math.floor(Math.sin(i * 0.9 + t * 2 + k) * 2), k ? P.cold : P.led);
        }
      });
    },
    lights(e) {
      const c = kind === "security" ? "#1c2530" : kind === "terminal" ? "#0f2e1a" : "#122840";
      return kind === "crt" ? [] : [L(e.x + e.fw * 8, e.y + 12, 22, c)];
    },
  };
}

function patch() {
  return {
    hb: [0, 2, 16, 14],
    draw: (x, px, py, e) => at(x, still("patch", 16, 32, (c) => {
      rect(c, 0, 0, 16, 32, P.ink); rect(c, 1, 1, 14, 5, P.slate2);
      rect(c, 1, 6, 14, 25, "#1b2230");
      for (let r = 0; r < 4; r++) { rect(c, 2, 8 + r * 6, 12, 2, "#323e52"); for (let i = 0; i < 6; i++) dot(c, 3 + i * 2, 8 + r * 6, P.ink); }
      const cols = [P.amber, P.cold, P.red, P.led, P.pale, "#c77dd6"];
      for (let i = 0; i < 6; i++) { const cx = 3 + i * 2; for (let y = 10; y < 30; y++) dot(c, cx + Math.round(Math.sin(y * 0.5 + i) * 1.2), y, cols[i]); }
    }, null), px, py, e),
  };
}

function chair(d) {
  return {
    hb: [3, 8, 10, 8],
    draw: (x, px, py, e) => at(x, still(`chair${d.face || "up"}`, 16, 18, (c) => {
      if (d.face === "down") { rect(c, 4, 2, 8, 7, "#2a3446"); rect(c, 3, 9, 10, 3, "#344157"); }
      else { rect(c, 3, 6, 10, 4, "#344157"); rect(c, 4, 1, 8, 6, "#2a3446"); }
      rect(c, 7, 12, 2, 3, P.steel); rect(c, 4, 15, 8, 1, P.steel);
    }), px, py, e),
  };
}

function drawers() {
  return {
    hb: [1, 4, 14, 12],
    draw: (x, px, py, e) => at(x, still("drawers", 16, 20, (c) => {
      rect(c, 1, 1, 14, 18, "#56667e"); rect(c, 1, 1, 14, 2, P.steel2);
      for (let i = 0; i < 3; i++) { rect(c, 2, 5 + i * 5, 12, 4, "#4b5a70"); rect(c, 6, 6 + i * 5, 4, 1, P.pale); }
    }), px, py, e),
  };
}

function windowP(d) {
  const w = (d.fw || 2) * 16;
  return {
    wall: true, fw: d.fw || 2,
    draw(x, px, py, e, t, g) {
      rect(x, px + 1, py + 2, w - 2, 11, P.ink);
      rect(x, px + 2, py + 3, w - 4, 9, g.flags.dawn ? "#2a2c48" : "#0c1424");
      for (let i = 0; i < w / 3; i++) {
        const rx = px + 2 + Math.floor(hash(i, e.x) * (w - 4)), ry = py + 3 + Math.floor(((t * 30 + hash(e.x, i) * 40) % 9));
        dot(x, rx, ry, "#284361");
      }
      rect(x, px + w / 2 - 1, py + 2, 1, 11, P.steel);
      rect(x, px + 1, py + 13, w - 2, 1, P.steel2);
      const flash = g.settings.flashing && hash(Math.floor(t * 2) + e.x) > 0.997;
      if (flash) rect(x, px + 2, py + 3, w - 4, 9, "#6d86a8");
    },
    lights: (e) => [L(e.x + w / 2, e.y + 22, 20, "#131c2e")],
  };
}

function poster(d) {
  const v = d.v || 0;
  return {
    wall: true, solid: true,
    draw: (x, px, py) => {
      const cols = [["#d9d2c2", P.cold, P.slate], ["#e7c85a", P.ink, P.red], ["#d9d2c2", P.led, P.ink], ["#c9c2ad", P.red, P.slate]][v];
      rect(x, px + 3, py + 2, 10, 11, P.ink); rect(x, px + 4, py + 3, 8, 9, cols[0]);
      rect(x, px + 5, py + 4, 6, 3, cols[1]); rect(x, px + 5, py + 8, 6, 1, cols[2]); rect(x, px + 5, py + 10, 4, 1, cols[2]);
    },
  };
}

function wallClock() {
  return {
    wall: true, solid: true,
    draw(x, px, py, e, t, g) {
      rect(x, px + 4, py + 2, 8, 8, P.ink); rect(x, px + 5, py + 3, 6, 6, "#d9d2c2");
      const m = g.minute ?? 180, a = ((m % 60) / 60) * Math.PI * 2, hA = ((m / 60) % 12 / 12) * Math.PI * 2;
      dot(x, px + 8 + Math.round(Math.sin(a) * 2), py + 6 - Math.round(Math.cos(a) * 2), P.ink);
      dot(x, px + 8 + Math.round(Math.sin(hA) * 1), py + 6 - Math.round(Math.cos(hA) * 1), P.red);
      dot(x, px + 8, py + 6, P.ink);
    },
  };
}

function extinguisher() {
  return { wall: true, solid: true, draw: (x, px, py) => { rect(x, px + 5, py + 3, 6, 10, P.ink); rect(x, px + 6, py + 4, 4, 8, "#c23a3e"); rect(x, px + 6, py + 4, 1, 8, "#e0585c"); rect(x, px + 7, py + 2, 2, 2, P.ink); } };
}

function board(d) {
  return {
    wall: true, fw: 2, solid: true,
    draw(x, px, py, e, t, g) {
      rect(x, px + 1, py, 30, 13, P.ink); rect(x, px + 2, py + 1, 28, 11, "#e4e8e4");
      if (d.kind === "cork") {
        rect(x, px + 2, py + 1, 28, 11, "#9a7248");
        [[4, 2, P.amber], [11, 3, "#d9d2c2"], [18, 2, P.cold], [24, 4, "#d9d2c2"], [7, 7, "#e7c85a"], [15, 8, "#d9d2c2"], [22, 7, P.led]].forEach(([a, b, c]) => rect(x, px + a, py + b, 5, 4, c));
        return;
      }
      // The floor plan, in marker.
      const ln = (a, b, w, h, c = "#3b6fb0") => rect(x, px + a, py + b, w, h, c);
      ln(4, 3, 22, 1); ln(4, 9, 22, 1); ln(4, 3, 1, 7); ln(25, 3, 1, 7); ln(10, 3, 1, 7); ln(17, 3, 1, 7);
      ln(13, 5, 2, 2, "#c23a3e");
      if (g.flags.sawGap) { rect(x, px + 18, py + 4, 7, 5, "rgba(229,72,77,.25)"); ln(19, 6, 5, 1, P.red); }
      ln(27, 11, 2, 1, P.red);
    },
  };
}

// ---- Break room ----
function lockers() {
  return {
    fw: 2, hb: [0, 4, 32, 12],
    draw: (x, px, py, e, t, g) => {
      at(x, still("lockers", 32, 30, (c) => {
        for (let i = 0; i < 4; i++) {
          const lx = 1 + i * 7.5 | 0;
          rect(c, lx, 1, 7, 28, i % 2 ? "#566a86" : "#5d7290"); rect(c, lx, 1, 7, 1, P.steel2);
          for (let v = 0; v < 3; v++) rect(c, lx + 2, 4 + v * 2, 3, 1, "#3f4f66");
          rect(c, lx + 5, 14, 1, 3, P.pale); rect(c, lx + 1, 27, 6, 1, P.slate);
        }
        rect(c, 1, 29, 30, 1, P.ink);
      }), px, py, e);
      if (g.flags.badge) rect(x, px + 24, py + 16 - 30 + 2, 6, 26, "#10141d");
    },
  };
}

function fridge() {
  return {
    hb: [1, 4, 14, 12],
    draw: (x, px, py, e) => at(x, still("fridge", 16, 32, (c) => {
      rect(c, 1, 1, 14, 30, "#c9d2dc"); rect(c, 1, 1, 14, 1, P.white); rect(c, 12, 1, 3, 30, "#a9b4c1");
      rect(c, 1, 11, 14, 1, "#8d98a6"); rect(c, 3, 4, 1, 5, P.steel); rect(c, 3, 14, 1, 8, P.steel);
      rect(c, 6, 15, 4, 4, "#f2d563"); rect(c, 6, 15, 4, 1, "#d1b440"); rect(c, 7, 17, 2, 1, "#6b4128");
      dot(c, 9, 5, P.red); dot(c, 6, 7, P.cold); rect(c, 2, 30, 12, 1, P.slate);
    }), px, py, e),
  };
}

function counter(d) {
  return {
    fw: 3, hb: [0, 4, 48, 12],
    draw(x, px, py, e, t) {
      at(x, still("counter", 48, 26, (c) => {
        rect(c, 1, 12, 46, 3, "#b7b2a4"); rect(c, 1, 12, 46, 1, "#d6d1c3");
        rect(c, 1, 15, 46, 10, "#6b4128"); for (let i = 1; i < 46; i += 12) { rect(c, i + 1, 16, 10, 8, "#744730"); rect(c, i + 5, 19, 2, 1, "#c8a27a"); }
        rect(c, 4, 2, 10, 10, "#1b2230"); rect(c, 5, 3, 8, 2, "#2a3446"); rect(c, 7, 8, 4, 4, "#39465c"); rect(c, 8, 10, 2, 2, "#d9d2c2");
        rect(c, 26, 4, 16, 8, "#6f819a"); rect(c, 27, 5, 10, 6, "#1b2230"); rect(c, 38, 5, 3, 6, "#56667e");
        rect(c, 18, 9, 3, 3, "#e8eef2"); rect(c, 21, 10, 1, 1, "#e8eef2");
      }), px, py, e);
      if (hash(Math.floor(t * 3)) > 0.4) dot(x, px + 19 + Math.floor(hash(Math.floor(t * 5)) * 2), py + 16 - 26 + 6 - Math.floor((t * 4) % 3), "rgba(233,238,242,.5)");
    },
    glow(x, px, py, e, t, g) {
      const top = py + 16 - 26;
      dot(x, px + 12, top + 4, g.flags.coffeeFixed ? P.led : blink(t, 1.3, 5) ? P.red : "#6b2427");
      rect(x, px + 29, top + 7, 6, 1, P.led); if (blink(t, 1, 3, 0.7)) dot(x, px + 32, top + 9, P.led);
    },
    lights: (e) => [L(e.x + 34, e.y + 6, 10, "#0d2a16")],
  };
}

function vending() {
  return {
    hb: [0, 4, 16, 12],
    draw: (x, px, py, e) => at(x, still("vend", 16, 32, (c) => {
      rect(c, 0, 0, 16, 32, P.ink); rect(c, 1, 1, 14, 30, "#8a2e33"); rect(c, 1, 1, 14, 2, "#b8454a");
      rect(c, 2, 4, 9, 20, "#1b2230"); rect(c, 12, 6, 2, 6, "#1b2230"); rect(c, 12, 14, 2, 2, "#d9b44a");
      rect(c, 2, 26, 9, 3, "#1b2230");
    }, null), px, py, e),
    glow(x, px, py, e, t) {
      const top = py + 16 - 32;
      rect(x, px + 2, top + 4, 9, 20, "#3d2f1f");
      const items = [P.red, P.cold, P.amber, P.led, P.white, P.amber];
      for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) rect(x, px + 3 + i * 3, top + 6 + r * 5, 2, 3, items[(r * 3 + i) % 6]);
      rect(x, px + 12, top + 7, 2, 1, blink(t, 0.7, 2) ? P.led : P.ledDark);
    },
    lights: (e) => [L(e.x + 8, e.y + 14, 38, "#5a3a14")],
  };
}

function couch() {
  return {
    fw: 2, hb: [0, 4, 32, 12],
    draw: (x, px, py, e) => at(x, still("couch", 32, 20, (c) => {
      rect(c, 1, 2, 30, 8, "#4a3a55"); rect(c, 1, 2, 30, 1, "#5d4a6b");
      rect(c, 1, 9, 30, 8, "#57466a"); rect(c, 15, 9, 1, 7, "#4a3a55");
      rect(c, 0, 6, 4, 12, "#4a3a55"); rect(c, 28, 6, 4, 12, "#4a3a55");
      rect(c, 2, 17, 2, 2, P.ink); rect(c, 28, 17, 2, 2, P.ink);
      rect(c, 20, 10, 6, 4, P.amberDark);
    }), px, py, e),
  };
}

function table() {
  return {
    fw: 2, hb: [2, 4, 28, 12],
    draw: (x, px, py, e) => at(x, still("table", 32, 20, (c) => {
      rect(c, 2, 4, 28, 8, "#7d5a3c"); rect(c, 2, 4, 28, 1, "#94704f"); rect(c, 2, 11, 28, 2, "#5e412a");
      rect(c, 4, 13, 2, 6, "#5e412a"); rect(c, 26, 13, 2, 6, "#5e412a");
      rect(c, 8, 5, 3, 3, P.white); rect(c, 20, 6, 5, 3, "#d9d2c2"); rect(c, 21, 6, 3, 1, "#3b6fb0");
    }), px, py, e),
  };
}

function dock() {
  return {
    solid: false,
    draw(x, px, py) { rect(x, px + 1, py + 6, 14, 9, P.ink); rect(x, px + 2, py + 7, 12, 7, "#2a3446"); rect(x, px + 3, py + 13, 10, 1, "#3a475d"); },
    glow(x, px, py, e, t, g) { if (!g.flags.mopeAway) return; dot(x, px + 8, py + 9, blink(t, 1, 2) ? P.led : P.ledDark); },
  };
}

function plant(d) {
  return {
    hb: [3, 6, 10, 10],
    draw: (x, px, py, e) => at(x, still(`plant${d.v || 0}`, 16, 24, (c) => {
      rect(c, 4, 16, 8, 7, d.v === 1 ? "#6b5238" : "#b0603a"); rect(c, 4, 16, 8, 1, d.v === 1 ? "#86694a" : "#c8764b");
      const lv = d.v === 1 ? ["#4c6b3a", "#5f8446"] : [P.ledDark, "#2d9a5c"];
      [[7, 3, 2, 13], [3, 6, 4, 3], [9, 5, 4, 3], [2, 10, 5, 3], [9, 9, 5, 3], [5, 1, 3, 3], [10, 2, 3, 3]].forEach(([a, b, w, h], i) => rect(c, a, b, w, h, lv[i % 2]));
    }), px, py, e),
  };
}

// ---- Lobby and corridor ----
function logo() {
  return {
    wall: true, fw: 4, solid: true,
    draw(x, px, py) {
      rect(x, px + 6, py - 6, 52, 14, "#1a2230");
      text(x, "KESTREL", px + 20, py - 3, "#8fa6c0");
      const b = [[0, 3], [1, 2], [2, 2], [3, 1], [4, 1], [5, 0], [2, 3], [3, 3], [4, 4], [6, 1], [7, 2]];
      for (const [i, j] of b) dot(x, px + 9 + i, py - 1 + j, P.amber);
    },
  };
}
function plaque() {
  return { wall: true, solid: true, draw: (x, px, py) => { rect(x, px + 2, py + 3, 12, 8, "#6b4b1f"); rect(x, px + 3, py + 4, 10, 6, "#c89b4a"); rect(x, px + 5, py + 6, 6, 1, "#6b4b1f"); rect(x, px + 5, py + 8, 4, 1, "#6b4b1f"); } };
}
function box() {
  return {
    hb: [1, 6, 14, 10],
    draw: (x, px, py, e) => at(x, still("box", 16, 14, (c) => {
      rect(c, 1, 3, 14, 10, "#8a6a45"); rect(c, 1, 3, 14, 2, "#a07d52"); rect(c, 3, 1, 4, 3, "#d9d2c2"); rect(c, 9, 0, 4, 4, P.cold);
      rect(c, 5, 7, 6, 3, "#d9d2c2");
    }), px, py, e),
  };
}
function gate() {
  return {
    hb: [0, 4, 16, 12],
    draw: (x, px, py, e) => at(x, still("gate", 16, 20, (c) => {
      rect(c, 1, 4, 3, 15, "#56667e"); rect(c, 12, 4, 3, 15, "#56667e"); rect(c, 1, 4, 3, 1, P.steel2); rect(c, 12, 4, 3, 1, P.steel2);
      rect(c, 4, 9, 8, 5, "rgba(79,179,255,.25)"); rect(c, 4, 9, 8, 1, "#6fa8d6");
    }), px, py, e),
    glow: (x, px, py) => dot(x, px + 2, py + 16 - 20 + 6, P.led),
  };
}
function bench() {
  return {
    fw: 2, hb: [0, 6, 32, 10],
    draw: (x, px, py, e) => at(x, still("bench", 32, 14, (c) => {
      rect(c, 1, 3, 30, 4, "#6f819a"); rect(c, 1, 3, 30, 1, P.pale); rect(c, 3, 7, 2, 6, P.slate); rect(c, 27, 7, 2, 6, P.slate);
    }), px, py, e),
  };
}
function cooler() {
  return {
    hb: [3, 6, 10, 10],
    draw: (x, px, py, e) => at(x, still("cooler", 16, 28, (c) => {
      rect(c, 4, 1, 8, 10, "#6fa8d6"); rect(c, 5, 2, 2, 8, "#9fcbee"); rect(c, 4, 11, 8, 16, "#c9d2dc"); rect(c, 4, 11, 8, 1, P.white);
      rect(c, 6, 15, 1, 2, P.red); rect(c, 9, 15, 1, 2, P.cold);
    }), px, py, e),
  };
}
function bin() {
  return { hb: [4, 8, 8, 8], draw: (x, px, py, e) => at(x, still("bin", 16, 12, (c) => { rect(c, 4, 2, 8, 9, "#3a475d"); rect(c, 3, 1, 10, 2, "#56667e"); rect(c, 6, 3, 4, 1, "#d9d2c2"); }), px, py, e) };
}

// ---- Room 0 ----
function crt() {
  return {
    fw: 2, hb: [0, 2, 32, 14],
    draw(x, px, py, e, t, g) {
      at(x, still("crtdesk", 32, 30, (c) => {
        rect(c, 1, 16, 30, 4, "#6b5238"); rect(c, 1, 16, 30, 1, "#86694a"); rect(c, 2, 20, 28, 9, "#4e3b28");
        rect(c, 7, 1, 18, 15, "#c9c2ad"); rect(c, 7, 14, 18, 2, "#a39c88"); rect(c, 12, 16, 8, 1, "#a39c88");
        rect(c, 9, 3, 14, 10, "#0f2410");
        rect(c, 3, 12, 3, 4, "#c9c2ad"); rect(c, 22, 17, 7, 2, "#c9c2ad");
      }), px, py, e);
    },
    glow(x, px, py, e, t, g) {
      if (g.flags.pipOff) return;
      const X = px + 9, Y = py + 16 - 30 + 3, gr = P.phosphor, face = g.pipFace || "idle";
      rect(x, X, Y, 14, 10, "#153a18");
      const bl = blink(t, 0.4, 2, 0.08);
      if (face === "sleep" || bl) { rect(x, X + 3, Y + 4, 2, 1, gr); rect(x, X + 9, Y + 4, 2, 1, gr); }
      else if (face === "happy") { dot(x, X + 3, Y + 4, gr); dot(x, X + 4, Y + 3, gr); dot(x, X + 5, Y + 4, gr); dot(x, X + 9, Y + 4, gr); dot(x, X + 10, Y + 3, gr); dot(x, X + 11, Y + 4, gr); }
      else { rect(x, X + 3, Y + 3, 2, 2, gr); rect(x, X + 9, Y + 3, 2, 2, gr); }
      if (g.talking === "pip" && blink(t, 8, 1)) rect(x, X + 5, Y + 7, 4, 1, gr);
      else rect(x, X + 5, Y + 7, 4, 1, face === "happy" ? gr : "#4c8a3c");
      for (let j = 0; j < 10; j += 2) rect(x, X, Y + j, 14, 1, "rgba(0,0,0,.2)");
    },
    lights: (e, t, g) => (g.flags.pipOff ? [] : [L(e.x + 16, e.y + 6, 44, "#1d4a1a"), L(e.x + 16, e.y + 4, 16, "#2d6a24")]),
  };
}
function tower(d) {
  return {
    hb: [2, 6, 12, 10],
    draw: (x, px, py, e) => at(x, still("tower", 16, 22, (c) => {
      rect(c, 3, 2, 10, 19, "#c9c2ad"); rect(c, 3, 2, 10, 1, "#ddd6c2"); rect(c, 10, 2, 3, 19, "#a39c88");
      rect(c, 4, 5, 5, 2, "#8d8674"); rect(c, 4, 8, 5, 1, "#8d8674"); rect(c, 5, 16, 2, 2, "#8d8674");
      rect(c, 3, 3, 1, 1, "#e8e2cf");
    }), px, py, e),
    glow: (x, px, py, e, t) => dot(x, px + 8, py + 16 - 22 + 18, blink(t, 4, e.x, 0.3) ? P.amber : P.led),
  };
}
function cabinet() {
  return {
    hb: [1, 4, 14, 12],
    draw: (x, px, py, e) => at(x, still("cabinet", 16, 28, (c) => {
      rect(c, 2, 1, 12, 26, "#7f8a99"); rect(c, 2, 1, 12, 1, "#a2acb9");
      for (let i = 0; i < 4; i++) { rect(c, 3, 3 + i * 6, 10, 5, "#707b8a"); rect(c, 6, 5 + i * 6, 4, 1, "#c9c2ad"); }
      rect(c, 3, 21, 10, 5, "#626c7a");
    }), px, py, e),
  };
}
function calendar() {
  return { wall: true, solid: true, draw: (x, px, py) => { rect(x, px + 3, py + 1, 10, 12, P.ink); rect(x, px + 4, py + 2, 8, 10, "#d9d2c2"); rect(x, px + 4, py + 2, 8, 3, "#c23a3e"); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) dot(x, px + 5 + i * 2, py + 7 + j * 2, "#6b6a70"); } };
}
function laptop() {
  return {
    hb: [1, 6, 14, 10],
    draw(x, px, py, e, t, g) {
      if (g.flags.laptopTaken) return at(x, still("sidetable", 16, 14, (c) => { rect(c, 1, 3, 14, 4, "#6b5238"); rect(c, 2, 7, 2, 6, "#4e3b28"); rect(c, 12, 7, 2, 6, "#4e3b28"); }), px, py, e);
      at(x, still("laptopT", 16, 18, (c) => {
        rect(c, 1, 7, 14, 4, "#6b5238"); rect(c, 2, 11, 2, 6, "#4e3b28"); rect(c, 12, 11, 2, 6, "#4e3b28");
        rect(c, 3, 1, 10, 6, "#3a3a44"); rect(c, 4, 2, 8, 4, "#1b2230"); rect(c, 2, 6, 12, 2, "#56565f");
      }), px, py, e);
    },
  };
}
function cobweb(d) {
  return {
    solid: false, wall: false,
    bake(x, px, py) {
      const f = d.flip ? -1 : 1, ox = d.flip ? px + 15 : px;
      for (let i = 0; i < 9; i++) { dot(x, ox + f * i, py + (8 - i), "rgba(200,205,210,.35)"); }
      for (let i = 0; i < 6; i++) { dot(x, ox + f * i, py + 2, "rgba(200,205,210,.3)"); dot(x, ox + f * 2, py + i, "rgba(200,205,210,.3)"); }
    },
  };
}

// ---- Pickups ----
function floppy(d) {
  return {
    solid: false, pickup: !d.hidden,
    show: (g) => !g.state.disks.includes(d.n),
    draw: d.hidden ? null : (x, px, py, e, t) => {
      const ox = px + (d.ox ?? 5), oy = py + (d.oy ?? 7);
      rect(x, ox, oy, 7, 7, P.ink); rect(x, ox + 1, oy + 1, 5, 5, ["#3b6fb0", P.red, "#d9b44a", P.led, "#c77dd6", P.pale][d.n]);
      rect(x, ox + 2, oy + 1, 3, 2, "#c9d2dc"); rect(x, ox + 2, oy + 4, 3, 2, "#e8eef2");
    },
    glow(x, px, py, e, t) {
      const k = (t * 0.6 + e.t0) % 3;
      if (k < 0.25) { const ox = px + (d.ox ?? 5), oy = py + (d.oy ?? 7); dot(x, ox + 6, oy, P.white); dot(x, ox + 7, oy - 1, "rgba(233,238,242,.6)"); dot(x, ox + 5, oy - 1, "rgba(233,238,242,.4)"); }
    },
  };
}
function coin(d) {
  return {
    solid: false, pickup: true,
    show: (g) => !g.state.coins.includes(d.n),
    draw: (x, px, py) => { rect(x, px + 6, py + 9, 4, 4, "#8a6a1f"); rect(x, px + 6, py + 9, 3, 3, "#e0b64a"); dot(x, px + 7, py + 10, "#fff2b8"); },
    glow(x, px, py, e, t) { if ((t * 0.8 + e.t0) % 2.5 < 0.2) dot(x, px + 9, py + 8, P.white); },
  };
}
function trigger(d) { return { solid: false, trigger: true, fw: d.fw || 1, fh: d.fh || 1 }; }
function spot(d) {
  return {
    solid: false, wall: false,
    lights(e, t, g) {
      let a = d.a ?? 1;
      if (d.flicker && g.settings.flashing) { const k = hash(Math.floor(t * 12)); a = hash(Math.floor(t * 0.7)) > 0.6 ? (k > 0.5 ? 0.25 : 1) : 1; }
      return [L(d.x * T + (d.ox ?? 8), d.y * T + (d.oy ?? 8), d.r || 60, d.c || "#4a5266", a)];
    },
  };
}
function blocker(d) { return { solid: true, fw: d.fw || 1, fh: d.fh || 1 }; }
function mopeDock() { return dock(); }

// ---- Outside ----
function facade() {
  return {
    wall: true, fw: 30, fh: 7, solid: true,
    draw(x, px, py, e, t, g) { x.drawImage(FACADE(), px, py); },
    glow(x, px, py, e, t, g) {
      rect(x, px + 117, py + 49, 14, 14, "#e4a24a"); rect(x, px + 117, py + 49, 14, 1, "#ffcf7a"); rect(x, px + 124, py + 49, 1, 14, "#b8742a");
      rect(x, px + 225, py + 82, 30, 30, "#6f95bb"); rect(x, px + 239, py + 82, 1, 30, "#3d5b7a");
      for (let i = 0; i < 4; i++) rect(x, px + 227 + i * 7, py + 84, 1, 26, "#8fb2d4");
      text(x, "KESTREL COMPUTE", px + 240, py + 30, "#d6e6f5", { align: "center" });
      if (blink(t, 0.8, 1, 0.4) || !g.settings.flashing) rect(x, px + 391, py + 1, 3, 3, P.red);
    },
    lights: (e, t, g) => [
      L(e.x + 240, e.y + 118, 46, "#46607c"), L(e.x + 240, e.y + 80, 30, "#3a4c62"),
      L(e.x + 124, e.y + 62, 22, "#5a3a14"), L(e.x + 392, e.y + 2, 10, blink(t, 0.8, 1, 0.4) || !g.settings.flashing ? "#7a1a1a" : "#000000"),
    ],
  };
}
const FACADE = () => {
  if (S.has("facade")) return S.get("facade");
  const [c, x] = canvas(480, 112);
  for (let j = 0; j < 40; j++) rect(x, 0, j, 480, 1, j < 14 ? "#0a0e1a" : j < 28 ? "#0d1220" : "#101729");
  for (let i = 0; i < 480; i += 2) if (hash(i, 3) > 0.5) dot(x, i, 13 + (i % 4 ? 0 : 1), "#0d1220");
  rect(x, 0, 22, 480, 90, "#252f40");
  rect(x, 0, 22, 480, 3, "#3a475d"); rect(x, 0, 25, 480, 1, P.ink);
  rect(x, 170, 27, 140, 12, "#141b27");
  for (let j = 42; j < 112; j += 18) rect(x, 0, j, 480, 1, "#1e2735");
  for (let i = 0; i < 480; i += 48) rect(x, i, 26, 1, 86, "#1e2735");
  for (let i = 20; i < 460; i += 24) {
    if (i > 200 && i < 280) continue;
    rect(x, i, 48, 16, 16, P.ink); rect(x, i + 1, 49, 14, 14, "#131b29"); rect(x, i + 1, 49, 14, 1, "#223049"); rect(x, i + 8, 49, 1, 14, "#0b1019");
  }
  rect(x, 222, 80, 36, 32, "#556478"); rect(x, 210, 72, 60, 6, "#3a475d"); rect(x, 210, 72, 60, 1, P.steel2); rect(x, 210, 77, 60, 1, P.ink);
  rect(x, 390, 4, 1, 18, P.steel); rect(x, 388, 10, 5, 1, P.steel); rect(x, 386, 16, 9, 1, P.steel); rect(x, 384, 21, 13, 2, P.slate2);
  rect(x, 420, 12, 30, 10, "#2a3446"); rect(x, 420, 12, 30, 1, "#3a475d"); rect(x, 30, 15, 22, 7, "#2a3446");
  for (let i = 0; i < 480; i += 3) { if (i > 208 && i < 272) continue; const h = 4 + Math.floor(hash(i, 7) * 5); rect(x, i, 112 - h, 3, h, hash(i, 9) > 0.5 ? "#1f4a33" : "#245a3c"); }
  S.set("facade", c);
  return c;
};

function car() {
  return {
    fw: 2, fh: 2, hb: [2, 4, 28, 26],
    draw: (x, px, py, e) => at(x, still("car", 32, 40, (c) => {
      rect(c, 3, 4, 26, 34, "#43556d"); rect(c, 2, 8, 28, 26, "#43556d");
      rect(c, 5, 6, 22, 7, "#0f1826"); rect(c, 6, 7, 8, 1, "#3d5b7a");
      rect(c, 5, 14, 22, 12, "#52667f"); rect(c, 5, 14, 22, 1, "#6c82a0");
      rect(c, 5, 27, 22, 5, "#0f1826");
      rect(c, 4, 3, 5, 2, "#d9d2c2"); rect(c, 23, 3, 5, 2, "#d9d2c2"); rect(c, 4, 36, 5, 2, "#7a1f22"); rect(c, 23, 36, 5, 2, "#7a1f22");
      rect(c, 1, 9, 2, 6, P.ink); rect(c, 29, 9, 2, 6, P.ink); rect(c, 1, 27, 2, 6, P.ink); rect(c, 29, 27, 2, 6, P.ink);
    }), px, py, e),
  };
}
function lamp() {
  return {
    hb: [6, 12, 4, 4],
    draw: (x, px, py, e) => at(x, still("lamp", 16, 56, (c) => {
      rect(c, 7, 6, 2, 49, "#3a475d"); rect(c, 4, 3, 10, 3, "#56667e"); rect(c, 6, 54, 4, 2, P.slate);
    }), px, py, e),
    glow: (x, px, py) => { rect(x, px + 5, py + 16 - 56 + 6, 8, 1, "#ffd28a"); },
    lights: (e) => [L(e.x + 9, e.y + 10, 60, "#a47c3c"), L(e.x + 9, e.y - 36, 12, "#b08a3c")],
  };
}

// ---- Roof ----
function sky() {
  return {
    wall: true, fw: 22, fh: 6, solid: true,
    // Drawn after the lighting pass: the sky is its own light.
    glow(x, px, py, e, t, g) {
      const d = g.dawn || 0, w = 352, h = 96;
      const mix = (a, b, k) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
      const bands = [["#070b18", "#3b4a7a"], ["#0a1020", "#7a6a9a"], ["#0d1528", "#c98a8a"], ["#111a30", "#f0a27a"], ["#141d34", "#ffc48a"]];
      for (let j = 0; j < h; j++) {
        const k = j / h, b = Math.min(4, Math.floor(k * 5 + hash(j, 1) * 0.3));
        rect(x, px, py + j, w, 1, mix(bands[b][0], bands[b][1], d));
      }
      if (d > 0.35) {
        const sy = py + 78 - Math.round((d - 0.35) * 40), sx = px + 230;
        x.fillStyle = "#ffe2a8"; for (let j = -7; j <= 7; j++) { const hw = Math.round(Math.sqrt(49 - j * j)); if (sy + j < py + 80) x.fillRect(sx - hw, sy + j, hw * 2, 1); }
      }
      rect(x, px, py + 78, w, 18, mix("#0a0f1a", "#3a3450", d));
      for (let i = 0; i < w; i += 1) { const hh = 2 + Math.floor(hash(i >> 3, 5) * 4); rect(x, px + i, py + 78 - hh, 1, hh, mix("#080c16", "#2c2840", d)); }
      for (const tx of [40, 90, 300]) { rect(x, px + tx, py + 58, 1, 20, mix("#1a2030", "#6a6078", d)); const a = t * 1.3 + tx; for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) { const an = a + k * 2.09; dot(x, Math.round(px + tx + Math.cos(an) * r), Math.round(py + 58 + Math.sin(an) * r), mix("#1a2030", "#6a6078", d)); } }
      rect(x, px, py + 90, w, 6, "#2a3040");
      for (let i = 0; i < w; i += 8) rect(x, px + i, py + 86, 2, 10, "#56667e");
      rect(x, px, py + 86, w, 2, P.steel2);
      if ((g.dawn || 0) < 0.6) for (const tx of [40, 90, 300]) if (blink(t, 0.5, tx, 0.5)) dot(x, px + tx, py + 57, P.red);
      if ((g.dawn || 0) < 0.4) for (let i = 0; i < 12; i++) dot(x, px + 130 + i * 7, py + 76, hash(i, 2) > 0.5 ? "#ffcf7a" : "#e4a24a");
    },
  };
}
function hvac() {
  return {
    fw: 2, hb: [0, 2, 32, 14],
    draw(x, px, py, e, t) {
      at(x, still("hvac", 32, 26, (c) => {
        rect(c, 1, 4, 30, 21, "#5a6980"); rect(c, 1, 4, 30, 2, P.steel2); rect(c, 1, 23, 30, 2, P.slate2);
        rect(c, 4, 8, 14, 13, "#27303f"); for (let i = 21; i < 29; i += 2) rect(c, i, 8, 1, 14, "#4b5a70");
      }), px, py, e);
      const cx = px + 11, cy = py + 16 - 26 + 14;
      for (let k = 0; k < 3; k++) { const a = t * 6 + (k * Math.PI * 2) / 3; for (let r = 1; r < 6; r++) dot(x, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), "#8595ab"); }
    },
  };
}
function mast() {
  return {
    hb: [5, 10, 6, 6],
    draw: (x, px, py, e) => at(x, still("mast", 16, 60, (c) => {
      rect(c, 7, 2, 2, 57, "#56667e"); for (let j = 8; j < 56; j += 8) { rect(c, 4, j, 8, 1, "#46566e"); }
      rect(c, 3, 56, 10, 3, P.slate2);
    }), px, py, e),
    glow: (x, px, py, e, t, g) => { if (blink(t, 0.8, 1, 0.4) || !g.settings.flashing) rect(x, px + 6, py + 16 - 60, 4, 3, P.red); },
  };
}

function lapPip() {
  return {
    solid: true, hb: [2, 6, 12, 8],
    draw: (x, px, py, e) => at(x, still("lap", 16, 14, (c) => {
      rect(c, 2, 1, 12, 8, "#3a3a44"); rect(c, 3, 2, 10, 6, "#0f2410"); rect(c, 1, 9, 14, 3, "#56565f"); rect(c, 2, 12, 12, 1, "#3a3a44");
    }), px, py, e),
    glow(x, px, py, e, t, g) {
      const X = px + 3, Y = py + 16 - 14 + 2, gr = P.phosphor;
      rect(x, X, Y, 10, 6, "#153a18");
      if (g.pipFace === "happy") { dot(x, X + 2, Y + 2, gr); dot(x, X + 3, Y + 1, gr); dot(x, X + 6, Y + 2, gr); dot(x, X + 7, Y + 1, gr); }
      else { dot(x, X + 2, Y + 2, gr); dot(x, X + 7, Y + 2, gr); }
      rect(x, X + 3, Y + 4, 4, 1, g.talking === "pip" && blink(t, 8, 2) ? gr : "#4c8a3c");
    },
    lights: (e) => [L(e.x + 8, e.y + 10, 20, "#1d4a1a")],
  };
}

export const PROPS = {
  lapPip,
  door, rack, pdu, decal, crates, cylinders, chiller, valves, pipes, drip, tank, lossWall, desk, patch, chair, drawers,
  window: windowP, poster, clock: wallClock, extinguisher, board, lockers, fridge, counter, vending, couch, table, dock: mopeDock,
  plant, logo, plaque, box, gate, bench, cooler, bin, crt, tower, cabinet, calendar, laptop, cobweb, floppy, coin, trigger,
  spot, blocker, facade, car, lamp, sky, hvac, mast,
};
