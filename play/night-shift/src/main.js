// Night Shift: boot, the loop, and the game object every script talks to.
import { P, W, H, T, canvas, rect, dot, text, textWidth, lightSprite, coneSprite, hash } from "./gfx.js";
import { Input, buzz } from "./input.js";
import { Audio } from "./audio.js";
import { World, hitbox, camera } from "./world.js";
import { MAPS } from "./content/maps.js";
import { Actor, LOOKS, humanFrames, mopeFrames } from "./content/people.js";
import { Dialogue, Choice, Note, Toasts, Pager, EndCard, Buttons, key, box } from "./ui.js";
import { clockText } from "./content/data.js";
import * as STORY from "./story.js";

const KEY = "nightshift:v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

class Game {
  constructor() {
    this.screen = document.getElementById("screen");
    this.x = this.screen.getContext("2d");
    this.x.imageSmoothingEnabled = false;
    [this.lc, this.lx] = canvas(W, H);
    this.input = new Input(this.screen, document.querySelector(".deck"));
    const saved = load();
    this.settings = { sound: true, speed: 1, flashing: !matchMedia("(prefers-reduced-motion: reduce)").matches, ...saved.settings };
    this.meta = { endings: [], ...saved.meta };
    this.saved = saved.run || null;
    this.audio = new Audio(this.settings.sound);
    this.story = STORY;
    this.overlays = []; this.toasts = new Toasts(); this.fx = [];
    this.t = 0; this.fadeA = 1; this.fadeTo = 0; this.fadeSpeed = 1.5; this.shakeT = 0; this.busy = 0;
    this.frames = { you: humanFrames(LOOKS.you), youBadge: humanFrames(LOOKS.you, true), ray: humanFrames(LOOKS.ray), mope: mopeFrames() };
    this.player = new Actor(this.frames.you, 0, 0, "up", { speed: 62, isPlayer: true });
    this.npcs = []; this.trail = [];
    this.live = document.getElementById("live");
    this.state = STORY.newState();
    this.mode = "title";
    this.enter("exterior", 14, 8, "up", true);
    this.title = new Title(this);
    this.cam = { x: 80, y: 0 };
    this.stepT = 0; this.saveT = 0;
    if (location.search.includes("debug")) window.NS = this;
  }

  get flags() { return this.state.flags; }
  get minute() { return this.state.minute; }
  clock() { return clockText(this.state.minute); }
  announce(s) { if (this.live) this.live.textContent = s; }

  // ---- saving ----
  save() {
    if (this.mode !== "play") return;
    const s = this.state;
    s.map = this.world.id; s.x = this.player.x; s.y = this.player.y; s.dir = this.player.dir;
    try { localStorage.setItem(KEY, JSON.stringify({ run: s, meta: this.meta, settings: this.settings })); } catch {}
  }
  saveSettings() { try { const d = load(); localStorage.setItem(KEY, JSON.stringify({ ...d, settings: this.settings, meta: this.meta })); } catch {} }
  playTime() { const m = Math.round((this.state.played || 0) / 60); return m < 1 ? "under a minute" : `${m} minute${m === 1 ? "" : "s"}`; }

