// Palette, canvases, the bitmap font, auto-outlined sprites and dithered light.
export const W = 320, H = 180, T = 16;

export const P = {
  ink: "#07090f", floor: "#141a26", slate: "#1f2838", slate2: "#2e3a4f", steel: "#46566e", steel2: "#6f819a",
  pale: "#a9b8c9", white: "#e8eef2", led: "#37d67a", ledDark: "#1f7a4a", amber: "#ffb347", amberDark: "#b86a2a",
  red: "#e5484d", cold: "#4fb3ff", skin: "#f2c9a0", skinDark: "#8a5a3c",
  phosphor: "#9dff7a", dawn: "#ff8f6b", lcd: "#b8c49a", lcdInk: "#28331f",
};

export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export const rect = (x, px, py, w, h, c) => { x.fillStyle = c; x.fillRect(px | 0, py | 0, w, h); };
export const dot = (x, px, py, c) => { x.fillStyle = c; x.fillRect(px | 0, py | 0, 1, 1); };

export function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

// Draw with fn, then ring every opaque shape with a 1px outline, like hand-inked pixel art.
export function sprite(w, h, fn, outline = P.ink) {
  const [c, x] = canvas(w, h);
  fn(x);
  if (outline) outlineCanvas(c, x, outline);
  return c;
}

export function outlineCanvas(c, x, color) {
  const w = c.width, h = c.height, img = x.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
  const [r, g, b] = hexRGB(color);
  const a = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (a(i, j)) continue;
    if (a(i - 1, j) || a(i + 1, j) || a(i, j - 1) || a(i, j + 1)) {
      const k = (j * w + i) * 4; out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = 255;
    }
  }
  x.putImageData(new ImageData(out, w, h), 0, 0);
}

export function flipX(src) {
  const [c, x] = canvas(src.width, src.height);
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return c;
}

// Deterministic noise so tiles and props look hand-varied but never shimmer.
export function hash(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- Bitmap font: cap height 7, x-height 5, descenders 2 ----
const G = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.", D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.####", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: "###|.#.|.#.|.#.|.#.|.#.|###", J: "....#|....#|....#|....#|#...#|#...#|.###.",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.", P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.", V: "#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#", X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  a: ".....|.....|.###.|....#|.####|#...#|.####", b: "#....|#....|####.|#...#|#...#|#...#|####.",
  c: "....|....|.###|#...|#...|#...|.###", d: "....#|....#|.####|#...#|#...#|#...#|.####",
  e: ".....|.....|.###.|#...#|#####|#....|.###.", f: "..##|.#..|####|.#..|.#..|.#..|.#..",
  g: ".....|.....|.####|#...#|#...#|#...#|.####|....#|.###.", h: "#....|#....|####.|#...#|#...#|#...#|#...#",
  i: "#|.|#|#|#|#|#", j: "..#|...|..#|..#|..#|..#|..#|..#|##.",
  k: "#...|#...|#..#|#.#.|##..|#.#.|#..#", l: "#.|#.|#.|#.|#.|#.|.#",
  m: ".....|.....|####.|#.#.#|#.#.#|#.#.#|#.#.#", n: ".....|.....|####.|#...#|#...#|#...#|#...#",
  o: ".....|.....|.###.|#...#|#...#|#...#|.###.", p: ".....|.....|####.|#...#|#...#|#...#|####.|#....|#....",
  q: ".....|.....|.####|#...#|#...#|#...#|.####|....#|....#", r: "....|....|#.##|##..|#...|#...|#...",
  s: "....|....|.###|#...|.##.|...#|###.", t: ".#..|.#..|####|.#..|.#..|.#..|..##",
  u: ".....|.....|#...#|#...#|#...#|#...#|.####", v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..",
  w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.", x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
  y: ".....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.", z: ".....|.....|#####|...#.|..#..|.#...|#####",
  0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", 1: ".#.|##.|.#.|.#.|.#.|.#.|###",
  2: ".###.|#...#|....#|...#.|..#..|.#...|#####", 3: "####.|....#|....#|.###.|....#|....#|####.",
  4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", 5: "#####|#....|####.|....#|....#|#...#|.###.",
  6: ".###.|#....|#....|####.|#...#|#...#|.###.", 7: "#####|....#|...#.|..#..|..#..|..#..|..#..",
  8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.", 9: ".###.|#...#|#...#|.####|....#|....#|.###.",
  ".": ".|.|.|.|.|.|#", ",": ".|.|.|.|.|.|#|#", "!": "#|#|#|#|#|.|#", "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
  "'": "#|#", '"': "#.#|#.#", ":": ".|.|#|.|.|#", ";": ".|.|#|.|.|#|#", "-": "...|...|...|###",
  "+": "...|...|.#.|###|.#.", "(": ".#|#.|#.|#.|#.|#.|.#", ")": "#.|.#|.#|.#|.#|.#|#.",
  "/": "..#|..#|.#.|.#.|.#.|#..|#..", "\\": "#..|#..|.#.|.#.|.#.|..#|..#", "_": "....|....|....|....|....|....|....|####",
  "=": "...|...|...|###|...|###", "*": "...|...|#.#|.#.|#.#", "#": ".....|.#.#.|#####|.#.#.|#####|.#.#.",
  "%": "##..#|##.#.|...#.|..#..|.#...|.#.##|#..##", "&": ".##..|#..#.|.##..|.#...|#.#.#|#..#.|.##.#",
  "<": "...|..#|.#.|#..|.#.|..#", ">": "...|#..|.#.|..#|.#.|#..", "@": ".###.|#...#|#.###|#.#.#|#.###|#....|.###.",
  "$": "..#..|.####|#.#..|.###.|..#.#|####.|..#..", "[": "##|#.|#.|#.|#.|#.|##", "]": "##|.#|.#|.#|.#|.#|##",
  "~": ".....|.....|.##.#|#.##.", "|": "#|#|#|#|#|#|#", "^": ".#.|#.#", "♥": ".....|.#.#.|#####|#####|.###.|..#..",
  "▸": "...|#..|##.|###|##.|#..", "▾": ".....|.....|#####|.###.|..#..",
};
const FONT = {};
for (const [ch, s] of Object.entries(G)) {
  if (!s) continue;
  const rows = s.split("|"), w = Math.max(...rows.map((r) => r.replace(/\.+$/, "").length), 1);
  FONT[ch] = { rows, w };
}
export const LINE = 11;
const atlases = new Map();
function atlas(color) {
  if (atlases.has(color)) return atlases.get(color);
  const chars = Object.keys(FONT), [c, x] = canvas(chars.length * 6, 9), map = {};
  x.fillStyle = color;
  chars.forEach((ch, i) => {
    const g = FONT[ch]; map[ch] = { sx: i * 6, w: g.w };
    g.rows.forEach((r, j) => { for (let k = 0; k < r.length; k++) if (r[k] === "#") x.fillRect(i * 6 + k, j, 1, 1); });
  });
  const a = { c, map }; atlases.set(color, a); return a;
}
const adv = (ch) => (ch === " " ? 4 : (FONT[ch]?.w ?? 4) + 1);
export const textWidth = (s) => Math.max(0, [...s].reduce((n, ch) => n + adv(ch), 0) - 1);

