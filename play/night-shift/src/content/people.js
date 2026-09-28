// People and robots, drawn from parts so every frame stays consistent, then inked with an outline.
import { P, rect, dot, sprite, flipX, canvas } from "../gfx.js";

export const LOOKS = {
  you: { skin: P.skinDark, shade: "#6e4630", hair: "#1a1410", hairShade: "#0f0c0a", top: P.amberDark, topShade: "#8f4f1f", legs: "#34435c", shoes: "#1b2130", lamp: true, lanyard: P.red },
  ray: { skin: P.skin, shade: "#d4a57e", hair: "#6b6a70", hairShade: "#4b4a50", top: "#2f3d57", topShade: "#243047", legs: "#1d2638", shoes: P.ink, cap: true, stache: true, collar: P.pale },
};

function human(L, dir, f, badge) {
  const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? 1 : 0;
  return sprite(16, 24, (x) => {
    const b = bob;
    if (dir === "right") {
      // legs, back first
      const back = 6 - step, front = 8 + step;
      rect(x, back, 17, 2, 3, L.legs); rect(x, back, 20, 3, 2, "#141a26");
      rect(x, front, 17, 2, 3, L.legs); rect(x, front, 20, 3, 2, L.shoes);
      // torso
      rect(x, 5, 11 + b, 6, 7, L.top); rect(x, 5, 16 + b, 6, 1, L.topShade); rect(x, 5, 11 + b, 1, 6, L.topShade);
      if (L.collar) rect(x, 9, 11 + b, 2, 1, L.collar);
      // arm swings against the front leg
      const ax = 7 - step;
      rect(x, ax, 12 + b, 2, 4, L.topShade); rect(x, ax, 16 + b, 2, 1, L.skin);
      // head
      rect(x, 5, 2 + b, 7, 8, L.skin); rect(x, 4, 3 + b, 1, 6, L.hair);
      rect(x, 5, 2 + b, 7, 3, L.hair); rect(x, 5, 5 + b, 3, 4, L.hair); rect(x, 6, 9 + b, 1, 1, L.hairShade);
      rect(x, 12, 6 + b, 1, 2, L.skin);
      dot(x, 7, 6 + b, L.shade); dot(x, 10, 6 + b, P.ink); dot(x, 10, 7 + b, P.ink);
      rect(x, 8, 9 + b, 4, 1, L.shade);
      if (L.stache) rect(x, 10, 8 + b, 2, 1, L.hair);
      if (L.cap) { rect(x, 4, 1 + b, 8, 3, L.top); rect(x, 10, 3 + b, 4, 1, L.topShade); dot(x, 8, 2 + b, P.amber); }
      if (L.lamp) { rect(x, 5, 4 + b, 7, 1, P.slate); rect(x, 11, 3 + b, 2, 2, P.amber); dot(x, 12, 3 + b, P.white); }
      if (L.lanyard && badge) dot(x, 10, 13 + b, P.white);
      return;
    }
    // legs
    const ll = step === 1 ? 1 : 0, rl = step === -1 ? 1 : 0;
    rect(x, 5, 17, 3, 3 - ll, L.legs); rect(x, 5, 20 - ll, 3, 2, L.shoes);
    rect(x, 8, 17, 3, 3 - rl, L.legs); rect(x, 8, 20 - rl, 3, 2, L.shoes);
    // torso
    rect(x, 4, 11 + b, 8, 7, L.top); rect(x, 11, 11 + b, 1, 7, L.topShade); rect(x, 4, 17 + b, 8, 1, L.topShade);
    // arms swing opposite the legs
    rect(x, 2, 12 + b + ll, 2, 4, L.top); rect(x, 2, 16 + b + ll, 2, 1, L.skin);
    rect(x, 12, 12 + b + rl, 2, 4, L.topShade); rect(x, 12, 16 + b + rl, 2, 1, L.skin);
    if (dir === "down") {
      rect(x, 6, 15 + b, 4, 1, L.topShade);
      if (L.collar) { rect(x, 6, 11 + b, 4, 1, L.collar); dot(x, 7, 12 + b, L.collar); dot(x, 8, 12 + b, L.collar); }
      if (L.lanyard) { dot(x, 6, 11 + b, L.lanyard); dot(x, 9, 11 + b, L.lanyard); dot(x, 7, 12 + b, L.lanyard); dot(x, 8, 12 + b, L.lanyard); if (badge) { rect(x, 7, 13 + b, 2, 2, P.white); dot(x, 7, 13 + b, P.cold); } }
      if (L.cap) dot(x, 5, 13 + b, P.amber);
      // head
      rect(x, 4, 2 + b, 8, 9, L.skin); rect(x, 3, 3 + b, 10, 6, L.skin);
      rect(x, 4, 2 + b, 8, 3, L.hair); rect(x, 3, 3 + b, 10, 2, L.hair); rect(x, 3, 5 + b, 1, 3, L.hair); rect(x, 12, 5 + b, 1, 3, L.hair);
      rect(x, 4, 10 + b, 1, 1, L.shade); rect(x, 11, 10 + b, 1, 1, L.shade); rect(x, 5, 10 + b, 6, 1, L.shade);
      rect(x, 5, 7 + b, 1, 2, P.ink); rect(x, 10, 7 + b, 1, 2, P.ink);
      if (L.stache) rect(x, 6, 9 + b, 4, 1, L.hair);
      if (L.cap) { rect(x, 3, 1 + b, 10, 3, L.top); rect(x, 3, 4 + b, 10, 1, L.topShade); rect(x, 7, 2 + b, 2, 1, P.amber); }
      if (L.lamp) { rect(x, 3, 4 + b, 10, 1, P.slate); rect(x, 7, 3 + b, 2, 2, P.amber); dot(x, 7, 3 + b, P.white); }
    } else {
      rect(x, 6, 11 + b, 4, 2, L.topShade);
      rect(x, 4, 2 + b, 8, 9, L.hair); rect(x, 3, 3 + b, 10, 6, L.hair);
      rect(x, 4, 8 + b, 8, 2, L.hairShade); rect(x, 6, 10 + b, 4, 1, L.shade);
      if (L.cap) { rect(x, 3, 1 + b, 10, 3, L.top); rect(x, 3, 4 + b, 10, 1, L.topShade); }
      if (L.lamp) { rect(x, 3, 4 + b, 10, 1, P.slate); rect(x, 7, 4 + b, 2, 1, P.steel); }
    }
  });
}

