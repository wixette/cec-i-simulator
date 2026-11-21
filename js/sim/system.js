// SPDX-License-Identifier: Apache-2.0
//
// The whole set-up as the page works it: the computer, its keyboard and the visitor's, the
// typist, the television, and the computer taken apart. It holds the rules every view obeys
// (docs/ui-design.md, U3-U5; design/decisions.md), so that the 3D view, the 2D view, the
// helper strip and the dialogs all ask one place:
//
// - the computer switches on only when it is whole;
// - nothing comes out while it is on; a click takes out what is in the way first;
// - the machine runs in real time, faster while the typist types (Type in), and slower
//   rather than racing when a frame's work takes too long;
// - a key is down while anyone holds it: the visitor's keyboard, the pointer, the typist.
//
// No DOM and no three.js: what it has to say goes out as a message key and its values
// (`say`), which the page words (js/l10n/en.js). tests/system.test.js walks its rules.

import { listProgram, tokenNames } from "./basic.js";
import { planTyping } from "./chinese.js";
import { Joystick } from "./joystick.js";
import { KeyHolds, RESET_HOLD_MS } from "./key-holds.js";
import { Keyboard, Typist } from "./keyboard.js";
import { CLOCK_HZ, Machine } from "./machine.js";
import { Video } from "./video.js";

/** Typing in runs the machine this many times faster than real time, so a listing goes in quickly. */
export const FAST_TYPING = 8;
/** At most this much wall time is caught up after a stall, s. */
const MAX_DT = 0.1;
/** The longest a frame may spend running the machine, ms: beyond it the machine runs slow. */
const FRAME_BUDGET_MS = 12;
/** The machine runs in slices this long, cycles, with the keyboard and the typist ticked between. */
const SLICE = Math.round(CLOCK_HZ / 1000);
/** Seconds a unit takes to come out; to go back with the rest, after Put it all back. */
export const OUT_S = 1.1;
export const BACK_S = 0.25;
/** How long a key typed by the typist shows down, ms. */
const TYPED_MS = 90;
/** Seconds the Chinese system takes to start, after the 中文 key, before typing goes on. */
const CHINESE_START_S = 2.5;
/** Where the TV's knobs start, and a double-click puts them back. */
export const KNOB_START = /** @type {const} */ ({ brightness: 0.5, colour: 0.75 });

/** @typedef {{ key: string, params?: Record<string, string | number> }} Message */
/** @typedef {{ f: number, target: number, rate: number }} Motion how far out a unit is (0 in, 1 out), where it is going, how fast (per second) */
/** @typedef {{ unit: string, requires: string[] }} Step a unit, and what must be out before it */
/** @typedef {"brightness" | "colour"} Knob */
/** @typedef {import("./video.js").Display} Display */
/** @typedef {"key" | "pointer"} Source who pressed a key: the visitor's keyboard, or a click or a tap */

