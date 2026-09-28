// Every sound is synthesised: no files. Ambience beds per room, effects, voices and three short cues.
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor(on = true) { this.on = on; this.ctx = null; this.bedName = null; this.song = null; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.9 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.fx = c.createGain(); this.fx.gain.value = 0.55; this.fx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = 0.32; this.mus.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const b = this.bedName; this.bedName = null;
    if (b) this.bed(b);
    if (this.pendingSong) { this.music(this.pendingSong); this.pendingSong = null; }
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); }
  suspend(v) { if (!this.ctx) return; v ? this.ctx.suspend() : this.ctx.resume(); }

  // ---- building blocks ----
  tone(f, dur, { type = "square", vol = 0.2, at = 0, slide = 0, attack = 0.004, out = this.fx, detune = 0 } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  hiss(dur, { f = 1200, q = 1, type = "bandpass", vol = 0.2, at = 0, sweep = 0, out = this.fx } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f + sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  sfx(name, v = 1) {
    if (!this.ctx) return;
    const T = this.tone.bind(this), Z = this.hiss.bind(this);
    switch (name) {
      case "tick": T(1400, 0.03, { vol: 0.05 * v }); break;
      case "select": T(880, 0.05, { vol: 0.08 }); T(1320, 0.06, { vol: 0.07, at: 0.04 }); break;
      case "back": T(700, 0.05, { vol: 0.07 }); T(470, 0.07, { vol: 0.06, at: 0.04 }); break;
      case "pager": for (let i = 0; i < 3; i++) T(2093, 0.07, { vol: 0.07, at: i * 0.11 }); break;
      case "door": Z(0.35, { f: 500, sweep: -300, vol: 0.18 }); T(90, 0.2, { type: "sine", vol: 0.3, at: 0.25 }); break;
      case "badge": T(988, 0.07, { type: "sine", vol: 0.16 }); T(1480, 0.1, { type: "sine", vol: 0.16, at: 0.08 }); break;
      case "deny": T(180, 0.12, { vol: 0.12 }); T(180, 0.14, { vol: 0.12, at: 0.16 }); break;
      case "key": T(1046, 0.06, { vol: 0.08 }); break;
      case "ok": [0, 4, 7, 12].forEach((s, i) => T(N(76 + s), 0.12, { type: "triangle", vol: 0.14, at: i * 0.06 })); break;
      case "err": T(160, 0.18, { vol: 0.12 }); T(150, 0.2, { vol: 0.12, at: 0.2 }); break;
      case "valve": Z(0.25, { f: 420, q: 6, vol: 0.3 }); T(240, 0.3, { type: "triangle", vol: 0.2, slide: -60 }); T(1800, 0.15, { type: "sine", vol: 0.03, slide: 400, at: 0.05 }); break;
      case "stuck": T(110, 0.25, { vol: 0.16 }); Z(0.2, { f: 300, q: 8, vol: 0.25 }); break;
      case "alarm": for (let i = 0; i < 6; i++) T(i % 2 ? 560 : 740, 0.24, { vol: 0.06, at: i * 0.25, attack: 0.02 }); break;
      case "reboot": for (let i = 0; i < 10; i++) Z(0.03, { f: 3000, q: 4, vol: 0.3, at: i * 0.12 }); T(900, 1.2, { type: "sine", vol: 0.1, slide: -820 }); break;
      case "boot": T(80, 1.6, { type: "sawtooth", vol: 0.05, slide: 200, attack: 0.5 }); break;
      case "pickup": [72, 76, 79, 84].forEach((n, i) => T(N(n), 0.16, { type: "triangle", vol: 0.14, at: i * 0.07 })); break;
      case "coin": T(1319, 0.07, { vol: 0.08 }); T(1760, 0.2, { vol: 0.08, at: 0.07 }); break;
      case "pour": Z(1.3, { f: 900, q: 2, vol: 0.12, sweep: 900 }); T(200, 0.1, { type: "sine", vol: 0.2 }); break;
      case "can": T(300, 0.05, { vol: 0.1, type: "triangle" }); Z(0.3, { f: 5000, q: 1, vol: 0.12, at: 0.08, sweep: -3000 }); break;
      case "whoosh": Z(0.4, { f: 400, sweep: 2400, q: 0.7, vol: 0.2 }); break;
      case "paper": Z(0.15, { f: 3000, q: 0.6, vol: 0.12 }); Z(0.1, { f: 2000, q: 0.6, vol: 0.1, at: 0.12 }); break;
      case "type": Z(0.02, { f: 2500 + Math.random() * 1500, q: 3, vol: 0.12 }); break;
      case "crt": T(60, 0.6, { type: "sawtooth", vol: 0.05 }); Z(0.5, { f: 6000, q: 0.5, vol: 0.06 }); T(7800, 0.9, { type: "sine", vol: 0.012 }); break;
      case "crtoff": T(900, 0.6, { type: "sine", vol: 0.1, slide: -880 }); Z(0.3, { f: 4000, vol: 0.05 }); break;
      case "bump": T(120, 0.08, { type: "triangle", vol: 0.12 }); break;
      case "thud": T(70, 0.25, { type: "sine", vol: 0.35 }); Z(0.12, { f: 200, vol: 0.2 }); break;
      case "step": {
        const m = { lino: [2400, 0.05], carpet: [700, 0.035], raised: [1300, 0.06], concrete: [1700, 0.05], wood: [900, 0.06], asphalt: [3200, 0.05], dusty: [1100, 0.05], gravel: [2600, 0.07] }[v] || [1800, 0.05];
        Z(0.045, { f: m[0] * (0.9 + Math.random() * 0.2), q: 1.4, vol: m[1] });
        if (v === "raised") T(140, 0.06, { type: "sine", vol: 0.05 });
        break;
      }
    }
  }

  blip(voice) {
    if (!this.ctx) return;
    const r = Math.random();
    if (voice === "you") this.tone(300 + r * 40, 0.04, { type: "triangle", vol: 0.1 });
    else if (voice === "ray") this.tone(130 + r * 20, 0.05, { vol: 0.06 });
    else if (voice === "mope") this.tone(620 + r * 320, 0.035, { vol: 0.05 });
    else if (voice === "pip") this.tone(880 + r * 200, 0.05, { type: "sine", vol: 0.1, slide: 300 });
    else if (voice === "pager") this.tone(1760, 0.025, { vol: 0.04 });
    else this.hiss(0.01, { f: 3000, vol: 0.05 });
  }

  // ---- ambience beds ----
  bed(name) {
    if (name === this.bedName) return;
    this.bedName = name;
    const c = this.ctx; if (!c) return;
    const old = this.bedNodes;
    if (old) { old.g.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => old.stop(), 1600); clearInterval(old.timer); }
    const B = { hall: [0.34, 420, 55], lobby: [0.08, 900, 60], corridor: [0.1, 600, 60], break: [0.06, 700, 60], cooling: [0.2, 260, 50], noc: [0.12, 800, 60], room0: [0.05, 1600, 50], outside: [0.22, 2600, 0], roof: [0.18, 1200, 0] }[name] || [0.1, 700, 60];
    const g = c.createGain(); g.gain.value = 0; g.connect(this.amb);
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = name === "outside" ? "highpass" : "lowpass"; f.frequency.value = B[1];
    const ng = c.createGain(); ng.gain.value = B[0];
    s.connect(f).connect(ng).connect(g); s.start();
    const nodes = [s];
    if (B[2]) {
      for (const [m, v] of [[1, 0.06], [2, 0.03]]) { const o = c.createOscillator(); o.type = "sine"; o.frequency.value = B[2] * m; const og = c.createGain(); og.gain.value = v * (name === "hall" ? 1.6 : 1); o.connect(og).connect(g); o.start(); nodes.push(o); }
    }
    if (name === "hall") { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg).connect(f.frequency); lfo.start(); nodes.push(lfo); }
    if (name === "room0") { const o = c.createOscillator(); o.frequency.value = 7600; const og = c.createGain(); og.gain.value = 0.004; o.connect(og).connect(g); o.start(); nodes.push(o); }
    g.gain.setTargetAtTime(1, c.currentTime, 0.6);
    let timer = null;
    if (name === "cooling") timer = setInterval(() => this.tone(1500 + Math.random() * 300, 0.12, { type: "sine", vol: 0.05, slide: -600, out: this.amb }), 1600);
    if (name === "outside") timer = setInterval(() => { for (let i = 0; i < 3; i++) this.hiss(0.02, { f: 4000 + Math.random() * 3000, q: 2, vol: 0.05, at: Math.random() * 0.3, out: this.amb }); }, 200);
    this.bedNodes = { g, timer, stop: () => nodes.forEach((n) => { try { n.stop(); } catch {} }) };
  }

  // ---- music: a tiny step sequencer ----
  music(name) {
    if (!this.ctx) { this.pendingSong = name; return; }
    if (this.song?.name === name) return;
    this.stopMusic();
    const song = SONGS[name];
    if (!song) return;
    const c = this.ctx, spb = 60 / song.bpm / 2;
    let step = 0, next = c.currentTime + 0.1;
    const timer = setInterval(() => {
      while (next < c.currentTime + 0.15) {
        for (const tr of song.tracks) {
          const n = tr.notes[step % tr.notes.length];
          if (n == null || n === 0) continue;
          const at = next - c.currentTime, len = (tr.len || 1) * spb;
          if (tr.inst === "pad") { this.tone(N(n), len * 1.1, { type: "sawtooth", vol: 0.035, at, attack: len * 0.4, out: this.mus, detune: -8 }); this.tone(N(n), len * 1.1, { type: "sawtooth", vol: 0.035, at, attack: len * 0.4, out: this.mus, detune: 8 }); }
          else if (tr.inst === "arp") this.tone(N(n), spb * 0.9, { type: "triangle", vol: 0.12, at, out: this.mus });
          else if (tr.inst === "bass") this.tone(N(n), len, { type: "sine", vol: 0.2, at, out: this.mus, attack: 0.02 });
          else if (tr.inst === "lead") { this.tone(N(n), len, { type: "square", vol: 0.05, at, out: this.mus, detune: -12, attack: 0.02 }); this.tone(N(n), len, { type: "square", vol: 0.04, at, out: this.mus, detune: 14, attack: 0.02 }); }
          else if (tr.inst === "bell") this.tone(N(n), len, { type: "sine", vol: 0.1, at, out: this.mus });
        }
        step++; next += spb;
        if (song.once && step >= song.once) { this.stopMusic(); return; }
      }
    }, 30);
    this.song = { name, timer };
  }
  stopMusic() { if (this.song) clearInterval(this.song.timer); this.song = null; this.pendingSong = null; }
}

