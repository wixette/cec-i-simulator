// SPDX-License-Identifier: Apache-2.0
//
// The keyboard. Each key's code comes from the keyboard ROM U26 itself, as the encoder (a
// KB3600 with U25) reads it: the key's place in the matrix (model/params/keyboard_matrix.json:
// group 10 X + Y of four bytes, normal, Shift, Ctrl, both; A9 = Caps Lock off). Holding a
// key repeats it after REPEAT_DELAY_S at REPEAT_HZ (about 8 a second on a real machine).
// RESET, with Ctrl, is the RESET line, not a code.
//
// And a typist, for the page's Type in and for the tests: codes into the latch one by one,
// each once the program has taken the last (the strobe cleared) and a short gap has passed.
// No DOM.

import { CLOCK_HZ } from "./machine.js";

export const REPEAT_DELAY_S = 0.25;
export const REPEAT_HZ = 8.3;

/** @typedef {Record<string, [number, number] | string>} Matrix model/params/keyboard_matrix.json's keys */
/** @typedef {{ id: string, shift: boolean, ctrl: boolean }} Stroke a key, and the modifiers held with it */
/** @typedef {{ id: string, x: number, y: number, group: number, shift: boolean, ctrl: boolean, caps: boolean, addr: number, code: number }} Lookup a key's code as U26 gives it */

/** Keys that act on the machine directly and give no code. */
export const NO_CODE = new Set(["reset", "ctrl", "lshift", "rshift", "capslock"]);

export class Keyboard {
  /**
   * @param {import("./machine.js").Machine} m
   * @param {Matrix} matrix
   */
  constructor(m, matrix) {
    this.m = m;
    this.matrix = matrix;
    this.shift = false;
    this.ctrl = false;
    /** Caps Lock latched down: capitals, as the machine starts. */
    this.caps = true;
    /** The key held, and when it repeats next (cycles). @type {{ id: string, next: number } | null} */
    this.held = null;
    /** The last key's code, as U26 gave it (the Keyboard tool). @type {Lookup | null} */
    this.last = null;
  }

  /**
   * How U26 gives a key's code: the key's place in the matrix, its group (10 X + Y), the byte's
   * address in the ROM (Caps Lock up adds $200; four bytes a group: plain, Shift, Ctrl, both),
   * and the code there. Null for a key with no code.
   * @param {string} id
   * @param {{ shift?: boolean, ctrl?: boolean, caps?: boolean }} [mods] as now, unless given
   * @returns {Lookup | null}
   */
  lookup(id, mods = {}) {
    const at = this.matrix[id];
    if (!Array.isArray(at)) return null;
    const shift = mods.shift ?? this.shift;
    const ctrl = mods.ctrl ?? this.ctrl;
    const caps = mods.caps ?? this.caps;
    const group = 10 * at[0] + at[1];
    const addr = (caps ? 0 : 0x200) + 4 * group + (shift ? 1 : 0) + (ctrl ? 2 : 0);
    return { id, x: at[0], y: at[1], group, shift, ctrl, caps, addr, code: this.m.roms.u26[addr] & 0x7f };
  }

  /**
   * The code a key gives, or null (the modifiers, RESET).
   * @param {string} id
   * @param {{ shift?: boolean, ctrl?: boolean, caps?: boolean }} [mods] as now, unless given
   */
  code(id, mods = {}) {
    return this.lookup(id, mods)?.code ?? null;
  }

  /**
   * The key (and Shift or Ctrl) that types a code with Caps Lock down, as a person would
   * press it: no modifier if one will do, else Shift, else Ctrl. Null for a code no key gives.
   * @param {number} code
   * @returns {Stroke | null}
   */
  strokeFor(code) {
    /** @type {Stroke | null} */
    let best = null;
    const rank = (/** @type {Stroke} */ s) => (s.shift ? 1 : 0) + (s.ctrl ? 2 : 0);
    for (const id of Object.keys(this.matrix)) {
      if (NO_CODE.has(id) || id === "rshift") continue;
      for (const [shift, ctrl] of /** @type {const} */ ([[false, false], [true, false], [false, true]])) {
        if (this.code(id, { shift, ctrl, caps: true }) !== code) continue;
        const s = { id, shift, ctrl };
        if (!best || rank(s) < rank(best)) best = s;
      }
    }
    return best;
  }

  /** A key goes down. @param {string} id */
  down(id) {
    if (id === "lshift" || id === "rshift") return void (this.shift = true);
    if (id === "ctrl") return void (this.ctrl = true);
    if (id === "capslock") return void (this.caps = !this.caps);
    if (id === "reset") {
      if (this.ctrl) this.m.holdReset(true); // Ctrl-Reset: the line held low while both are down
      return;
    }
    const l = this.lookup(id);
    if (!l) return;
    this.last = l;
    this.m.keyPress(l.code);
    this.held = { id, next: this.m.cycles + REPEAT_DELAY_S * CLOCK_HZ };
  }