export class System {
  /**
   * @param {object} o
   * @param {import("./machine.js").Roms} o.roms
   * @param {import("./keyboard.js").Matrix} o.matrix model/params/keyboard_matrix.json's keys
   * @param {readonly Step[]} o.takeApart model/params/machine.json, take_apart.order
   * @param {boolean} [o.hasRoms] false: the ROM files could not be loaded (o.roms is blank), and the computer will not start
   */
  constructor(o) {
    /** Whether the ROMs are there: without them the computer will not switch on. */
    this.hasRoms = o.hasRoms ?? true;
    this.machine = new Machine(o.roms);
    this.keyboard = new Keyboard(this.machine, o.matrix);
    this.typist = new Typist(this.machine);
    this.video = new Video(o.roms.u13);
    this.order = o.takeApart;
    /** @type {Map<string, Motion>} */
    this.motion = new Map(o.takeApart.map((s) => [s.unit, { f: 0, target: 0, rate: 1 / OUT_S }]));
    /** The TV: its power and its two knobs, 0..1. @type {{ on: boolean } & Record<Knob, number>} */
    this.tv = { on: false, brightness: KNOB_START.brightness, colour: KNOB_START.colour };
    /** The joystick on the game port, played on the visitor's keys (design/v0.0.3.md, P2). */
    this.joystick = new Joystick();
    /** Whether typing in runs the machine faster (FAST_TYPING). */
    this.fastTyping = true;
    /** The longest a frame may spend running the machine, ms (FRAME_BUDGET_MS; the tests lift it, so that they do not depend on the computer they run on). */
    this.frameBudgetMs = FRAME_BUDGET_MS;
    /** The CPU tool's clock: paused, the speed asked for (1, 0.1, 0.01, 0.001), the stops of Run to. */
    this.paused = false;
    this.speedSet = 1;
    /** @type {Set<number>} */
    this.stops = new Set();
    /** Called when Run to reaches a stop, with its address. @type {(pc: number) => void} */
    this.onStop = () => {};
    /** @private resumed at a stop: its instruction runs first */
    this.leaving = false;
    /** @private fractions of a cycle carried between slow frames */
    this.carry = 0;
    /** The memory traffic of the last frame (the CPU tool's map, Inside's lit chips). */
    this.traffic = this.machine.takeTraffic();
    /** The speed the machine ran at in the last frame, against real time (below 1: it fell behind). */
    this.speed = 1;
    /** What the visitor should be told. @type {(m: Message) => void} */
    this.say = () => {};
    /** Something the views show changed: the power, the TV, the box. @type {(() => void)[]} */
    this.onChange = [];
    /** @private keys the typist pressed, and until when they show down (performance.now() ms) @type {Map<string, number>} */
    this.typed = new Map();
    /** @private the wall clock, ms */
    this.now = 0;
    /** @private CEC-BASIC's keyword names, read from U7 when first needed @type {string[] | undefined} */
    this.names = undefined;
    /** Who holds each key; a key goes down on the machine when the first holder takes it. */
    this.holds = new KeyHolds((id, down) => (down ? this.keyboard.down(id) : this.keyboard.up(id)));
    this.typist.onKey = (code) => {
      const s = this.keyboard.strokeFor(code);
      if (!s) return;
      this.keyboard.last = this.keyboard.lookup(s.id, { shift: s.shift, ctrl: s.ctrl, caps: true });
      const until = this.now + TYPED_MS;
      this.typed.set(s.id, until);
      if (s.shift) this.typed.set("lshift", until);
      if (s.ctrl) this.typed.set("ctrl", until);
    };
  }

  /** @private */
  changed() {
    for (const f of this.onChange) f();
  }

  // ---- power and the TV ---------------------------------------------------------------------

  /** Whether every unit is in, and nothing moving. */
  get whole() {
    return [...this.motion.values()].every((m) => m.f === 0 && m.target === 0);
  }

  /**
   * The computer's power switch. Refused while the computer is apart.
   * @param {boolean} on
   * @returns {boolean} whether it changed
   */
  power(on) {
    const m = this.machine;
    if (on === m.powered) return false;
    if (on && !this.whole) {
      const unit = [...this.motion].find(([, v]) => v.f > 0 || v.target > 0)?.[0] ?? "";
      this.say({ key: "power.apart", params: { unit } });
      return false;
    }
    if (on && !this.hasRoms) {
      this.say({ key: "power.noRoms" });
      return false;
    }
    this.typist.clear();
    this.keyboard.releaseAll();
    this.resume();
    this.stops.clear();
    if (on) m.powerOn();
    else m.powerOff();
    this.say({ key: on ? (this.tv.on ? "power.on" : "power.onTvOff") : "power.off" });
    this.changed();
    return true;
  }

  /** The TV's power button. @param {boolean} on */
  tvPower(on) {
    if (on === this.tv.on) return;
    this.tv.on = on;
    this.say({ key: on ? (this.machine.powered ? "tv.on" : "tv.onNoComputer") : "tv.off" });
    this.changed();
  }