export function text(x, s, px, py, color = P.white, { shadow = null, scale = 1, align = "left" } = {}) {
  if (align !== "left") px -= (align === "center" ? textWidth(s) / 2 : textWidth(s)) * scale;
  px = Math.round(px); py = Math.round(py);
  if (shadow) text(x, s, px + scale, py + scale, shadow, { scale });
  const a = atlas(color);
  let cx = px;
  for (const ch of s) {
    const g = a.map[ch];
    if (g) x.drawImage(a.c, g.sx, 0, g.w, 9, cx, py, g.w * scale, 9 * scale);
    cx += adv(ch) * scale;
  }
  return cx;
}

export function wrap(s, maxW) {
  const out = [];
  for (const para of s.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const t = line ? `${line} ${word}` : word;
      if (textWidth(t) > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

// ---- Light: radial and cone falloffs, quantised with a Bayer matrix so light bands like pixel art ----
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const lights = new Map();
function ditherSprite(w, h, color, f) {
  const [c, x] = canvas(w, h), img = x.createImageData(w, h), [r, g, b] = hexRGB(color);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = f(i, j);
    if (v <= 0) continue;
    const q = Math.min(4, Math.floor(v * 4 + BAYER[(j & 3) * 4 + (i & 3)] / 16)) / 4;
    if (q <= 0) continue;
    const k = (j * w + i) * 4;
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = q * 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
export function lightSprite(r, color) {
  const key = `${r}${color}`;
  if (!lights.has(key)) lights.set(key, ditherSprite(r * 2, r * 2, color, (i, j) => {
    const d = Math.hypot(i + 0.5 - r, j + 0.5 - r) / r;
    return d >= 1 ? 0 : Math.pow(1 - d, 1.4);
  }));
  return lights.get(key);
}
const DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
export function coneSprite(dir, r, color) {
  const key = `cone${dir}${r}${color}`;
  if (!lights.has(key)) {
    const [dx, dy] = DIRS[dir];
    lights.set(key, ditherSprite(r * 2, r * 2, color, (i, j) => {
      const x = i + 0.5 - r, y = j + 0.5 - r, d = Math.hypot(x, y);
      if (d < 1) return 1;
      const cos = (x * dx + y * dy) / d, edge = (cos - 0.72) / 0.28;
      if (edge <= 0 || d > r) return 0;
      return Math.pow(1 - d / r, 0.9) * Math.min(1, edge * 1.6);
    }));
  }
  return lights.get(key);
}