const rep = (a, n) => Array.from({ length: n }, () => a).flat();
const arp = (chords) => chords.flatMap((c) => [c[0], c[1], c[2], c[1] + 12, c[2], c[1], c[0] + 12, c[2]]);
const SONGS = {
  title: {
    bpm: 72,
    tracks: [
      { inst: "arp", notes: arp([[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]) },
      { inst: "pad", len: 8, notes: [57, 0, 0, 0, 0, 0, 0, 0, 53, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0] },
      { inst: "bass", len: 4, notes: [45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  pip: {
    bpm: 84,
    tracks: [
      { inst: "lead", len: 2, notes: [76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 84, 0, 83, 79, 81, 0, 0, 0, 0, 0, 0, 0] },
      { inst: "bell", len: 3, notes: rep([64, 0, 0, 67, 0, 0, 71, 0], 4) },
      { inst: "bass", len: 6, notes: [40, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 38, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  dawn: {
    bpm: 66,
    tracks: [
      { inst: "arp", notes: arp([[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]) },
      { inst: "pad", len: 8, notes: [60, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 53, 0, 0, 0, 0, 0, 0, 0] },
      { inst: "lead", len: 4, notes: [0, 0, 0, 0, 76, 0, 0, 0, 74, 0, 0, 0, 71, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 72, 0, 0, 0] },
      { inst: "bass", len: 6, notes: [48, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
};