  /**
   * One of the TV's knobs, 0..1.
   * @param {Knob} which
   * @param {number} value
   */
  setKnob(which, value) {
    const v = Math.min(1, Math.max(0, value));
    if (v === this.tv[which]) return;
    this.tv[which] = v;
    // a black-and-white TV or a green monitor has no colour to turn: the knob turns, nothing changes (D6)
    if (which === "colour" && this.video.display !== "colour") this.say({ key: `knob.colourNone.${this.video.display}` });
    else this.say({ key: `knob.${which}`, params: { value: Math.round(v * 100) } });
    this.changed();
  }

  /**
   * The colour knob as the picture takes it: as turned on a colour TV; on a black-and-white
   * TV or a green monitor, which have no colour control, where it is set up (D6).
   */
  get colourKnob() {
    return this.video.display === "colour" ? this.tv.colour : KNOB_START.colour;
  }

  /** A knob back to where it starts: a double-click on it. @param {Knob} which */
  resetKnob(which) {
    this.setKnob(which, KNOB_START[which]);
  }

  /** Whether both knobs are where they start. */
  get knobsAtStart() {
    return this.tv.brightness === KNOB_START.brightness && this.tv.colour === KNOB_START.colour;
  }

  /** Both knobs back to where they start: Display's Reset the knobs. */
  resetKnobs() {
    this.tv.brightness = KNOB_START.brightness;
    this.tv.colour = KNOB_START.colour;
    this.say({ key: "knobs.reset" });
    this.changed();
  }

  /** The set the computer is plugged into (D6). @param {Display} d */
  setDisplay(d) {
    if (d === this.video.display) return;
    this.video.display = d;
    this.say({ key: `display.${d}` });
    this.changed();
  }

  // ---- keys -----------------------------------------------------------------------------------

  /**
   * A key pressed, by the visitor's keyboard or the pointer. A pointer's Ctrl, Shift or TEST
   * stays down until the next key (js/sim/key-holds.js).
   * @param {string} id
   * @param {Source} by
   * @returns {boolean} for a pointer: whether it is now a held modifier
   */
  keyDown(id, by) {
    if (by === "key") {
      this.holds.hostDown(id);
      return false;
    }
    return this.holds.pointerDown(id);
  }

  /** @param {string} id @param {Source} by */
  keyUp(id, by) {
    if (by === "key") this.holds.hostUp(id);
    else this.holds.pointerUp(id);
  }

  /**
   * Ctrl-Reset, from the helper strip: Ctrl and RESET down together, held a moment, let go.
   * @param {(f: () => void, ms: number) => void} [later]
   */
  ctrlReset(later = (f, ms) => void setTimeout(f, ms)) {
    if (!this.machine.powered) {
      this.say({ key: "reset.off" });
      return false;
    }
    this.holds.pointerDown("ctrl");
    this.holds.pointerDown("reset");
    this.say({ key: "reset.done" });
    // the pointer lets go of RESET, and the held Ctrl goes with it
    later(() => this.holds.pointerUp("reset", true), RESET_HOLD_MS);
    return true;
  }

  /** The page lost the keyboard: every key the visitor's keyboard held goes up, and the joystick's arrows and buttons. */
  releaseKeys() {
    this.holds.blur();
    if (this.joystick.on) this.joystick.release();
  }

  /** Plugs the joystick in, or pulls it out (the helper strip's Joystick). @param {boolean} on */
  setJoystick(on) {
    if (on === this.joystick.on) return;
    this.joystick.plug(on);
    this.joystick.apply(this.machine);
    this.say({ key: on ? "joystick.on" : "joystick.off" });
    this.changed();
  }

  /**
   * The keys shown down in the views: held by anyone, or typed a moment ago. (Caps Lock
   * latched is keyboard.caps: it sits lower, not fully down.)
   * @returns {Set<string>}
   */
  keysDown() {
    const s = new Set([...this.holds.host, ...this.holds.sticky, ...this.holds.pointer]);
    for (const [id, until] of this.typed) if (until > this.now) s.add(id);
    return s;
  }

  /**
   * Keys for the typist, as they are: {name} for the CEC's own keys (js/sim/keyboard.js,
   * CODES). For the tests and the page's own steps; a visitor's text goes through typeIn().
   * @param {string} keys
   * @returns {boolean} whether it was taken
   */
  type(keys) {
    if (!this.machine.powered) {
      this.say({ key: "type.off" });
      return false;
    }
    this.typist.type(keys);
    return true;
  }