export function humanFrames(L, badge = false) {
  const out = {};
  for (const d of ["down", "up", "right"]) out[d] = [0, 1, 2, 3].map((f) => human(L, d, f, badge));
  out.left = out.right.map(flipX);
  return out;
}

// MOP-E: a squat custodial robot with a single amber eye and a mop it drags everywhere.
function mope(dir, f) {
  const b = f % 2;
  return sprite(20, 20, (x) => {
    const back = dir === "up", side = dir === "left" || dir === "right";
    // mop trails behind
    if (!back) { rect(x, side ? 1 : 14, 12, side ? 2 : 1, 4, P.steel2); rect(x, side ? 0 : 13, 15, 5, 3, P.cold); dot(x, side ? 1 : 14, 17, "#2f7fc4"); dot(x, side ? 3 : 16, 17, "#2f7fc4"); }
    rect(x, 5, 16, 10, 2, P.ink);
    rect(x, 4, 13 + b, 12, 3, P.steel);
    rect(x, 4, 6 + b, 12, 8, P.pale); rect(x, 5, 5 + b, 10, 1, P.pale); rect(x, 6, 4 + b, 8, 1, P.pale);
    rect(x, 13, 6 + b, 3, 8, "#8d9cae"); rect(x, 4, 13 + b, 12, 1, "#8d9cae");
    rect(x, 9, 1 + b, 1, 3, P.steel2);
    if (back) {
      rect(x, 6, 7 + b, 8, 1, "#8d9cae"); rect(x, 6, 9 + b, 8, 1, "#8d9cae"); rect(x, 6, 11 + b, 8, 1, "#8d9cae");
      rect(x, 6, 12, 8, 4, P.cold); rect(x, 9, 12, 1, 4, "#2f7fc4");
    } else {
      rect(x, 5, 7 + b, 10, 3, P.ink);
      const ex = dir === "left" ? 6 : dir === "right" ? 11 : 9;
      rect(x, ex - 1, 8 + b, 3, 1, P.amber); dot(x, ex, 8 + b, P.white);
      rect(x, 7, 11 + b, 6, 1, "#8d9cae");
    }
  });
}
export function mopeFrames() {
  const out = {};
  for (const d of ["down", "up", "right"]) out[d] = [0, 1, 2, 3].map((f) => mope(d, f));
  out.left = out.right.map(flipX);
  return out;
}

