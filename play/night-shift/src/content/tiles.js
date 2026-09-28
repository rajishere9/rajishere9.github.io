// Floors and walls, baked once per room.
import { P, T, rect, dot, hash } from "../gfx.js";

const speck = (x, px, py, tx, ty, n, c, salt = 0) => {
  for (let i = 0; i < n; i++) dot(x, px + Math.floor(hash(tx, ty, i + salt) * 16), py + Math.floor(hash(ty, tx, i + 7 + salt) * 16), c);
};

const FLOORS = {
  // Lobby and corridor: big vinyl tiles with a grout line.
  lino(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, (tx + ty) % 2 ? "#2a3548" : P.slate2);
    rect(x, px, py, 16, 1, P.slate); rect(x, px, py, 1, 16, P.slate);
    speck(x, px, py, tx, ty, 3, "#34425a");
  },
  mat(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, P.slate);
    for (let j = 1; j < 16; j += 2) rect(x, px + 1, py + j, 14, 1, "#18202e");
    rect(x, px, py, 16, 1, P.ink); rect(x, px, py + 15, 16, 1, P.ink);
  },
  // Break room: warm planks, the one room that isn't blue.
  wood(x, px, py, tx, ty) {
    for (let j = 0; j < 4; j++) {
      const k = hash(tx, ty, j), c = k < 0.33 ? "#6b4128" : k < 0.66 ? "#744730" : "#633b24";
      rect(x, px, py + j * 4, 16, 4, c);
      rect(x, px, py + j * 4 + 3, 16, 1, "#4a2c1b");
      const seam = Math.floor(hash(ty, tx, j) * 16);
      rect(x, px + seam, py + j * 4, 1, 3, "#4a2c1b");
      if (hash(tx, j, ty) > 0.7) rect(x, px + ((seam + 6) % 14), py + j * 4 + 1, 3, 1, "#7d5037");
    }
  },
  rug(x, px, py, tx, ty, w) {
    rect(x, px, py, 16, 16, "#5a2f2a");
    for (let i = 0; i < 16; i += 4) for (let j = 0; j < 16; j += 4) dot(x, px + i + ((j / 4) % 2) * 2, py + j, "#6d3a31");
    const edge = (dx, dy) => w.ch(tx + dx, ty + dy) !== ",";
    if (edge(0, -1)) rect(x, px, py, 16, 1, P.amberDark);
    if (edge(0, 1)) rect(x, px, py + 15, 16, 1, P.amberDark);
    if (edge(-1, 0)) rect(x, px, py, 1, 16, P.amberDark);
    if (edge(1, 0)) rect(x, px + 15, py, 1, 16, P.amberDark);
  },
  // Hall B: raised floor tiles with gaps and corner pedestals.
  raised(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, P.steel);
    rect(x, px, py, 16, 1, P.slate2); rect(x, px, py, 1, 16, P.slate2);
    rect(x, px + 1, py + 15, 15, 1, "#3d4b61"); rect(x, px + 15, py + 1, 1, 15, "#3d4b61");
    rect(x, px + 1, py + 1, 14, 1, "#52637c");
    speck(x, px, py, tx, ty, 2, "#4d5d75");
  },
  perf(x, px, py) {
    rect(x, px, py, 16, 16, "#3f5673");
    rect(x, px, py, 16, 1, P.slate2); rect(x, px, py, 1, 16, P.slate2);
    for (let j = 3; j < 14; j += 2) for (let i = 3; i < 14; i += 2) dot(x, px + i, py + j, "#223044");
    rect(x, px + 1, py + 1, 14, 1, "#4d6888");
  },
  hot(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#3a4457");
    rect(x, px, py, 16, 1, P.slate2); rect(x, px, py, 1, 16, P.slate2);
    speck(x, px, py, tx, ty, 2, "#44506a");
  },
  // Plant rooms: poured concrete.
  concrete(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#343e4f");
    speck(x, px, py, tx, ty, 6, "#3b4659");
    speck(x, px, py, tx, ty, 4, "#2c3544", 20);
    if (hash(tx, ty, 99) > 0.86) { const cx = Math.floor(hash(tx, ty, 5) * 10) + 2; for (let i = 0; i < 6; i++) dot(x, px + cx + (i >> 1), py + 4 + i, "#262e3b"); }
  },
  dusty(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#3a3a44");
    rect(x, px, py, 16, 1, "#30303a"); rect(x, px, py, 1, 16, "#30303a");
    speck(x, px, py, tx, ty, 8, "#46464f");
    speck(x, px, py, tx, ty, 3, "#56555c", 40);
  },
  carpet(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#232c3d");
    for (let j = 0; j < 16; j++) for (let i = (j % 2); i < 16; i += 2) if (hash(tx * 16 + i, ty * 16 + j) > 0.6) dot(x, px + i, py + j, "#29344a");
  },
  asphalt(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#2a3140");
    speck(x, px, py, tx, ty, 7, "#323a4b");
    speck(x, px, py, tx, ty, 3, "#212734", 30);
  },
  puddle(x, px, py, tx, ty, w) {
    FLOORS.asphalt(x, px, py, tx, ty);
    const e = (dx, dy) => w.ch(tx + dx, ty + dy) === ",";
    const l = e(-1, 0) ? 0 : 3, r = e(1, 0) ? 16 : 13, t = e(0, -1) ? 0 : 4, b = e(0, 1) ? 16 : 12;
    rect(x, px + l, py + t, r - l, b - t, "#253850");
    rect(x, px + l + 2, py + t + 1, Math.max(0, r - l - 6), 1, "#2b4262");
  },
  paint(x, px, py, tx, ty) {
    FLOORS.asphalt(x, px, py, tx, ty);
    rect(x, px + 7, py, 2, 16, "#8a93a2");
    speck(x, px, py, tx, ty, 2, "#2a3140", 50);
  },
  gravel(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#3a4152");
    speck(x, px, py, tx, ty, 14, "#454d60");
    speck(x, px, py, tx, ty, 8, "#2f3544", 60);
  },
};