  // ---- starting ----
  async begin(cont) {
    this.audio.unlock();
    this.audio.stopMusic();
    await this.fade(1, 2.5);
    this.overlays = []; this.busy = 0;
    if (cont && this.saved) {
      this.state = this.saved;
      this.mode = "play";
      this.enter(this.state.map, 0, 0, this.state.dir);
      this.player.x = this.state.x; this.player.y = this.state.y;
      this.placeFollower();
      this.snapCam();
      document.body.classList.add("playing");
      await this.fade(0, 1.5);
      this.toast(`${this.clock()}. ${this.world.def.name}.`);
    } else {
      this.state = STORY.newState();
      this.mode = "play";
      document.body.classList.add("playing");
      this.enter("exterior", 6, 11, "right");
      this.snapCam();
      this.run(STORY.intro);
    }
  }
  newShift() {
    this.saved = null;
    try { const d = load(); delete d.run; localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
    this.begin(false);
  }
  confirmRestart() {
    this.run(async (g) => {
      const i = await g.choose(["Keep playing", "Restart the shift"]);
      if (i === 1) g.newShift();
    });
  }

  // ---- rooms ----
  enter(id, tx, ty, dir = "down", quiet = false) {
    const def = MAPS[id];
    this.world = new World(id, def, this);
    for (const e of this.world.ents) {
      const s = STORY.props[e.id];
      if (typeof s === "function") e.use = s;
      else if (typeof s === "string") e.look = s;
      else if (s) Object.assign(e, s);
    }
    this.player.x = tx * T + 8; this.player.y = ty * T + 11; this.player.dir = dir;
    this.player.path = null; this.player.moving = false; this.player.onArrive = null;
    this.player.frames = this.flags?.badge ? this.frames.youBadge : this.frames.you;
    this.npcs = STORY.npcs(this, id);
    this.follower = null;
    this.placeFollower();
    this.trail = [];
    if (!quiet) {
      this.state.map = id;
      this.audio.bed(def.bed);
      this.snapCam();
      if (STORY.enter[id]) this.run(STORY.enter[id]);
    }
  }
  placeFollower() {
    if (!STORY.follows(this)) { this.follower = null; return; }
    const p = this.player, back = { up: [0, 14], down: [0, -14], left: [14, 0], right: [-14, 0] }[p.dir];
    this.follower = new Actor(this.frames.mope, p.x + back[0], p.y + back[1], p.dir, { speed: 70, ghost: true, id: "mope", use: STORY.talkMope });
  }
  snapCam() { this.cam = camera(this.world, this.player.x, this.player.y - 8); }

  // ---- scripting ----
  run(fn) {
    this.busy++;
    this.player.path = null; this.player.moving = false;
    return Promise.resolve().then(() => fn(this)).catch((e) => console.error(e)).finally(() => { this.busy = Math.max(0, this.busy - 1); this.save(); });
  }
  open(ov) { this.overlays.push(ov); return new Promise((r) => { ov.resolve = r; }); }
  say(who, s) { return this.open(new Dialogue(this, who, s)); }
  narrate(s) { return this.open(new Dialogue(this, "sign", s)); }
  async choose(opts, who, s) {
    const prompt = who ? new Dialogue(this, who, s) : null;
    if (prompt) { prompt.shown = prompt.full.length; }
    return this.open(new Choice(this, opts, prompt));
  }
  note(o) { this.audio.sfx("paper"); return this.open(new Note(this, o)); }
  puzzle(p) { return this.open(p); }
  wait(s) { return new Promise((r) => setTimeout(r, s * 1000)); }
  fade(to, speed = 2) { this.fadeTo = to; this.fadeSpeed = speed; return new Promise((r) => { this.fadeDone = r; }); }
  shake(s = 0.3) { this.shakeT = Math.max(this.shakeT, s); buzz(40); }
  toast(s, d) { this.toasts.push(s, d); this.announce(s); }
  setClock(m) { this.state.minute = Math.max(this.state.minute, m); }
  async page(s) {
    this.state.pages.push({ at: this.clock(), text: s });
    this.state.unread = (this.state.unread || 0) + 1;
    this.audio.sfx("pager"); buzz([30, 60, 30]);
    await this.wait(0.5);
    await this.say("pager", s);
    this.state.unread = 0;
  }
  walk(a, tx, ty) {
    const path = this.world.path(Math.floor(a.x / T), Math.floor(a.y / T), tx, ty);
    a.path = path || [[tx, ty]];
    return new Promise((r) => { a.onArrive = r; });
  }
  face(a, dir) { a.dir = dir; }
  faceTo(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }
  async disk(n) {
    if (this.state.disks.includes(n)) return;
    this.state.disks.push(n);
    this.audio.sfx("pickup");
    const d = STORY.DISKS[n];
    await this.note({ title: `A:\\PIP\\LOG${n + 1}.TXT   ${d.title}`, body: d.text, style: "disk", foot: `Disk ${this.state.disks.length} of 6` });
  }
  addFx(f) { this.fx.push({ t: 0, ...f }); }

  // ---- movement ----
  blockedAt(a, x, y) {
    if (a.ghost) return false;
    if (this.world.hits(x - a.hw, y - 4, x + a.hw, y + 1)) return true;
    for (const n of this.npcs) if (n !== a && !n.hidden && !n.ghost && Math.abs(n.x - x) < 10 && Math.abs(n.y - y) < 6) return true;
    if (a !== this.player && Math.abs(this.player.x - x) < 10 && Math.abs(this.player.y - y) < 6 && !a.ghost) return true;
    return false;
  }
  moveActor(a, dx, dy, speed, dt) {
    const len = Math.hypot(dx, dy);
    if (!len) { a.moving = false; return false; }
    dx /= len; dy /= len;
    if (Math.abs(dx) > Math.abs(dy) + 0.2) a.dir = dx > 0 ? "right" : "left";
    else if (Math.abs(dy) > Math.abs(dx) + 0.2) a.dir = dy > 0 ? "down" : "up";
    else if (!((a.dir === "left" && dx < 0) || (a.dir === "right" && dx > 0) || (a.dir === "up" && dy < 0) || (a.dir === "down" && dy > 0))) a.dir = dy > 0 ? "down" : "up";
    const step = speed * dt;
    let moved = false;
    const nx = a.x + dx * step, ny = a.y + dy * step;
    if (!this.blockedAt(a, nx, a.y)) { a.x = nx; moved = true; }
    else if (Math.abs(dy) < 0.3) moved = this.nudge(a, "y", Math.sign(dx) * step, step) || moved;
    if (!this.blockedAt(a, a.x, ny)) { a.y = ny; moved = true; }
    else if (Math.abs(dx) < 0.3) moved = this.nudge(a, "x", Math.sign(dy) * step, step) || moved;
    a.moving = moved;
    if (moved) a.anim += dt * (speed / 60);
    return moved;
  }
  // Slide round corners so doorways never feel sticky.
  nudge(a, axis, push, step) {
    for (let o = 1; o <= 7; o++) for (const s of [1, -1]) {
      const px = axis === "y" ? a.x + push : a.x + s * o, py = axis === "y" ? a.y + s * o : a.y + push;
      if (!this.blockedAt(a, px, py)) {
        if (axis === "y") a.y += s * Math.min(o, step); else a.x += s * Math.min(o, step);
        return true;
      }
    }
    return false;
  }
  followPath(a, dt, speed) {
    if (!a.path) return;
    if (!a.path.length) { a.path = null; a.moving = false; const f = a.onArrive; a.onArrive = null; f?.(); return; }
    const [tx, ty] = a.path[0], gx = tx * T + 8, gy = ty * T + 11, dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { a.x = gx; a.y = gy; a.path.shift(); a.stuck = 0; return; }
    const before = [a.x, a.y];
    const s = Math.min(speed * dt, d);
    this.moveActor(a, dx, dy, s / dt, dt);
    if (Math.hypot(a.x - before[0], a.y - before[1]) < 0.05) {
      a.stuck = (a.stuck || 0) + dt;
      if (a.stuck > 0.4) { a.x = gx; a.y = gy; a.path.shift(); a.stuck = 0; if (a.isPlayer && !this.busy) { a.path = null; a.onArrive = null; a.moving = false; } }
    }
  }

  // ---- what the player can reach ----
  targets() {
    const list = [];
    for (const e of this.world.ents) if ((e.use || e.look) && this.world.shown(e)) list.push(e);
    for (const n of this.npcs) if (n.use && !n.hidden) list.push(n);
    if (this.follower?.use) list.push(this.follower);
    return list;
  }
  rectOf(e) {
    if (e instanceof Actor) return [e.x - 7, e.y - 8, e.x + 7, e.y + 3];
    if (e.wall) return [e.x, e.y, e.x + e.fw * T, e.y + T + 3];
    const [a, b, c, d] = e.hb ? hitbox(e) : [e.x, e.y, e.x + e.fw * T, e.y + e.fh * T];
    return [a - 3, b - 3, c + 3, d + 3];
  }
  facing() {
    const p = this.player, v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.dir];
    const probes = [[p.x + v[0] * 9, p.y - 2 + v[1] * 9], [p.x + v[0] * 4, p.y - 2 + v[1] * 5]];
    for (const [px, py] of probes) for (const e of this.targets()) {
      const [a, b, c, d] = this.rectOf(e);
      if (px >= a && px < c && py >= b && py < d) return e;
    }
    return null;
  }
  interact(e) {
    if (e.door && e.to && !e.locked?.(this)) return this.run((g) => g.goDoor(e));
    if (e instanceof Actor) this.faceTo(e, this.player);
    if (e.use) return this.run((g) => e.use(g, e));
    if (e.look) return this.run((g) => g.narrate(e.look));
  }