  /** A key comes up. @param {string} id */
  up(id) {
    if (id === "lshift" || id === "rshift") return void (this.shift = false);
    if (id === "ctrl" || id === "reset") this.m.holdReset(false); // either let go: the line goes high, the reset runs
    if (id === "ctrl") return void (this.ctrl = false);
    if (this.held?.id === id) {
      this.held = null;
      this.m.keyUp();
    }
  }

  /** Every key up, Caps Lock as it is (switched off, or the page lost the keyboard). */
  releaseAll() {
    this.shift = false;
    this.ctrl = false;
    this.held = null;
    this.m.keyUp();
    this.m.holdReset(false);
  }

  /** Called as the machine runs: the held key's repeats. */
  tick() {
    const h = this.held;
    if (!h || this.m.cycles < h.next) return;
    const c = this.code(h.id);
    if (c !== null) this.m.keyPress(c);
    h.next = this.m.cycles + CLOCK_HZ / REPEAT_HZ;
  }
}

/** The CEC's own keys' codes (U26, as GET reads them on a real machine), and { (a brace is the typist's own sign). */
export const CODES = /** @type {Record<string, number>} */ ({
  f1: 1, f2: 12, f3: 23, f4: 20, f5: 6, quit: 3, xiwen: 17, zhongwen: 31, tab: 9, esc: 27,
  left: 8, right: 21, up: 11, down: 10, ret: 13, test: 22, lbrace: 123,
});

/** Types codes into the latch, each once the last was read. */
export class Typist {
  /** @param {import("./machine.js").Machine} m */
  constructor(m) {
    this.m = m;
    /**
     * Codes to type, a pause of that many cycles ({ wait }), Ctrl-Reset ({ reset }), or a
     * question asked of the machine when reached, whose answer is typed next ({ then }).
     * @type {(number | { wait: number } | { reset: true } | { then: (m: import("./machine.js").Machine) => string })[]}
     */
    this.queue = [];
    /** @private cycle of the last key */
    this.last = -1e12;
    /** Cycles between keys (a quick typist: 30 a second). */
    this.gap = Math.round(CLOCK_HZ / 30);
    /** Called with each code as it goes into the latch (the views show its key). @type {(code: number) => void} */
    this.onKey = () => {};
  }

  /**
   * Text to type: \n is Return; {name} a key by its code's name (CODES); {wait:s} a pause of s
   * seconds, for a mode change to finish; {reset} Ctrl-Reset (the RESET line, low and high
   * again: whatever runs stops, and BASIC's prompt comes back). Other characters as their 7-bit codes.
   * @param {string} text
   */
  type(text) {
    for (const part of text.split(/(\{[a-z0-9]+(?::[0-9.]+)?\})/)) {
      const named = /^\{([a-z0-9]+)(?::([0-9.]+))?\}$/.exec(part);
      if (named && named[1] === "wait") this.queue.push({ wait: Math.round(Number(named[2] ?? 1) * CLOCK_HZ) });
      else if (named && named[1] === "reset") this.queue.push({ reset: true });
      else if (named && named[1] in CODES) this.queue.push(CODES[named[1]]);
      else for (const ch of part.replace(/\r\n?/g, "\n").replace(/\n/g, "\r")) this.queue.push(ch.charCodeAt(0) & 0x7f);
    }
  }

  get busy() {
    return this.queue.length > 0;
  }

  /** Types what `then` answers when the typist reaches this point (after what is queued now). @param {(m: import("./machine.js").Machine) => string} then */
  ask(then) {
    this.queue.push({ then });
  }

  /** Forgets what is still to type. */
  clear() {
    this.queue.length = 0;
  }

  tick() {
    const m = this.m;
    const next = this.queue[0];
    if (next === undefined) return;
    if (typeof next === "object" && "then" in next) {
      this.queue.shift();
      const rest = this.queue.splice(0);
      this.type(next.then(m));
      this.queue.push(...rest);
      return;
    }
    if (typeof next === "object" && "reset" in next) {
      this.queue.shift();
      m.holdReset(true);
      m.holdReset(false);
      this.last = m.cycles;
      return;
    }
    if (typeof next === "object" && "wait" in next) {
      if (m.cycles - this.last < next.wait) return;
      this.queue.shift();
      this.last = m.cycles;
      return;
    }
    if (m.strobe || m.cycles - this.last < this.gap) return;
    this.queue.shift();
    m.keyPress(next);
    m.keyUp();
    this.last = m.cycles;
    this.onKey(next);
  }
}

/**
 * Runs the machine `seconds` of machine time, ticking the devices every millisecond (the
 * tests, and the page when it catches up).
 * @param {import("./machine.js").Machine} m
 * @param {number} seconds
 * @param {{ tick: () => void }[]} devices
 */
export function runFor(m, seconds, devices) {
  const slice = Math.round(CLOCK_HZ / 1000);
  const end = m.cycles + seconds * CLOCK_HZ;
  while (m.cycles < end) {
    for (const d of devices) d.tick();
    if (!m.run(slice)) break; // switched off
  }
}