const FACES = {
  office(x, px, py, tx) {
    rect(x, px, py, 16, 16, "#3b4a63");
    rect(x, px, py, 16, 2, P.steel2); rect(x, px, py + 2, 16, 1, P.steel);
    rect(x, px, py + 13, 16, 3, P.slate); rect(x, px, py + 13, 16, 1, P.steel);
    if (tx % 3 === 0) rect(x, px, py + 3, 1, 10, "#35435a");
  },
  server(x, px, py, tx) {
    rect(x, px, py, 16, 16, "#2c374b");
    rect(x, px, py, 16, 2, P.steel); rect(x, px, py + 2, 16, 1, "#3a475d");
    for (let i = 3; i < 16; i += 4) rect(x, px + i, py + 3, 1, 10, "#252f40");
    rect(x, px, py + 13, 16, 3, P.slate);
  },
  concrete(x, px, py, tx, ty) {
    rect(x, px, py, 16, 16, "#495466");
    rect(x, px, py, 16, 2, "#5b677b");
    speck(x, px, py + 2, tx, ty, 5, "#414b5c");
    if (tx % 2 === 0) { dot(x, px + 3, py + 5, "#3a4352"); dot(x, px + 3, py + 11, "#3a4352"); }
    rect(x, px, py + 14, 16, 2, "#353e4d");
  },
  old(x, px, py, tx) {
    rect(x, px, py, 16, 16, "#4b4750");
    for (let i = 1; i < 16; i += 4) rect(x, px + i, py + 3, 2, 10, "#534f58");
    rect(x, px, py, 16, 2, "#5e5a63");
    rect(x, px, py + 13, 16, 3, "#34313a");
    if (tx % 5 === 2) { rect(x, px + 5, py + 3, 5, 6, "#57504f"); rect(x, px + 6, py + 9, 3, 2, "#57504f"); }
  },
  warm(x, px, py, tx) {
    rect(x, px, py, 16, 16, "#56485a");
    rect(x, px, py, 16, 2, "#6d5d6e"); rect(x, px, py + 2, 16, 1, "#4a3e4e");
    rect(x, px, py + 10, 16, 1, "#4a3e4e");
    rect(x, px, py + 13, 16, 3, "#3a2f3d");
  },
};

export function bakeTiles(x, w) {
  const floors = w.def.floors || { ".": "lino" }, face = FACES[w.def.walls || "office"];
  for (let ty = 0; ty < w.h; ty++) for (let tx = 0; tx < w.w; tx++) {
    const c = w.ch(tx, ty), px = tx * T, py = ty * T;
    if (c === " ") continue;
    if (c === "#") {
      const below = w.ch(tx, ty + 1);
      if (below !== "#" && below !== " " && ty + 1 < w.h) face(x, px, py, tx, ty);
      else cap(x, px, py, tx, ty, w);
      continue;
    }
    const f = FLOORS[floors[c] || floors["."]] || FLOORS.lino;
    if (c === "D") {
      // A doorway in a face wall is drawn by its door prop; in a bottom or side wall it's a threshold.
      if (w.isWall(tx, ty - 1) && !w.isWall(tx, ty + 1)) { face(x, px, py, tx, ty); continue; }
    }
    f(x, px, py, tx, ty, w);
    // Soft contact shadow where floor meets a face wall above.
    if (w.isWall(tx, ty - 1)) rect(x, px, py, 16, 2, "rgba(7,9,15,.35)");
    if (w.isWall(tx - 1, ty)) rect(x, px, py, 2, 16, "rgba(7,9,15,.25)");
  }
}

function cap(x, px, py, tx, ty, w) {
  rect(x, px, py, 16, 16, "#0c1018");
  const open = (dx, dy) => { const c = w.ch(tx + dx, ty + dy); return c !== "#" && c !== " "; };
  if (open(0, 1)) rect(x, px, py + 15, 16, 1, P.steel);
  if (open(0, -1)) rect(x, px, py, 16, 1, P.slate2);
  if (open(1, 0)) rect(x, px + 15, py, 1, 16, P.slate2);
  if (open(-1, 0)) rect(x, px, py, 1, 16, P.slate2);
}