  onTap(p) {
    const pl = this.player;
    if (p.x > W - 30 && p.y < 22) return this.openPager();
    const wx = p.x + this.cam.x, wy = p.y + this.cam.y;
    let hit = null, best = -Infinity;
    for (const e of this.targets()) {
      let r;
      if (e instanceof Actor) r = [e.x - 9, e.y - 24, e.x + 9, e.y + 3];
      else if (e.wall) r = [e.x, e.y - 12, e.x + e.fw * T, e.y + T + 2];
      else { const h = e.tapH || 26; r = [e.x - 1, e.y + e.fh * T - h, e.x + e.fw * T + 1, e.y + e.fh * T + 2]; }
      if (wx >= r[0] && wx < r[2] && wy >= r[1] && wy < r[3]) { const s = e.y + (e.fh || 0) * T; if (s > best) { best = s; hit = e; } }
    }
    const ptx = Math.floor(pl.x / T), pty = Math.floor(pl.y / T);
    if (hit) {
      if (this.facing() === hit) return this.interact(hit);
      const cands = this.standTiles(hit);
      let bestPath = null;
      for (const [tx, ty] of cands) {
        if (tx === ptx && ty === pty) { bestPath = []; break; }
        const path = this.world.path(ptx, pty, tx, ty);
        if (path && (!bestPath || path.length < bestPath.length)) bestPath = path;
      }
      if (!bestPath) { this.audio.sfx("bump"); return; }
      pl.path = bestPath;
      this.addFx({ kind: "ring", x: wx, y: wy, c: P.amber });
      pl.onArrive = () => {
        const c = this.rectOf(hit), cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2;
        this.faceTo(pl, { x: cx, y: cy });
        if (hit.wall) pl.dir = "up";
        this.interact(hit);
      };
      return;
    }
    let tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (this.world.blocked(tx, ty)) {
      let found = null;
      for (let r = 1; r <= 2 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) if (!this.world.blocked(tx + dx, ty + dy)) { found = [tx + dx, ty + dy]; break; }
      if (!found) return;
      [tx, ty] = found;
    }
    const path = this.world.path(ptx, pty, tx, ty);
    if (!path) { this.audio.sfx("bump"); return; }
    pl.path = path; pl.onArrive = null;
    this.addFx({ kind: "ring", x: tx * T + 8, y: ty * T + 11, c: P.pale });
  }
  standTiles(e) {
    const out = [];
    if (e instanceof Actor) { const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T); return [[tx, ty + 1], [tx - 1, ty], [tx + 1, ty], [tx, ty - 1]].filter(([x, y]) => !this.world.blocked(x, y)); }
    const x0 = Math.floor(e.x / T), y0 = Math.floor(e.y / T), fw = e.fw || 1, fh = e.fh || 1;
    if (e.wall) { for (let i = 0; i < fw; i++) out.push([x0 + i, y0 + 1]); }
    else if (e.solid === false) { for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) out.push([x0 + i, y0 + j]); }
    else {
      for (let i = 0; i < fw; i++) { out.push([x0 + i, y0 + fh]); out.push([x0 + i, y0 - 1]); }
      for (let j = 0; j < fh; j++) { out.push([x0 - 1, y0 + j]); out.push([x0 + fw, y0 + j]); }
    }
    return out.filter(([x, y]) => !this.world.blocked(x, y));
  }
  openPager(tab = 0) { if (this.busy || this.overlays.length) return; this.audio.sfx("tick"); this.run((g) => g.open(new Pager(g, tab))); }

  // ---- the loop ----
  update(dt) {
    this.t += dt;
    const inp = this.input;
    inp.poll();
    if (inp.tap || inp.pressed.a) this.audio.unlock();
    if (this.fadeA !== this.fadeTo) {
      const d = this.fadeTo - this.fadeA, s = this.fadeSpeed * dt;
      this.fadeA = Math.abs(d) <= s ? this.fadeTo : this.fadeA + Math.sign(d) * s;
      if (this.fadeA === this.fadeTo) { const r = this.fadeDone; this.fadeDone = null; r?.(); }
    } else if (this.fadeDone) { const r = this.fadeDone; this.fadeDone = null; r(); }
    if (this.mode === "title") { this.title.update(dt, inp); this.tickWorld(dt); inp.endFrame(); return; }
    const top = this.overlays[this.overlays.length - 1];
    if (top) {
      top.update(dt, inp);
      if (top.done) { this.overlays.splice(this.overlays.indexOf(top), 1); top.resolve?.(top.result); }
    } else if (this.mode === "play" && !this.busy && this.fadeA < 0.5) this.control(dt);
    this.tickWorld(dt);
    if (this.mode === "play" && !this.overlays.length) this.state.played = (this.state.played || 0) + dt;
    this.saveT += dt;
    if (this.saveT > 8 && !this.busy) { this.saveT = 0; this.save(); }
    inp.endFrame();
  }

  control(dt) {
    const inp = this.input, p = this.player, d = inp.dir;
    const speed = p.speed * (inp.held.run || inp.held.b ? 1.55 : 1) * (this.state.coffee > 0 ? 1.3 : 1);
    if (d.x || d.y) { p.path = null; p.onArrive = null; this.moveActor(p, d.x, d.y, speed, dt); }
    else if (!p.path) p.moving = false;
    if (p.path) this.followPath(p, dt, speed);
    if (inp.pressed.a) { const e = this.facing(); if (e) { p.path = null; this.interact(e); return; } }
    if (inp.pressed.menu) { this.openPager(); return; }
    if (inp.tap) this.onTap(inp.tap);
    this.checkTiles();
  }

  checkTiles() {
    const p = this.player, tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    for (const e of this.world.ents) {
      if (!this.world.shown(e)) continue;
      const x0 = e.x / T, y0 = e.y / T;
      const inside = tx >= x0 && tx < x0 + (e.fw || 1) && ty >= y0 && ty < y0 + (e.fh || 1);
      if (!inside) continue;
      if (e.door && e.to && !e.locked?.(this)) return this.run((g) => g.goDoor(e));
      if (e.pickup) return this.run((g) => (e.k === "coin" ? STORY.coin(g, e) : g.disk(e.n)));
      if (e.trigger && STORY.step[e.id] && !this.flags[`step:${e.id}`]) return this.run((g) => STORY.step[e.id](g, e));
    }
  }
  async goDoor(e) {
    this.audio.sfx(e.reader ? "badge" : "door");
    await this.fade(1, 5);
    this.enter(e.to, e.spawn[0], e.spawn[1], e.face);
    await this.fade(0, 4);
  }

  tickWorld(dt) {
    const p = this.player;
    if (this.busy && p.path) this.followPath(p, dt, p.speed);
    for (const n of this.npcs) { if (n.path) this.followPath(n, dt, n.speed); else { n.moving = false; STORY.think?.(this, n, dt); } }
    const f = this.follower;
    if (f) {
      if (p.moving) { this.trail.push([p.x, p.y, p.dir]); if (this.trail.length > 60) this.trail.shift(); }
      const tgt = this.trail[Math.max(0, this.trail.length - 14)];
      if (f.path) this.followPath(f, dt, f.speed);
      else if (tgt && Math.hypot(tgt[0] - f.x, tgt[1] - f.y) > 2 && Math.hypot(p.x - f.x, p.y - f.y) > 13) this.moveActor(f, tgt[0] - f.x, tgt[1] - f.y, Math.min(90, p.speed * 1.2), dt);
      else f.moving = false;
    }
    if (p.moving && this.mode === "play") {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.29; const c = this.world.ch(Math.floor(p.x / T), Math.floor(p.y / T)); this.audio.sfx("step", (this.world.def.floors || {})[c] || "lino"); }
    }
    if (this.state.coffee > 0) this.state.coffee -= dt;
    if (this.flags.alarm && (this.world.id === "hallB" || this.world.id === "corridor" || this.world.id === "cooling")) {
      this.alarmT = (this.alarmT || 0) - dt;
      if (this.alarmT <= 0) { this.alarmT = 3; this.audio.sfx("alarm"); }
    }
    if (this.flags.dawning) { this.dawn = Math.min(1, (this.dawn || 0) + dt / 16); }
    if (this.shakeT > 0) this.shakeT -= dt;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.life || 0.5));
    this.toasts.update(dt);
    if (this.mode === "play") {
      const tgt = camera(this.world, p.x, p.y - 8);
      this.cam.x += (tgt.x - this.cam.x) * Math.min(1, dt * 8);
      this.cam.y += (tgt.y - this.cam.y) * Math.min(1, dt * 8);
      if (Math.abs(tgt.x - this.cam.x) < 0.5) this.cam.x = tgt.x;
      if (Math.abs(tgt.y - this.cam.y) < 0.5) this.cam.y = tgt.y;
    }
  }

  // ---- drawing ----
  render() {
    const x = this.x, t = this.t;
    rect(x, 0, 0, W, H, P.ink);
    const sh = this.shakeT > 0 && this.settings.flashing ? [Math.round((hash(Math.floor(t * 60)) - 0.5) * 4), Math.round((hash(Math.floor(t * 60), 1) - 0.5) * 3)] : [0, 0];
    const cam = { x: Math.round(this.cam.x) + sh[0], y: Math.round(this.cam.y) + sh[1] };
    const actors = this.mode === "play" ? [this.player, ...this.npcs, ...(this.follower ? [this.follower] : [])] : this.npcs;
    this.world.draw(x, cam, actors.filter((a) => !a.hidden), t);
    this.lighting(cam);
    this.world.glow(x, cam, t);
    this.weather(cam);
    if (this.mode === "play") {
      if (!this.busy && !this.overlays.length) this.prompt(cam);
      for (const f of this.fx) if (f.kind === "ring") {
        const r = 2 + f.t * 14, a = 1 - f.t / 0.5;
        x.globalAlpha = Math.max(0, a);
        for (let k = 0; k < 16; k++) { const an = (k / 16) * Math.PI * 2; dot(x, f.x - cam.x + Math.cos(an) * r, f.y - cam.y + Math.sin(an) * r * 0.5, f.c); }
        x.globalAlpha = 1;
      }
      this.hud();
    }
    if (this.mode === "title") this.title.draw(x);
    for (const o of this.overlays) o.draw(x);
    this.toasts.draw(x);
    if (this.fadeA > 0) { x.globalAlpha = this.fadeA; rect(x, 0, 0, W, H, P.ink); x.globalAlpha = 1; }
    if (this.paused) { rect(x, 0, 0, W, H, "rgba(7,9,15,.7)"); text(x, "Paused", W / 2, H / 2 - 4, P.white, { align: "center" }); }
  }

  lighting(cam) {
    const def = this.world.def, lx = this.lx;
    let amb = def.ambient || "#303848";
    if (this.world.id === "roof") amb = mixHex("#3a4258", "#c8b4a8", this.dawn || 0);
    lx.globalCompositeOperation = "source-over";
    lx.globalAlpha = 1;
    rect(lx, 0, 0, W, H, amb);
    lx.globalCompositeOperation = "lighter";
    const put = (l) => {
      const s = lightSprite(l.r, l.c);
      lx.globalAlpha = l.a ?? 1;
      lx.drawImage(s, Math.round(l.x - cam.x - l.r), Math.round(l.y - cam.y - l.r));
    };
    for (const l of this.world.lights(this.t)) put(l);
    if (this.flags.alarm && (this.world.id === "hallB" || this.world.id === "cooling" || this.world.id === "corridor")) {
      const k = this.settings.flashing ? (Math.sin(this.t * 5) + 1) / 2 : 0.5;
      lx.globalAlpha = 0.25 + k * 0.45;
      rect(lx, 0, 0, W, H, "#6a1216");
    }
    const p = this.player;
    if (this.mode === "play" && def.lamp !== false && !p.hidden) {
      const off = { up: [0, -16], down: [0, -4], left: [-4, -12], right: [4, -12] }[p.dir];
      lx.globalAlpha = 1;
      const c = coneSprite(p.dir, 78, "#7a6644");
      lx.drawImage(c, Math.round(p.x + off[0] - cam.x - 70), Math.round(p.y + off[1] - cam.y - 70));
      put({ x: p.x, y: p.y - 8, r: 34, c: "#40382a" });
    }
    if (this.follower) put({ x: this.follower.x, y: this.follower.y - 4, r: 12, c: "#3a2c10" });
    for (const n of this.npcs) if (n.glowR) put({ x: n.x, y: n.y - 6, r: n.glowR, c: n.glowC });
    if (this.world.id === "roof" && (this.dawn || 0) > 0.35) put({ x: 230, y: 70, r: 120, c: "#5a3a20", a: Math.min(1, (this.dawn - 0.35) * 2) });
    lx.globalAlpha = 1;
    lx.globalCompositeOperation = "source-over";
    const x = this.x;
    x.globalCompositeOperation = "multiply";
    x.drawImage(this.lc, 0, 0);
    x.globalCompositeOperation = "source-over";
  }

  weather(cam) {
    const x = this.x, t = this.t, def = this.world.def;
    if (def.rain) {
      for (let i = 0; i < 90; i++) {
        const sp = 170 + hash(i, 2) * 60, px = ((hash(i, 1) * 400 + t * 40 - cam.x * 0.3) % 360) - 20, py = ((hash(i, 3) * 200 + t * sp) % 200) - 10;
        x.fillStyle = hash(i, 4) > 0.5 ? "rgba(140,170,210,.45)" : "rgba(110,140,180,.3)";
        x.fillRect(Math.round(px), Math.round(py), 1, 4);
        x.fillRect(Math.round(px) + 1, Math.round(py) + 3, 1, 2);
      }
      for (let i = 0; i < 14; i++) {
        const k = (t * 3 + hash(i, 9)) % 1, sx = Math.floor(hash(i, Math.floor(t * 3 + hash(i, 9))) * this.world.pw) - cam.x, sy = 7 * T + Math.floor(hash(Math.floor(t * 3 + hash(i, 9)), i) * 7 * T) - cam.y;
        if (k < 0.3) { dot(x, sx - 1, sy, "rgba(160,190,225,.6)"); dot(x, sx + 1, sy, "rgba(160,190,225,.6)"); dot(x, sx, sy - 1, "rgba(160,190,225,.4)"); }
      }
    }
    if (def.dust) {
      for (let i = 0; i < 26; i++) {
        const px = (hash(i, 1) * this.world.pw + Math.sin(t * 0.3 + i) * 10) - cam.x, py = (hash(i, 2) * 100 + 20 + ((t * 3 + i * 7) % 60)) - cam.y;
        const near = Math.hypot(px + cam.x - 96, py + cam.y - 40) < 60 || Math.hypot(px + cam.x - this.player.x, py + cam.y - this.player.y) < 40;
        if (near) dot(x, px, py, hash(i, 5) > 0.5 ? "rgba(200,230,190,.5)" : "rgba(220,220,210,.35)");
      }
    }
  }

  prompt(cam) {
    const e = this.facing();
    if (!e) return;
    let px, py;
    if (e instanceof Actor) { px = e.x; py = e.y - 26; }
    else if (e.wall) { px = e.x + e.fw * 8; py = e.y - 14; }
    else { px = e.x + e.fw * 8; py = e.y + e.fh * T - (e.tapH || 26) - 6; }
    const b = Math.floor(this.t * 3) % 2;
    text(this.x, "▾", Math.round(px - cam.x - 2), Math.round(py - cam.y + b), P.amber, { shadow: P.ink });
  }

  hud() {
    const x = this.x;
    box(x, 4, 4, 36, 13, { fill: "rgba(10,14,23,.85)", edge: "#2b3342", hi: "rgba(10,14,23,.85)" });
    text(x, this.clock(), 9, 7, P.lcd);
    const bx = W - 26, by = 4;
    box(x, bx, by, 22, 13, { fill: "rgba(10,14,23,.85)", edge: "#2b3342", hi: "rgba(10,14,23,.85)" });
    rect(x, bx + 4, by + 3, 14, 7, "#454b58"); rect(x, bx + 5, by + 4, 9, 5, P.lcd); rect(x, bx + 15, by + 5, 2, 3, "#2b2f38");
    if (this.state.unread && Math.floor(this.t * 2) % 2) rect(x, bx + 18, by + 1, 3, 3, P.red);
    if (this.state.coffee > 0) {
      rect(x, 44, 7, 5, 7, "#d9d2c2"); rect(x, 45, 8, 3, 2, "#6b4128"); rect(x, 49, 9, 1, 3, "#d9d2c2");
      rect(x, 52, 10, Math.ceil((this.state.coffee / 90) * 20), 2, P.amber);
    }
  }
}

