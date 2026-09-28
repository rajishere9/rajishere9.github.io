// A room: its baked floor and walls, its props, collision, pathfinding and drawing.
import { T, W, H, canvas } from "./gfx.js";
import { bakeTiles } from "./content/tiles.js";
import { PROPS } from "./content/props.js";

export class World {
  constructor(id, def, g) {
    this.id = id; this.def = def; this.g = g;
    this.grid = def.grid;
    this.h = def.grid.length;
    this.w = Math.max(...def.grid.map((r) => r.length));
    this.pw = this.w * T; this.ph = this.h * T;
    this.ents = [];
    for (const p of def.props || []) this.add(p);
    const [c, x] = canvas(this.pw, this.ph);
    bakeTiles(x, this);
    for (const e of this.ents) if (e.bake) e.bake(x, e.x, e.y, e);
    this.layer = c;
  }

  add(def) {
    const make = PROPS[def.k];
    if (!make) { console.warn("unknown prop", def.k); return null; }
    const e = { fw: 1, fh: 1, solid: true, ...make(def), ...def };
    e.x = def.x * T; e.y = def.y * T;
    e.t0 = Math.random() * 10;
    this.ents.push(e);
    return e;
  }
  find(id) { return this.ents.find((e) => e.id === id); }

  ch(tx, ty) { return this.grid[ty]?.[tx] ?? " "; }
  isWall(tx, ty) { const c = this.ch(tx, ty); return c === "#" || c === " "; }
  shown(e) { return !e.show || e.show(this.g, e); }
  isSolid(e) { return this.shown(e) && (typeof e.solid === "function" ? e.solid(this.g, e) : e.solid); }

  // Tile-level blocking for pathfinding.
  blocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h || this.isWall(tx, ty)) return true;
    const cx = tx * T + 8, cy = ty * T + 8;
    for (const e of this.ents) {
      if (!this.isSolid(e)) continue;
      const [x0, y0, x1, y1] = hitbox(e);
      if (cx >= x0 && cx < x1 && cy >= y0 && cy < y1) return true;
    }
    return false;
  }

  // Pixel rectangle against walls and solid props.
  hits(x0, y0, x1, y1, ignore) {
    for (let ty = Math.floor(y0 / T); ty <= Math.floor((y1 - 0.01) / T); ty++)
      for (let tx = Math.floor(x0 / T); tx <= Math.floor((x1 - 0.01) / T); tx++)
        if (this.isWall(tx, ty)) return true;
    for (const e of this.ents) {
      if (e === ignore || !this.isSolid(e)) continue;
      const [a, b, c, d] = hitbox(e);
      if (x0 < c && x1 > a && y0 < d && y1 > b) return true;
    }
    return false;
  }

  // 8-way A* over tiles, never cutting a blocked corner.
  path(sx, sy, gx, gy) {
    if (this.blocked(gx, gy)) return null;
    const key = (x, y) => y * this.w + x, open = [[sx, sy]], came = new Map(), gs = new Map([[key(sx, sy), 0]]);
    const hf = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    const fs = new Map([[key(sx, sy), hf(sx, sy)]]);
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fs.get(key(...open[i])) < fs.get(key(...open[bi]))) bi = i;
      const [x, y] = open.splice(bi, 1)[0];
      if (x === gx && y === gy) {
        const out = [[x, y]];
        let k = key(x, y);
        while (came.has(k)) { const p = came.get(k); out.unshift(p); k = key(...p); }
        return out.slice(1);
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (this.blocked(nx, ny)) continue;
        if (dx && dy && (this.blocked(x + dx, y) || this.blocked(x, y + dy))) continue;
        const ng = gs.get(key(x, y)) + (dx && dy ? 1.41 : 1), nk = key(nx, ny);
        if (ng < (gs.get(nk) ?? Infinity)) {
          came.set(nk, [x, y]); gs.set(nk, ng); fs.set(nk, ng + hf(nx, ny));
          if (!open.some(([ox, oy]) => ox === nx && oy === ny)) open.push([nx, ny]);
        }
      }
    }
    return null;
  }

  // Everything that can be drawn this frame, sorted by where it touches the floor.
  drawables(extra) {
    const list = [];
    for (const e of this.ents) if (!e.wall && e.draw && this.shown(e)) list.push(e);
    list.push(...extra);
    return list.sort((a, b) => sortY(a) - sortY(b));
  }

  draw(x, cam, extra, t) {
    x.drawImage(this.layer, -cam.x, -cam.y);
    for (const e of this.ents) if (e.wall && e.draw && this.shown(e)) e.draw(x, e.x - cam.x, e.y - cam.y, e, t, this.g);
    for (const e of this.drawables(extra)) {
      if (e.drawChar) e.drawChar(x, cam, t);
      else e.draw(x, e.x - cam.x, e.y - cam.y, e, t, this.g);
    }
    for (const e of this.ents) if (e.over && this.shown(e)) e.over(x, e.x - cam.x, e.y - cam.y, e, t, this.g);
  }

  glow(x, cam, t) {
    for (const e of this.ents) if (e.glow && this.shown(e)) e.glow(x, e.x - cam.x, e.y - cam.y, e, t, this.g);
  }

  lights(t) {
    const out = [];
    for (const e of this.ents) if (e.lights && this.shown(e)) for (const l of e.lights(e, t, this.g) || []) out.push(l);
    return out;
  }
}

export function hitbox(e) {
  if (e.hb) return [e.x + e.hb[0], e.y + e.hb[1], e.x + e.hb[0] + e.hb[2], e.y + e.hb[1] + e.hb[3]];
  return [e.x, e.y, e.x + e.fw * T, e.y + e.fh * T];
}
export const sortY = (e) => (e.drawChar ? e.y : e.y + e.fh * T + (e.sort || 0));

export function camera(world, fx, fy) {
  const cx = world.pw <= W ? Math.round((world.pw - W) / 2) : Math.round(Math.max(0, Math.min(world.pw - W, fx - W / 2)));
  const cy = world.ph <= H ? Math.round((world.ph - H) / 2) : Math.round(Math.max(0, Math.min(world.ph - H, fy - H / 2)));
  return { x: cx, y: cy };
}
