// SPDX-License-Identifier: Apache-2.0
//
// The 2D view (docs/ui-design.md, U1, U10): the TV and the computer drawn flat, the picture
// large and sharp, everything that works in 3D working here too.
//
// - The TV: its screen as wide as the keyboard at least, the picture on the tube's glass as
//   the 3D view shows it: the TV's knobs applied (js/scene/knobs.js), and the glass's own dark
//   grey-green under the picture, so that black is the colour of the lit glass, not pure black.
//   On the right the TV's panel as the 3D set's: its brightness and colour knobs (a drag up or
//   right turns one up, as does the wheel), the push button and its lamp.
// - The computer, a drawer under the TV (U10): its colours (the case's off-white, or as found,
//   yellowed), the keys as the 3D model draws them (js/flat/bake-keys.js), the dark plate in
//   the key openings, the nameplate, the power lamp; its power switch, the rocker on the case's
//   left side, at the left edge. Every key can be clicked or tapped.
//
// The whole is laid out at a design size and scaled to fit its host.

import { GLASS, knobTable } from "../scene/knobs.js";

/** @typedef {{ id: string, x: number, y: number, w: number, d: number, legends: string[], outline?: number[][], arrow?: string, latching?: boolean }} KeyDef */
/** @typedef {"brightness" | "colour"} Knob */
/**
 * @typedef {{
 *   down: (id: string, e: PointerEvent) => void,
 *   up: (id: string) => void,
 *   power?: () => void,
 *   tv?: () => void,
 *   knob?: (which: Knob, v: number) => void,
 *   knobReset?: (which: Knob) => void,
 * }} FlatHandlers
 */
/** @typedef {{ power: string, tvPower: string, brightness: string, colour: string }} FlatLabels the controls' names for screen readers, in the page's language */

const SCALE = 2.6; // design pixels a millimetre (the keyboard)
/** The keyboard's canvas pixels a design pixel: drawn finer than shown, so the legends stay sharp. */
const RES = 2;
/** The case in the keyboard's frame (mm): its width (model/params/machine.json, case.width), front to back as drawn. */
const CASE = { x0: -184, x1: 184, y0: -4, y1: 152, r: 7 };
/** The nameplate (model/params/machine.json, lid_openings.nameplate, less the lid-to-keyboard offset of 26 mm) and the lamp (lid_openings.led). */
const NAMEPLATE = { x0: 15, x1: 113, y0: 120.56, y1: 142.56 };
const LAMP = { x: 146.15, y: 133.4, r: 1.6 };
/** The power rocker's centre front to back: its hole's rear edge 36 mm from the back wall, 26 long (model/params/machine.json, base.left_side.power_switch). */
const POWER_Y = CASE.y1 - 36 - 13;
/** The screen's canvas: 4:3, the picture (560 x 192, each dot 2 x 4) inside the tube's overscan. */
const SW = 1200;
const SH = 900;
const PIC = { x: 40, y: 66, w: 1120, h: 768 };
/** The TV's width, mm (model/params/machine.json, tv.size). */
const TV_W = 419;
/** The TV's panel, design px. */
const PANEL_W = 150;
const BEZEL = 26;