  /** Whether the Chinese system is on: it reads the keyboard through its own routine, at $C303. */
  get chineseOn() {
    const r = this.machine.ram;
    return this.machine.powered && (r[0x38] | (r[0x39] << 8)) === 0xc303;
  }

  /**
   * Types a visitor's text on the machine's keys, as a person would (Type in, D8): letters as
   * the keys give them with Caps Lock as it is (down, as the machine starts: capitals);
   * Chinese through the Chinese system's 区位 input, the 中文 key pressed first if it is not on.
   * A character the machine cannot type (not ASCII, not in GB2312) refuses the whole text.
   * @param {string} text
   * @param {{ program?: boolean }} [o] program: a BASIC program, NEW typed first so that no old line stays
   * @returns {boolean} whether it was taken
   */
  typeIn(text, o = {}) {
    if (!this.machine.powered) {
      this.say({ key: "type.off" });
      return false;
    }
    const caps = this.keyboard.caps;
    const plan = planTyping(caps ? text.replace(/[a-z]/g, (c) => c.toUpperCase()) : text);
    if (plan.refused.length) {
      this.say({ key: "type.refused", params: { chars: plan.refused.slice(0, 8).join(" ") } });
      return false;
    }
    let keys = (o.program ? "NEW\n" : "") + plan.keys;
    if (plan.chinese && !this.chineseOn) keys = `{zhongwen}{wait:${CHINESE_START_S}}${keys}`;
    this.typist.type(keys);
    this.say({ key: plan.chinese && !this.chineseOn ? "type.chinese" : "type.typing" });
    return true;
  }

  /** The BASIC program in memory as text (Save the program), or "" for none. */
  listing() {
    if (!this.machine.powered) return "";
    this.names ??= tokenNames(this.machine.roms.u7);
    return listProgram(this.machine, this.names);
  }

  // ---- taking it apart ------------------------------------------------------------------------

  /**
   * A click on a unit: out, with whatever is in its way first; or, if it is out, back, with
   * whatever sits on it first. Refused while the computer is on.
   * @param {string} unit
   */
  toggleUnit(unit) {
    if (this.machine.powered) {
      this.say({ key: "apart.poweredOn" });
      return false;
    }
    const m = this.motion.get(unit);
    if (!m) return false;
    const out = m.target === 0;
    // planned by where units are going, not where they are, so that a click while parts move
    // keeps the rule: a unit going out has everything it requires going out too, and a unit
    // going back everything that sits on it going back
    /** @type {Set<string>} */
    const plan = new Set();
    /** @param {string} u */
    const visit = (u) => {
      if (plan.has(u)) return;
      plan.add(u);
      if (out) for (const r of this.order.find((s) => s.unit === u)?.requires ?? []) visit(r);
      else for (const s of this.order) if (s.requires.includes(u)) visit(s.unit);
    };
    visit(unit);
    for (const u of plan) {
      const v = /** @type {Motion} */ (this.motion.get(u));
      v.target = out ? 1 : 0;
      v.rate = 1 / OUT_S;
    }
    this.say({ key: out ? "apart.out" : "apart.in", params: { unit } });
    this.changed();
    return true;
  }

  /** Takes every unit out, in order (the 3D view Taken apart). */
  takeAllApart() {
    if (this.machine.powered) {
      this.say({ key: "apart.poweredOn" });
      return false;
    }
    for (const v of this.motion.values()) {
      v.target = 1;
      v.rate = 1 / OUT_S;
    }
    this.say({ key: "apart.all" });
    this.changed();
    return true;
  }

  /** Put it all back: everything goes back quickly, in order. */
  putAllBack() {
    for (const v of this.motion.values()) {
      v.target = 0;
      v.rate = 1 / BACK_S;
    }
    this.say({ key: "apart.back" });
    this.changed();
  }

  /** Puts everything back at once (going to 2D, which always shows a whole machine). @returns {boolean} whether anything was out */
  putBackNow() {
    let any = false;
    for (const v of this.motion.values()) {
      if (v.f || v.target) any = true;
      v.f = v.target = 0;
    }
    if (any) this.changed();
    return any;
  }

