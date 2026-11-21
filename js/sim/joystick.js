// SPDX-License-Identifier: Apache-2.0
//
// The joystick (design/v0.0.3.md, P2), played on the visitor's keys or the phone's pad: a spring
// stick of the time on the game port, its two axes paddles 0 and 1 (0 to 255, 128 at rest), and
// its two buttons, 0 the main action and 1 the second. An arrow held pushes the stick to that
// edge in SWING_S; let go, it springs back to the centre. Unplugged (the switch off), the port
// reads as it does with nothing in it: the paddles 255, the buttons up.

/** @typedef {"left" | "right" | "up" | "down"} Direction */

/** How long the stick takes from the centre to an edge, s. */
export const SWING_S = 0.2;
/** Where the stick rests. */
export const CENTRE = 128;
/** What a paddle reads with nothing plugged in. */
export const UNPLUGGED = 255;

export class Joystick {
  constructor() {
    /** Whether it is plugged in. */
    this.on = false;
    /** The arrows held, each by how many keys or pad buttons. @type {Map<Direction, number>} */
    this.held = new Map();
    /** The buttons held, each by how many keys or pad buttons. */
    this.pressed = [0, 0];
    /** Where the stick is, 0 to 255 on each axis. */
    this.x = CENTRE;
    this.y = CENTRE;
  }

  /** Plugs it in, centred, or pulls it out, everything let go. @param {boolean} on */
  plug(on) {
    this.on = on;
    this.release();
  }

  /** Lets go of every arrow and button (the page lost the keyboard). */
  release() {
    this.held.clear();
    this.pressed = [0, 0];
    this.x = this.y = CENTRE;
  }

  /** An arrow pressed or let go. @param {Direction} d @param {boolean} down */
  push(d, down) {
    const n = Math.max(0, (this.held.get(d) ?? 0) + (down ? 1 : -1));
    if (n) this.held.set(d, n);
    else this.held.delete(d);
  }

  /** A button pressed or let go. @param {0 | 1} b @param {boolean} down */
  button(b, down) {
    this.pressed[b] = Math.max(0, this.pressed[b] + (down ? 1 : -1));
  }

  /** Where the stick goes: an edge while its arrow is held (both, or none: the centre). */
  get target() {
    const axis = (/** @type {Direction} */ lo, /** @type {Direction} */ hi) => (this.held.has(lo) === this.held.has(hi) ? CENTRE : this.held.has(lo) ? 0 : 255);
    return { x: axis("left", "right"), y: axis("up", "down") };
  }

  /** The stick moves for dt seconds towards where it is pushed. @param {number} dt */
  step(dt) {
    const max = ((255 - CENTRE) / SWING_S) * dt;
    const to = this.target;
    const move = (/** @type {number} */ at, /** @type {number} */ goal) => (Math.abs(goal - at) <= max ? goal : at + Math.sign(goal - at) * max);
    this.x = move(this.x, to.x);
    this.y = move(this.y, to.y);
  }

  /**
   * The game port as the machine reads it.
   * @param {{ paddles: number[], buttons: boolean[] }} m
   */
  apply(m) {
    m.paddles[0] = this.on ? Math.round(this.x) : UNPLUGGED;
    m.paddles[1] = this.on ? Math.round(this.y) : UNPLUGGED;
    m.buttons[0] = this.on && this.pressed[0] > 0;
    m.buttons[1] = this.on && this.pressed[1] > 0;
  }
}

/**
 * What a key of the visitor's does to the joystick while it is plugged in: an arrow moves the
 * stick (and the machine does not see it); Space is button 0 and Ctrl button 1, and the machine
 * gets them too, so that a space can still be typed and Ctrl still works.
 * @param {string} code KeyboardEvent.code
 * @returns {{ stick: Direction } | { button: 0 | 1 } | null}
 */
export function joystickKey(code) {
  const arrow = /** @type {Record<string, Direction>} */ ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" })[code];
  if (arrow) return { stick: arrow };
  if (code === "Space") return { button: 0 };
  if (code === "ControlLeft" || code === "ControlRight") return { button: 1 };
  return null;
}