/** @param {Uint8ClampedArray} a @param {Uint8ClampedArray} b */
function samePixels(a, b) {
  const x = new Uint32Array(a.buffer, a.byteOffset, a.length >> 2);
  const y = new Uint32Array(b.buffer, b.byteOffset, b.length >> 2);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** @param {string} tag @param {string} [cls] @param {HTMLElement} [parent] */
function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export class Flat {
  /**
   * @param {HTMLElement} host
   * @param {KeyDef[]} keys
   * @param {FlatHandlers} on
   * @param {FlatLabels} labels
   */
  constructor(host, keys, on, labels) {
    this.host = host;
    this.keys = keys;
    this.on = on;
    host.classList.add("flat");
    /** The state shown: the computer's power, the TV's, its knobs. */
    this.state = { power: false, tv: true, brightness: 0.5, colour: 0.75 };
    /** Whether the state has been shown once. */
    this.shown = false;
    /** The case's and keys' colours (model/params/machine.json, colours; as new or as found). */
    this.colours = { case: "#D3CEC1", key: "#C1B5A3", ink: "#2A2622", sticker: "#FFFFFF" };

    // the design: the keyboard's width sets it
    this.KW = Math.round((CASE.x1 - CASE.x0) * SCALE);
    this.KH = Math.round((CASE.y1 - CASE.y0) * SCALE);
    // the TV as wide, to the computer, as the 3D set is (model/params/machine.json, tv.size 419 mm, case.width 368)
    this.TW = Math.round((this.KW * TV_W) / (CASE.x1 - CASE.x0));
    const screenW = this.TW - 2 * BEZEL - PANEL_W;
    const screenH = Math.round((screenW * 3) / 4);
    this.TH = screenH + 2 * BEZEL;
    this.DW = this.TW;
    /** Whether the computer's drawer is open (U10); the design's height follows it. */
    this.drawerOpen = true;
    this.DH = this.TH + 28 + this.KH + 40;

    this.fit = el("div", "flat-fit", host);
    this.rig = el("div", "flat-rig", this.fit);
    this.rig.style.width = `${this.DW}px`;
    this.rig.style.height = `${this.DH}px`;

    // --- the TV
    const tv = el("div", "flat-tv", this.rig);
    tv.style.width = `${this.TW}px`;
    tv.style.height = `${this.TH}px`;
    tv.style.padding = `${BEZEL}px`;
    this.screenBox = el("div", "flat-screen-box", tv);
    this.screenBox.style.width = `${screenW}px`;
    this.screenBox.style.height = `${screenH}px`;
    this.screen = /** @type {HTMLCanvasElement} */ (el("canvas", "flat-screen", this.screenBox));
    this.screen.width = SW;
    this.screen.height = SH;
    el("div", "flat-glass", this.screenBox);
    this.sctx = /** @type {CanvasRenderingContext2D} */ (this.screen.getContext("2d"));
    this.frame = new ImageData(560, 192);
    this.small = document.createElement("canvas");
    this.small.width = 560;
    this.small.height = 192;
    const panel = el("div", "flat-panel", tv);
    panel.style.width = `${PANEL_W}px`;
    el("div", "flat-grille", panel);
    /** @type {Record<Knob, HTMLElement>} */
    this.knobs = /** @type {any} */ ({});
    for (const [which, en, zh] of /** @type {const} */ ([["brightness", "Brightness", "亮度"], ["colour", "Colour", "饱和度"]])) {
      const box = el("div", "flat-knob-box", panel);
      const k = el("div", "flat-knob", box);
      k.setAttribute("role", "slider");
      k.setAttribute("aria-label", `${en} ${zh}`);
      el("div", "flat-knob-mark", k);
      el("div", "flat-label", box).textContent = zh;
      this.knobs[which] = k;
      this.knobDrag(k, which);
    }
    el("div", "flat-grille flat-grille-low", panel);
    const pw = el("div", "flat-tv-power", panel);
    this.tvButton = /** @type {HTMLButtonElement} */ (el("button", "flat-tv-button", pw));
    this.tvButton.type = "button";
    this.tvButton.setAttribute("aria-label", labels.tvPower);
    this.tvButton.addEventListener("click", () => this.on.tv?.());
    this.tvLamp = el("div", "flat-tv-lamp", pw);

    // --- the computer
    const comp = el("div", "flat-computer", this.rig);
    this.computer = comp;
    comp.style.width = `${this.KW}px`;
    comp.style.height = `${this.KH}px`;
    this.kb = /** @type {HTMLCanvasElement} */ (el("canvas", "flat-keys", comp));
    this.kb.width = this.KW * RES;
    this.kb.height = this.KH * RES;
    this.kb.style.width = `${this.KW}px`;
    this.kb.style.height = `${this.KH}px`;
    this.kctx = /** @type {CanvasRenderingContext2D} */ (this.kb.getContext("2d"));
    // the power switch: a rocker on the case's left side (model/params/machine.json, base.left_side.power_switch)
    this.powerBtn = /** @type {HTMLButtonElement} */ (el("button", "flat-power", comp));
    this.powerBtn.type = "button";
    this.powerBtn.setAttribute("aria-label", labels.power);
    // the rocker as the 3D one, face on: dark, its white pit towards the front end (the end
    // pressed in for on); the end pressed in shown sunk and shaded, the other standing out
    this.powerBtn.innerHTML = `<span class="flat-rocker"><span class="flat-rocker-pit"></span></span>`;
    this.powerBtn.style.top = `${this.py(POWER_Y) - 44}px`;
    this.powerBtn.addEventListener("click", () => this.on.power?.());
    this.nameplate = new Image();
    const plate = new URL("../../model/assets/stickers/nameplate.svg", import.meta.url);
    plate.search = new URL(import.meta.url).search;
    this.nameplate.src = plate.href;
    this.nameplate.onload = () => this.drawKeys();
    /** The lid's openings (keyboard frame, mm): until the params are given, round the keys. @type {number[][][]} */
    this.openings = [];
    /** @type {any} model/params/machine.json, once given */
    this.params = null;
    /** @type {Uint8ClampedArray | null} the keys' picture's pixels */
    this.artAlpha = null;
    /** The keys as the 3D model draws them (js/flat/bake-keys.js), once given. @type {{ canvas: HTMLCanvasElement, pxPerMm: number, x0: number, y1: number } | null} */
    this.art = null;

    /** @type {HTMLCanvasElement | null} a scratch canvas for a pressed key */
    this.tmp = null;
    /** Keys shown down. @type {Set<string>} */
    this.downIds = new Set();
    /** Keys latched (Caps Lock). @type {Set<string>} */
    this.latched = new Set();
    /** @type {Uint8ClampedArray | null} the picture last shown */
    this.lastPixels = null;
    this.lastKey = "";
    /** @type {string | null} the key the pointer holds */
    this.pointerKey = null;
    this.kb.addEventListener("pointerdown", (e) => {
      const id = this.keyAt(e);
      if (!id) return;
      this.kb.setPointerCapture(e.pointerId);
      this.pointerKey = id;
      this.on.down(id, e);
    });
    // a Mac's Ctrl-click is the browser's right click: no menu over the keys
    this.kb.addEventListener("contextmenu", (e) => e.preventDefault());
    const release = () => {
      if (this.pointerKey) this.on.up(this.pointerKey);
      this.pointerKey = null;
    };
    this.kb.addEventListener("pointerup", release);
    this.kb.addEventListener("pointercancel", release);
    // the switches work by the pointer (and your own keys work the machine): they never take the
    // keyboard's focus, so no focus ring shows, and a Space or Return typed to the machine
    // cannot press them
    for (const b of [this.powerBtn, this.tvButton]) {
      b.tabIndex = -1;
      b.addEventListener("mousedown", (e) => e.preventDefault());
    }
    new ResizeObserver(() => this.layout()).observe(host);
    this.setState({});
    this.drawKeys();
  }

  /**
   * The computer's drawer under the TV: open, the keyboard is drawn there to click or tap;
   * closed, the TV has the stage.
   * @param {boolean} open
   */
  setDrawer(open) {
    this.drawerOpen = open;
    this.computer.hidden = !open;
    this.DH = open ? this.TH + 28 + this.KH + 40 : this.TH + 8;
    this.rig.style.height = `${this.DH}px`;
    this.layout();
  }

  /** @private scale the design to the host's free area */
  layout() {
    const cs = getComputedStyle(this.host);
    const w = this.host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = this.host.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w <= 0 || h <= 0) return;
    const s = Math.min(w / this.DW, h / this.DH);
    this.fit.style.width = `${this.DW * s}px`;
    this.fit.style.height = `${this.DH * s}px`;
    this.rig.style.transform = `scale(${s})`;
  }

  /** @private a knob turned by a drag (up or right turns it up) or the wheel @param {HTMLElement} k @param {Knob} which */
  knobDrag(k, which) {
    /** @type {{ x: number, y: number, v: number } | null} */
    let drag = null;
    k.addEventListener("pointerdown", (e) => {
      k.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, v: this.state[which] };
    });
    k.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.on.knob?.(which, Math.max(0, Math.min(1, drag.v + (e.clientX - drag.x - (e.clientY - drag.y)) / 200)));
    });
    const end = () => (drag = null);
    k.addEventListener("pointerup", end);
    k.addEventListener("pointercancel", end);
    k.addEventListener("dblclick", () => this.on.knobReset?.(which));
    k.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.on.knob?.(which, Math.max(0, Math.min(1, this.state[which] - Math.sign(e.deltaY) * 0.05)));
    }, { passive: false });
  }

  /**
   * The computer's power, the TV's, the knobs: shown on the switches and lamps.
   * @param {Partial<{ power: boolean, tv: boolean, brightness: number, colour: number }>} s
   */
  setState(s) {
    const st = /** @type {Record<string, unknown>} */ (this.state);
    if (this.shown && Object.entries(s).every(([k, v]) => st[k] === v)) return;
    this.shown = true;
    const before = this.state.power;
    Object.assign(this.state, s);
    this.powerBtn.setAttribute("aria-pressed", String(this.state.power));
    for (const cv of /** @type {NodeListOf<HTMLElement>} */ (this.powerBtn.querySelectorAll(".flat-rocker-art"))) {
      cv.style.display = cv.classList.contains(this.state.power ? "flat-rocker-on" : "flat-rocker-off") ? "block" : "none";
    }
    this.tvButton.setAttribute("aria-pressed", String(this.state.tv));
    this.tvLamp.classList.toggle("on", this.state.tv);
    for (const w of /** @type {Knob[]} */ (["brightness", "colour"])) {
      this.knobs[w].style.transform = `rotate(${-135 + 270 * this.state[w]}deg)`;
      this.knobs[w].setAttribute("aria-valuenow", String(Math.round(this.state[w] * 100)));
    }
    if (before !== this.state.power) this.drawKeys();
  }

  /** The case's and keys' colours (as new, or as found), and the stickers' tint (white as new). @param {{ case: string, key: string, ink?: string, sticker?: string }} c */
  setColours(c) {
    Object.assign(this.colours, c);
    this.drawKeys();
  }

  /**
   * The lid's openings, where the plate shows round the keys: each its keys' outline with one
   * even margin all round (the 2D view looks straight down, so no side shows
   * more of the plate than another). The margin is the Quit hole's at its sides, as measured
   * (model/params/machine.json, lid_openings.quit against the Quit key); the shapes are the lid's: the main hole
   * with its notch for the space bar's row, the Quit and F-key holes, and the arrow keys'
   * square hole with its corners cut at 45 degrees, following the keys' chamfers
   * (model/params/machine.json, keyboard.arrows).
   * @param {any} params model/params/machine.json
   */
  setOpenings(params) {
    this.params = params;
    const v = (/** @type {any} */ e) => e.v;
    /** The keys' box as drawn: the 3D caps' own outline once their picture is in (they stand
     * a little off their nominal places), else their places in keyboard.json.
     * @param {KeyDef[]} ks @param {number} [ylo] @param {number} [yhi] look only between these
     * @returns {[number, number, number, number]} */
    const bb = (ks, ylo = -Infinity, yhi = Infinity) => {
      const b = /** @type {[number, number, number, number]} */ ([Math.min(...ks.map((k) => k.x - k.w / 2)), Math.max(...ks.map((k) => k.x + k.w / 2)), Math.min(...ks.map((k) => k.y - k.d / 2)), Math.max(...ks.map((k) => k.y + k.d / 2))]);
      return this.art ? this.drawnBox(b[0] - 3, b[1] + 3, Math.max(ylo, b[2] - 3), Math.min(yhi, b[3] + 3)) ?? b : b;
    };
    const quit = this.keys.filter((k) => k.id === "quit");
    const pad = quit[0].x - quit[0].w / 2 - v(params.lid_openings.quit.x)[0];
    const arrowIds = ["up", "down", "left", "right"];
    const fkeys = this.keys.filter((k) => k.y > 120 && k.id !== "quit");
    const main = this.keys.filter((k) => k.y <= 120 && !arrowIds.includes(k.id));
    const lowest = Math.min(...main.map((k) => k.y));
    const bottomRow = main.filter((k) => k.y < lowest + 1);
    const upper = main.filter((k) => k.y >= lowest + 1);
    /** @param {[number, number, number, number]} b @returns {number[][]} */
    const rect = ([x0, x1, y0, y1]) => [[x0 - pad, y1 + pad], [x1 + pad, y1 + pad], [x1 + pad, y0 - pad], [x0 - pad, y0 - pad]];
    const mid = (Math.max(...bottomRow.map((k) => k.y + k.d / 2)) + Math.min(...upper.map((k) => k.y - k.d / 2))) / 2;
    const [ux0, ux1, uy0, uy1] = bb(upper, mid);
    const [nx0, nx1, ny0] = bb(bottomRow, -Infinity, mid);
    const mainHole = [[ux0 - pad, uy1 + pad], [ux1 + pad, uy1 + pad], [ux1 + pad, uy0 - pad], [nx1 + pad, uy0 - pad], [nx1 + pad, ny0 - pad], [nx0 - pad, ny0 - pad], [nx0 - pad, uy0 - pad], [ux0 - pad, uy0 - pad]];
    const ar = params.keyboard.arrows;
    const [bx0, bx1, by0, by1] = bb(this.keys.filter((k) => arrowIds.includes(k.id)));
    const ax = this.art ? (bx0 + bx1) / 2 : v(ar.centre)[0];
    const ay = this.art ? (by0 + by1) / 2 : v(ar.centre)[1];
    const h = (this.art ? Math.max(bx1 - bx0, by1 - by0) : v(ar.size)) / 2 + pad;
    const cut = v(ar.corner_cut) + pad * (2 - Math.SQRT2); // a 45-degree chamfer moved out by pad
    const arrows = [[ax - h + cut, ay + h], [ax + h - cut, ay + h], [ax + h, ay + h - cut], [ax + h, ay - h + cut], [ax + h - cut, ay - h], [ax - h + cut, ay - h], [ax - h, ay - h + cut], [ax - h, ay + h - cut]];
    this.openings = [mainHole, rect(bb(quit)), rect(bb(fkeys)), arrows];
    this.drawKeys();
  }

  /**
   * The power switch as the 3D model's rocker, in its two positions (js/flat/bake-rocker.js),
   * shown a little larger than the case's scale so that it is easy to hit.
   * @param {{ off: HTMLCanvasElement, on: HTMLCanvasElement, pxPerMm: number }} art
   */
  setRockerArt(art) {
    const k = (SCALE * 1.45) / art.pxPerMm;
    this.powerBtn.innerHTML = "";
    for (const [state, cv] of /** @type {const} */ ([["off", art.off], ["on", art.on]])) {
      const img = /** @type {HTMLCanvasElement} */ (cv.cloneNode());
      /** @type {CanvasRenderingContext2D} */ (img.getContext("2d")).drawImage(cv, 0, 0);
      img.className = `flat-rocker-art flat-rocker-${state}`;
      img.style.width = `${cv.width * k}px`;
      img.style.height = `${cv.height * k}px`;
      this.powerBtn.appendChild(img);
    }
    this.powerBtn.classList.add("baked");
    this.shown = false;
    this.setState({});
    this.powerBtn.style.top = `${this.py(POWER_Y) - (art.off.height * k) / 2}px`;
  }

  /** The keys' picture from the 3D model (js/flat/bake-keys.js). @param {{ canvas: HTMLCanvasElement, pxPerMm: number, x0: number, y1: number }} art */
  setKeyArt(art) {
    this.art = art;
    const a = /** @type {CanvasRenderingContext2D} */ (art.canvas.getContext("2d"));
    this.artAlpha = a.getImageData(0, 0, art.canvas.width, art.canvas.height).data;
    if (this.params) this.setOpenings(this.params);
    else this.drawKeys();
  }

  /**
   * The box of what the keys' picture draws inside a region (keyboard frame, mm), or null.
   * @param {number} x0 @param {number} x1 @param {number} y0 @param {number} y1
   * @returns {[number, number, number, number] | null}
   */
  drawnBox(x0, x1, y0, y1) {
    const a = /** @type {NonNullable<typeof this.art>} */ (this.art);
    const al = /** @type {Uint8ClampedArray} */ (this.artAlpha);
    const W = a.canvas.width;
    const H = a.canvas.height;
    const c0 = Math.max(0, Math.floor((x0 - a.x0) * a.pxPerMm));
    const c1 = Math.min(W - 1, Math.ceil((x1 - a.x0) * a.pxPerMm));
    const r0 = Math.max(0, Math.floor((a.y1 - y1) * a.pxPerMm));
    const r1 = Math.min(H - 1, Math.ceil((a.y1 - y0) * a.pxPerMm));
    let cmin = Infinity, cmax = -Infinity, rmin = Infinity, rmax = -Infinity;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (al[(r * W + c) * 4 + 3] < 128) continue;
        if (c < cmin) cmin = c;
        if (c > cmax) cmax = c;
        if (r < rmin) rmin = r;
        if (r > rmax) rmax = r;
      }
    }
    if (cmin === Infinity) return null;
    return [a.x0 + cmin / a.pxPerMm, a.x0 + (cmax + 1) / a.pxPerMm, a.y1 - (rmax + 1) / a.pxPerMm, a.y1 - rmin / a.pxPerMm];
  }

  /** @private keyboard mm to design px */
  px(/** @type {number} */ x) {
    return (x - CASE.x0) * SCALE;
  }
  py(/** @type {number} */ y) {
    return (CASE.y1 - y) * SCALE;
  }

  /** @private a key's outline in canvas pixels @param {KeyDef} k */
  path(k) {
    const c = this.kctx;
    c.beginPath();
    if (k.outline) {
      k.outline.forEach(([dx, dy], i) => (i ? c.lineTo(this.px(k.x + dx), this.py(k.y + dy)) : c.moveTo(this.px(k.x + dx), this.py(k.y + dy))));
      c.closePath();
    } else {
      const g = 1.2;
      c.roundRect(this.px(k.x - k.w / 2 + g), this.py(k.y + k.d / 2 - g), (k.w - 2 * g) * SCALE, (k.d - 2 * g) * SCALE, 2.5 * SCALE);
    }
  }

  /** @private @param {PointerEvent} e */
  keyAt(e) {
    const r = this.kb.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.KW;
    const y = ((e.clientY - r.top) / r.height) * this.KH;
    const c = this.kctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    let hit = null;
    for (const k of this.keys) {
      this.path(k);
      if (c.isPointInPath(x, y)) {
        hit = k.id;
        break;
      }
    }
    c.restore();
    return hit;
  }

  drawKeys() {
    const c = this.kctx;
    const col = this.colours;
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.clearRect(0, 0, this.KW, this.KH);
    // the case
    c.fillStyle = col.case;
    c.beginPath();
    c.roundRect(0, 0, this.KW, this.KH, CASE.r * SCALE);
    c.fill();
    c.strokeStyle = "#0003";
    c.lineWidth = 2;
    c.stroke();
    // the key openings: the dark steel plate round each group of keys
    // the lid's openings, where the dark steel plate shows round the keys (model/params/machine.json, lid_openings)
    c.fillStyle = "#2b2c2e";
    for (const poly of this.openings) {
      c.beginPath();
      poly.forEach(([x, y], i) => (i ? c.lineTo(this.px(x), this.py(y)) : c.moveTo(this.px(x), this.py(y))));
      c.closePath();
      c.fill();
    }
    // the nameplate, and the lamp
    if (this.nameplate.complete && this.nameplate.naturalWidth) {
      const r = /** @type {const} */ ([this.px(NAMEPLATE.x0), this.py(NAMEPLATE.y1), (NAMEPLATE.x1 - NAMEPLATE.x0) * SCALE, (NAMEPLATE.y1 - NAMEPLATE.y0) * SCALE]);
      c.drawImage(this.nameplate, ...r);
      // aged with the case, as found: the sticker's colours times the case's yellowing
      if (col.sticker.toUpperCase() !== "#FFFFFF") {
        c.save();
        c.globalCompositeOperation = "multiply";
        c.fillStyle = col.sticker;
        c.fillRect(...r);
        c.restore();
      }
    }
    c.beginPath();
    c.arc(this.px(LAMP.x), this.py(LAMP.y), LAMP.r * SCALE, 0, 2 * Math.PI);
    c.fillStyle = this.state.power ? "#ff3b2e" : "#5a1814";
    if (this.state.power) {
      c.shadowColor = "#ff3b2e";
      c.shadowBlur = 12;
    }
    c.fill();
    c.shadowBlur = 0;
    // the keys: the 3D model's, pressed ones darkened through their own shape
    if (this.art) {
      const a = this.art;
      const sc = SCALE / a.pxPerMm;
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(a.canvas, this.px(a.x0), this.py(a.y1), a.canvas.width * sc, a.canvas.height * sc);
      for (const k of this.keys) {
        if (!(this.downIds.has(k.id) || this.latched.has(k.id))) continue;
        const sx = Math.max(0, Math.floor((k.x - k.w / 2 - 1 - a.x0) * a.pxPerMm));
        const sy = Math.max(0, Math.floor((a.y1 - (k.y + k.d / 2 + 1)) * a.pxPerMm));
        const sw = Math.ceil((k.w + 2) * a.pxPerMm);
        const sh = Math.ceil((k.d + 2) * a.pxPerMm);
        const t = this.tmp ?? (this.tmp = document.createElement("canvas"));
        t.width = sw;
        t.height = sh;
        const tc = /** @type {CanvasRenderingContext2D} */ (t.getContext("2d"));
        tc.drawImage(a.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        tc.globalCompositeOperation = "source-atop";
        tc.fillStyle = "#0000004d";
        tc.fillRect(0, 0, sw, sh);
        // only this key: clipped to its place (its outline, or its rectangle)
        c.save();
        c.beginPath();
        if (k.outline) this.path(k);
        else c.rect(this.px(k.x - k.w / 2), this.py(k.y + k.d / 2), k.w * SCALE, k.d * SCALE);
        c.clip();
        c.drawImage(t, this.px(a.x0) + sx * sc, this.py(a.y1) + sy * sc, sw * sc, sh * sc);
        c.restore();
      }
      return;
    }
    // (until the model's keys are given: plain caps)
    for (const k of this.keys) {
      const down = this.downIds.has(k.id) || this.latched.has(k.id);
      this.path(k);
      c.fillStyle = col.key;
      c.fill();
      if (down) {
        c.fillStyle = "#0004";
        c.fill();
      }
      c.strokeStyle = "#0005";
      c.lineWidth = 1.5;
      c.stroke();
      const cx = this.px(k.x);
      const cy = this.py(k.y);
      c.fillStyle = col.ink;
      c.textAlign = "center";
      c.textBaseline = "middle";
      if (k.arrow) {
        const a = { up: "▲", down: "▼", left: "◀", right: "▶" }[k.arrow];
        c.font = `${5 * SCALE}px sans-serif`;
        c.fillText(a ?? "", cx, cy);
        continue;
      }
      const lines = k.legends.length ? k.legends : [];
      const size = lines.some((l) => l.length > 2) ? 3.6 : 4.6;
      c.font = `${size * SCALE}px "Noto Sans SC", system-ui, sans-serif`;
      if (lines.length === 2 && lines.every((l) => l.length === 1)) {
        // a shifted sign above its plain one, as on the keycap
        c.fillText(lines[1], cx, cy - 3 * SCALE);
        c.fillText(lines[0], cx, cy + 3 * SCALE);
      } else {
        lines.forEach((l, i) => c.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * size * 1.15 * SCALE));
      }
    }
  }

  /** Keys down and latched, as the machine's keyboard has them. @param {Set<string>} down @param {Set<string>} latched */
  setKeys(down, latched) {
    const same = (/** @type {Set<string>} */ a, /** @type {Set<string>} */ b) => a.size === b.size && [...a].every((x) => b.has(x));
    if (same(down, this.downIds) && same(latched, this.latched)) return;
    this.downIds = new Set(down);
    this.latched = new Set(latched);
    this.drawKeys();
  }

  /**
   * The picture on the tube: each dot sharp, the colour round it in the overscan, the TV's
   * knobs applied, over the lit glass. With the TV off, the glass; with no signal, the glass lit.
   * @param {{ on: boolean, pixels: Uint8ClampedArray, border: number[], display: import("../sim/video.js").Display, colour: number }} s on: the computer's signal; display: the set, for its glass; colour: the colour knob as the picture takes it (System.colourKnob)
   */
  show(s) {
    const tvOn = this.state.tv;
    const glass = GLASS[s.display];
    const key = `${tvOn}|${s.on}|${s.display}|${this.state.brightness}|${s.colour}|${s.border.join(",")}`;
    if (this.lastPixels && this.lastKey === key && (!s.on || samePixels(this.lastPixels, s.pixels))) return;
    this.lastKey = key;
    this.lastPixels = this.lastPixels ?? new Uint8ClampedArray(s.pixels.length);
    this.lastPixels.set(s.pixels);
    const c = this.sctx;
    if (!tvOn) {
      c.fillStyle = `rgb(${glass.off.map((v) => Math.round(v * 0.8)).join(",")})`;
      c.fillRect(0, 0, SW, SH);
      return;
    }
    const t = knobTable(this.state.brightness, s.colour);
    // the glass under the light: out = glass + light x (1 - glass), per channel
    const g = glass.lit;
    const over = (/** @type {number} */ r, /** @type {number} */ gg, /** @type {number} */ b) => {
      const [x, y, z] = t(r, gg, b);
      return [g[0] + x * (1 - g[0] / 255), g[1] + y * (1 - g[1] / 255), g[2] + z * (1 - g[2] / 255)];
    };
    if (!s.on) {
      c.fillStyle = `rgb(${over(4, 5, 5).map(Math.round).join(",")})`;
      c.fillRect(0, 0, SW, SH);
      return;
    }
    const out = this.frame.data;
    const px = s.pixels;
    for (let i = 0; i < px.length; i += 4) {
      const [r, gg, b] = over(px[i], px[i + 1], px[i + 2]);
      out[i] = r;
      out[i + 1] = gg;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
    /** @type {CanvasRenderingContext2D} */ (this.small.getContext("2d")).putImageData(this.frame, 0, 0);
    c.fillStyle = `rgb(${over(s.border[0], s.border[1], s.border[2]).map(Math.round).join(",")})`;
    c.fillRect(0, 0, SW, SH);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.small, PIC.x, PIC.y, PIC.w, PIC.h);
  }
}