function mixHex(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), c = (s) => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// ---- Title screen, drawn over the car park in the rain ----
class Title {
  constructor(g) {
    this.g = g; this.t = 0;
    this.build();
  }
  build() {
    const g = this.g, has = !!g.saved;
    const list = has ? [{ id: "cont", label: "Continue shift" }, { id: "new", label: "New shift" }] : [{ id: "new", label: "Start shift" }];
    this.btn = new Buttons(list.map((b, i) => ({ ...b, x: 206, y: 126 + i * 19, w: 96, h: 16 })));
  }
  update(dt, inp) {
    this.t += dt;
    const g = this.g;
    if (g.overlays.length) {
      const top = g.overlays[g.overlays.length - 1];
      top.update(dt, inp);
      if (top.done) { g.overlays.pop(); top.resolve?.(top.result); }
      return;
    }
    if (this.t < 0.6 || g.fadeA > 0.4 || this.going) return;
    const b = this.btn.update(inp, g);
    if (!b) return;
    g.audio.unlock();
    if (b.id === "cont") { this.going = true; g.begin(true); }
    if (b.id === "new") {
      if (g.saved) {
        g.open(new Choice(g, ["Keep my shift", "Start over"])).then((i) => { if (i === 1) { this.going = true; g.newShift(); } });
        return;
      }
      this.going = true; g.begin(false);
    }
  }
  draw(x) {
    const g = this.g, t = this.t;
    rect(x, 0, 104, W, 76, "rgba(7,9,15,.55)");
    for (let j = 0; j < 12; j++) rect(x, 0, 92 + j, W, 1, `rgba(7,9,15,${(j / 12) * 0.55})`);
    // The wordmark: plain type, with the i's dots lit like rack LEDs.
    const X = 16, Y = 118, word = "Night Shift";
    text(x, word, X + 1, Y + 1, P.ink, { scale: 3 });
    text(x, word, X, Y, "#dfe7ee", { scale: 3 });
    [...word].forEach((ch, i) => {
      if (ch !== "i") return;
      const px = X + (i ? textWidth(word.slice(0, i)) + 1 : 0) * 3;
      rect(x, px, Y, 3, 3, Math.floor(t * 1.3 + i) % 4 ? P.led : P.ledDark);
    });
    text(x, "Something is using the cluster,", X, Y + 32, P.pale);
    text(x, "17 minutes at a time.", X, Y + 43, P.pale);
    this.btn.list.forEach((b, i) => key(x, b, i === this.btn.focus));
    const n = g.meta.endings.length, hy = 128 + this.btn.list.length * 19;
    text(x, n ? `Endings found: ${n} of 3` : "Headphones help.", 254, hy, "#6c7a8c", { align: "center" });
  }
}