  /**
   * Moves the units one at a time, in the order the machine allows: out, the first in order
   * whose requirements are wholly out; back, the last in order whose dependants are wholly in.
   * @param {number} dt seconds
   * @returns {boolean} whether anything moved
   */
  stepMotion(dt) {
    const mo = (/** @type {string} */ u) => /** @type {Motion} */ (this.motion.get(u));
    for (let i = this.order.length - 1; i >= 0; i--) {
      const unit = this.order[i].unit;
      const m = mo(unit);
      if (m.f <= m.target) continue;
      if (this.order.some((s) => s.requires.includes(unit) && mo(s.unit).f > 0)) continue;
      m.f = Math.max(m.target, m.f - dt * m.rate);
      if (m.f === 0) this.changed();
      return true;
    }
    for (const s of this.order) {
      const m = mo(s.unit);
      if (m.f >= m.target) continue;
      if (s.requires.some((r) => mo(r).f < 1)) continue;
      m.f = Math.min(m.target, m.f + dt * m.rate);
      if (m.f === 1) this.changed();
      return true;
    }
    return false;
  }

  // ---- each frame -------------------------------------------------------------------------------

  /**
   * A frame: the machine runs the time it is worth (faster while typing in), the units move.
   * @param {number} dt seconds of wall time since the last frame
   * @param {number} [now] the wall clock, ms (performance.now())
   * @returns {number} the cycles run
   */
  frame(dt, now = performance.now()) {
    this.now = now;
    for (const [id, until] of this.typed) if (until <= now) this.typed.delete(id);
    this.stepMotion(dt);
    const m = this.machine;
    this.joystick.step(Math.min(dt, MAX_DT));
    this.joystick.apply(m);
    this.traffic = m.takeTraffic();
    if (!m.powered || this.paused) return 0;
    const boost = this.typist.busy && this.fastTyping ? FAST_TYPING : 1;
    const exact = Math.min(dt, MAX_DT) * CLOCK_HZ * boost * this.speedSet + this.carry;
    const want = Math.floor(exact);
    this.carry = exact - want;
    const start = m.cycles;
    const end = start + want;
    const t0 = performance.now();
    while (m.cycles < end && m.powered) {
      this.keyboard.tick();
      this.typist.tick();
      const slice = Math.min(SLICE, end - m.cycles);
      const ran = m.run(slice, this.stops, this.leaving);
      if (ran > 0) this.leaving = false;
      if (ran < slice && this.stops.size) {
        // at a stop: paused there
        this.paused = true;
        const pc = m.cpu.pc;
        this.stops.clear();
        this.onStop(pc);
        break;
      }
      // too slow a device to keep up: run slow rather than freeze the page
      if (performance.now() - t0 > this.frameBudgetMs) break;
    }
    const ran = m.cycles - start;
    this.speed = want > 0 ? ran / want : 1;
    return ran;
  }

  /** Whether the last frame ran at another speed than real time (no sound then). */
  get racing() {
    return (this.typist.busy && this.fastTyping) || this.speedSet !== 1 || this.paused;
  }

  // ---- the CPU tool's clock -----------------------------------------------------------------------

  /** Pause: nothing runs, the keys and the typist wait too, until resume() or step(). */
  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.leaving = true;
  }

  /** One instruction, the keyboard and the typist ticked first; only while paused. @returns {number} its cycles */
  step() {
    if (!this.paused || !this.machine.powered) return 0;
    this.keyboard.tick();
    this.typist.tick();
    return this.machine.step();
  }

  /** Runs until the 6502 is about to run the instruction at an address, then pauses there. @param {number} addr */
  runTo(addr) {
    this.stops.clear();
    this.stops.add(addr & 0xffff);
    this.paused = false;
    this.leaving = true;
  }

  /** The clock's speed against the real machine's: 1, 0.1, 0.01 or 0.001. @param {number} s */
  setSpeed(s) {
    this.speedSet = s;
    this.carry = 0;
  }
}