// ---- Portraits for the dialogue box: 28x28 busts ----
const cache = new Map();
export function portrait(who, talk = 0, blink = false) {
  const key = `${who}${talk}${blink}`;
  if (cache.has(key)) return cache.get(key);
  let c;
  if (who === "you" || who === "ray") {
    const L = LOOKS[who];
    c = sprite(28, 28, (x) => {
      rect(x, 3, 22, 22, 6, L.top); rect(x, 3, 22, 22, 1, L.topShade); rect(x, 20, 23, 5, 5, L.topShade);
      if (L.lanyard) { rect(x, 10, 22, 1, 6, L.lanyard); rect(x, 17, 22, 1, 6, L.lanyard); }
      if (L.collar) { rect(x, 10, 22, 8, 2, L.collar); }
      rect(x, 11, 19, 6, 3, L.shade);
      rect(x, 7, 5, 14, 15, L.skin); rect(x, 6, 7, 16, 10, L.skin);
      rect(x, 7, 18, 14, 2, L.shade); rect(x, 20, 7, 2, 11, L.shade);
      rect(x, 5, 11, 1, 3, L.skin); rect(x, 22, 11, 1, 3, L.shade);
      rect(x, 7, 4, 14, 4, L.hair); rect(x, 6, 5, 16, 3, L.hair); rect(x, 6, 8, 1, 4, L.hair); rect(x, 21, 8, 1, 4, L.hair);
      const ey = 12;
      if (blink) { rect(x, 9, ey + 1, 3, 1, P.ink); rect(x, 16, ey + 1, 3, 1, P.ink); }
      else { rect(x, 10, ey, 2, 3, P.ink); rect(x, 16, ey, 2, 3, P.ink); dot(x, 10, ey, P.white); dot(x, 16, ey, P.white); }
      rect(x, 9, ey - 2, 3, 1, L.hairShade); rect(x, 16, ey - 2, 3, 1, L.hairShade);
      if (L.stache) rect(x, 11, 16, 6, 2, L.hair);
      if (talk) rect(x, 12, 17 + (L.stache ? 1 : 0), 4, 2, "#4a2323"); else rect(x, 12, 17 + (L.stache ? 1 : 0), 4, 1, L.shade);
      if (L.cap) { rect(x, 5, 2, 18, 5, L.top); rect(x, 4, 7, 20, 1, L.topShade); rect(x, 12, 3, 3, 2, P.amber); }
      if (L.lamp) { rect(x, 6, 7, 16, 1, P.slate); rect(x, 12, 5, 4, 3, P.amber); dot(x, 12, 5, P.white); }
    });
  } else if (who === "mope") {
    c = sprite(28, 28, (x) => {
      rect(x, 13, 1, 1, 4, P.steel2); rect(x, 12, 0, 3, 2, talk ? P.led : P.ledDark);
      rect(x, 5, 7, 18, 20, P.pale); rect(x, 7, 5, 14, 2, P.pale); rect(x, 19, 7, 4, 20, "#8d9cae");
      rect(x, 6, 11, 16, 6, P.ink);
      if (blink) rect(x, 11, 14, 6, 1, P.amberDark); else { rect(x, 11, 12, 6, 4, P.amber); rect(x, 12, 13, 2, 1, P.white); }
      rect(x, 9, 20, 10, 1, "#8d9cae"); if (talk) rect(x, 10, 21, 8, 2, P.steel);
    });
  } else if (who === "pip") {
    c = sprite(28, 28, (x) => {
      rect(x, 2, 3, 24, 21, "#c9c2ad"); rect(x, 2, 22, 24, 2, "#a39c88"); rect(x, 9, 24, 10, 3, "#a39c88");
      rect(x, 5, 6, 18, 14, "#0f2410");
      const g = P.phosphor;
      if (blink) { rect(x, 9, 11, 3, 1, g); rect(x, 16, 11, 3, 1, g); } else { rect(x, 9, 9, 2, 3, g); rect(x, 17, 9, 2, 3, g); }
      if (talk) { rect(x, 11, 15, 6, 1, g); rect(x, 12, 16, 4, 1, g); } else { rect(x, 10, 15, 1, 1, g); rect(x, 11, 16, 6, 1, g); rect(x, 17, 15, 1, 1, g); }
      for (let j = 6; j < 20; j += 2) rect(x, 5, j, 18, 1, "rgba(0,0,0,.25)");
      dot(x, 21, 21, P.led);
    });
  } else {
    // The pager: Marguerite only ever reaches you through it.
    c = sprite(28, 28, (x) => {
      rect(x, 3, 6, 22, 17, "#2b2f38"); rect(x, 3, 6, 22, 1, "#454b58");
      rect(x, 6, 9, 16, 7, P.lcd); rect(x, 7, 11, 9, 1, P.lcdInk); rect(x, 7, 13, 12, 1, P.lcdInk);
      rect(x, 7, 18, 4, 3, "#454b58"); rect(x, 13, 18, 4, 3, "#454b58"); rect(x, 19, 18, 3, 3, talk ? P.red : "#6b2427");
    });
  }
  cache.set(key, c);
  return c;
}

// Characters in the world: position is the point between their feet.
export class Actor {
  constructor(frames, x, y, dir = "down", opts = {}) {
    Object.assign(this, { frames, x, y, dir, moving: false, anim: 0, speed: 58, path: null, hw: 5, ...opts });
  }
  frame() { return this.frames[this.dir][this.moving ? Math.floor(this.anim * 7) % 4 : 0]; }
  drawChar(x, cam) {
    if (this.hidden) return;
    const f = this.frame(), px = Math.round(this.x - f.width / 2 - cam.x), py = Math.round(this.y - f.height + 2 - cam.y);
    x.fillStyle = "rgba(7,9,15,.45)";
    x.fillRect(Math.round(this.x - 5 - cam.x), Math.round(this.y - 1 - cam.y), 10, 2);
    x.fillRect(Math.round(this.x - 4 - cam.x), Math.round(this.y - 2 - cam.y), 8, 4);
    x.drawImage(f, px, py);
  }
}