const STEP_ = 1 / 60;
// ---- Boot: fit the canvas to whole device pixels, then run ----
const g = new Game();
function fit() {
  const stage = document.querySelector(".stage"), r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.floor(Math.min((r.width * dpr) / W, (r.height * dpr) / H)));
  const w = (W * k) / dpr, h = (H * k) / dpr;
  const fill = Math.min(r.width / W, r.height / H);
  // On small screens a whole-pixel scale can waste a lot of room; allow a fractional fill there.
  const useFill = (W * k) / dpr < r.width * 0.78 && fill * W > w;
  g.screen.style.width = `${useFill ? Math.floor(W * fill) : w}px`;
  g.screen.style.height = `${useFill ? Math.floor(H * fill) : h}px`;
}
addEventListener("resize", fit);
new ResizeObserver(fit).observe(document.querySelector(".stage"));
fit();
document.addEventListener("visibilitychange", () => {
  g.paused = document.hidden;
  g.audio.suspend(document.hidden);
  if (document.hidden) g.save();
});
addEventListener("pagehide", () => g.save());
document.getElementById("fs")?.addEventListener("click", () => {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {});
});

// ?debug: expose the game, and let tests step time by hand (background tabs throttle frames).
if (location.search.includes("debug")) {
  window.adv = (s = 0) => { g.manual = true; g.paused = false; for (let i = 0; i < s * 60; i++) g.update(STEP_); g.render(); return [g.t.toFixed(1), g.mode, g.world.id, g.busy, g.overlays.map((o) => o.constructor.name)]; };
  const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const pressA = async () => { g.input.press("a", "key"); adv(1 / 60); g.input.release("a", "key"); adv(1 / 30); await sleep(); };
  // Plays through whatever the story puts up: dialogue, choices (from the list), puzzles (solved, or stop at one).
  window.drive = async (choices = [], stopAt = null, max = 600) => {
    const log = [];
    for (let i = 0; i < max; i++) {
      await sleep(); adv(0.05); await sleep();
      const top = g.overlays[g.overlays.length - 1];
      if (!top) { if (!g.busy) break; continue; }
      const n = top.constructor.name;
      if (n === "Dialogue" || n === "Note") { if (n === "Dialogue") log.push(`${top.who}: ${top.pages.flat().join(" ").slice(0, 70)}`); else log.push(`NOTE ${top.title}`); await pressA(); await pressA(); }
      else if (n === "Choice") { const c = choices.length ? choices.shift() : 0; log.push(`CHOICE ${top.opts[c]}`); top.btn.focus = c; await pressA(); }
      else { log.push(`PUZZLE ${n}`); if (stopAt === n || n === "EndCard") break; if (n === "Terminal") { top.run("ps"); top.close(); } else if (n === "Pager") top.done = true; else { top.done = true; top.result = true; } }
    }
    return log;
  };
  window.use = async (id, choices, stopAt) => {
    const e = g.world.ents.find((e) => e.id === id) || g.npcs.find((n) => n.id === id) || (g.follower?.id === id ? g.follower : null);
    if (!e) return `no ${id}`;
    g.interact(e);
    return drive(choices, stopAt);
  };
  window.go = async (tx, ty) => {
    g.run((g) => g.walk(g.player, tx, ty));
    for (let i = 0; i < 400; i++) { adv(0.1); await sleep(); if (!g.busy) break; }
    for (let i = 0; i < 20; i++) { adv(0.1); await sleep(); }
    return [Math.floor(g.player.x / 16), Math.floor(g.player.y / 16), g.world.id, g.busy, g.overlays.map((o) => o.constructor.name)];
  };
  window.warp = (id, tx, ty, flags = {}) => { g.mode = "play"; Object.assign(g.state.flags, flags); g.overlays = []; g.fadeA = 0; g.fadeTo = 0; g.enter(id, tx, ty, "down"); g.snapCam(); return adv(0.2); };
}
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  if (g.manual) return requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!g.paused) while (acc >= STEP) { g.update(STEP); acc -= STEP; }
  else acc = 0;
  g.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
