// Keyboard, the on-screen deck, taps on the screen and gamepads, folded into one set of actions.
import { W, H } from "./gfx.js";

const KEYS = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Space: "a", Enter: "a", KeyZ: "a", KeyE: "a", Escape: "b", KeyX: "b", Backspace: "b", ShiftLeft: "run", ShiftRight: "run",
  Tab: "menu", KeyP: "menu", KeyM: "menu",
};
const ACTS = ["up", "down", "left", "right", "a", "b", "run", "menu"];

export class Input {
  constructor(screen, deck) {
    this.screen = screen;
    this.held = {}; this.pressed = {}; this.src = {};
    this.tap = null; this.drag = null; this.hover = null;
    this.typing = false; this.typed = [];
    this.mode = document.documentElement.classList.contains("touch") ? "touch" : "keys";
    for (const a of ACTS) { this.held[a] = false; this.pressed[a] = false; }

    addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.("a, button, input, textarea, select") && !this.typing) return;
      this.mode = "keys";
      if (this.typing === "digits" && (/^[0-9]$/.test(e.key) || e.key === "Backspace" || e.key === "Enter")) {
        this.typed.push(e.key === "Backspace" ? "\b" : e.key === "Enter" ? "\n" : e.key);
        e.preventDefault();
        return;
      }
      if (this.typing === true) {
        if (e.key === "Escape") this.press("b", "key");
        else if (e.key === "Enter") this.typed.push("\n");
        else if (e.key === "Backspace") this.typed.push("\b");
        else if (e.key.length === 1) this.typed.push(e.key);
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") this.typed.push(e.key);
        e.preventDefault();
        return;
      }
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) this.press(a, "key");
    });
    addEventListener("keyup", (e) => { const a = KEYS[e.code]; if (a) this.release(a, "key"); });
    addEventListener("blur", () => { for (const a of ACTS) this.release(a, null); });

    const toGame = (e) => {
      const r = screen.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    screen.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.mode = e.pointerType === "mouse" ? "keys" : "touch";
      try { screen.setPointerCapture(e.pointerId); } catch {}
      const p = toGame(e);
      this.tap = p; this.drag = { ...p, down: true, start: p };
    });
    screen.addEventListener("pointermove", (e) => {
      const p = toGame(e);
      this.hover = e.pointerType === "mouse" ? p : null;
      if (this.drag?.down) Object.assign(this.drag, p);
    });
    const up = () => { if (this.drag) this.drag.down = false; };
    screen.addEventListener("pointerup", up);
    screen.addEventListener("pointercancel", up);
    screen.addEventListener("pointerleave", () => { this.hover = null; });

    if (deck) this.bindDeck(deck);
  }

  bindDeck(deck) {
    for (const b of deck.querySelectorAll("[data-act]")) {
      const a = b.dataset.act;
      const down = (e) => { e.preventDefault(); this.mode = "touch"; try { b.setPointerCapture(e.pointerId); } catch {} b.classList.add("on"); this.press(a, "deck"); buzz(8); };
      const off = () => { b.classList.remove("on"); this.release(a, "deck"); };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointercancel", off);
      b.addEventListener("lostpointercapture", off);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    // The pad reads the angle from its centre, so a thumb can roll between directions without lifting.
    const pad = deck.querySelector(".pad");
    if (!pad) return;
    let id = null;
    const set = (e) => {
      const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12, on = { up: dy < -dead && Math.abs(dy) > Math.abs(dx) * 0.45, down: dy > dead && Math.abs(dy) > Math.abs(dx) * 0.45, left: dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.45, right: dx > dead && Math.abs(dx) > Math.abs(dy) * 0.45 };
      for (const d of ["up", "down", "left", "right"]) {
        if (on[d] && !this.src[d]?.has("pad")) { this.press(d, "pad"); buzz(6); }
        if (!on[d]) this.release(d, "pad");
      }
      pad.dataset.dir = Object.keys(on).filter((k) => on[k]).join(" ");
    };
    pad.addEventListener("pointerdown", (e) => { e.preventDefault(); this.mode = "touch"; id = e.pointerId; try { pad.setPointerCapture(id); } catch {} set(e); });
    pad.addEventListener("pointermove", (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; pad.dataset.dir = ""; for (const d of ["up", "down", "left", "right"]) this.release(d, "pad"); };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
    pad.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  press(a, src) {
    (this.src[a] ||= new Set()).add(src);
    if (!this.held[a]) this.pressed[a] = true;
    this.held[a] = true;
  }
  release(a, src) {
    const s = this.src[a];
    if (!s) return;
    if (src) s.delete(src); else s.clear();
    if (!s.size) this.held[a] = false;
  }

  // Gamepads are polled; buttons follow the standard mapping.
  poll() {
    const pads = navigator.getGamepads?.() || [];
    for (const g of pads) {
      if (!g) continue;
      const b = (i) => g.buttons[i]?.pressed, ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const map = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, a: b(0), b: b(1), run: b(2) || b(5), menu: b(9) || b(3) };
      for (const [a, on] of Object.entries(map)) {
        if (on && !this.src[a]?.has("gp")) { this.mode = "pad"; this.press(a, "gp"); }
        if (!on) this.release(a, "gp");
      }
    }
  }

  get dir() {
    return { x: (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0), y: (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0) };
  }

  endFrame() {
    for (const a of ACTS) this.pressed[a] = false;
    this.tap = null; this.typed.length = 0;
  }
}

export function buzz(ms) { try { navigator.vibrate?.(ms); } catch {} }
