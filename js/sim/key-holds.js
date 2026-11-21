// SPDX-License-Identifier: Apache-2.0
//
// Who holds each CEC-I key down: the visitor's own keyboard, the pointer, or a pointer-held
// modifier. Shared by every view (the 3D keys, the 2D keyboard, the helper strip), so that no
// key is left stuck down.
//
// - Ctrl, Shift and TEST clicked with the pointer stay down ("sticky") until they are clicked
//   again, or until another key is clicked and let go: so Ctrl, then RESET, gives Ctrl-Reset,
//   and Ctrl, TEST, RESET the manuals' Ctrl-Reset-TEST, with the mouse alone. A click on RESET
//   holds it down at least RESET_HOLD_MS.
// - A key let go while the page had no focus (a Mac's Ctrl-click opens the browser's menu,
//   which takes the keyboard) never sends its keyup: every pointer and key event carries the
//   real state of Ctrl and Shift, and these release what is no longer held; losing the focus
//   releases everything your keyboard held.

/** A click on RESET holds it at least this long (ms): a key's repeat (about 8 a second) must
 * come while the line is held for a held TEST to be waiting when the reset runs (js/sim/machine.js). */
export const RESET_HOLD_MS = 300;

/** Keys the pointer holds down until the next key. */
export const STICKY = new Set(["ctrl", "lshift", "rshift", "test"]);

export class KeyHolds {
  /**
   * @param {(id: string, down: boolean) => void} set the key really goes down or up
   * @param {{ now: () => number, later: (f: () => void, ms: number) => void }} [clock]
   */
  constructor(set, clock = { now: () => performance.now(), later: (f, ms) => void setTimeout(f, ms) }) {
    this.set = set;
    this.clock = clock;
    /** When the pointer put RESET down (ms). */
    this.resetAt = 0;
    /** Held by your own keyboard. @type {Set<string>} */
    this.host = new Set();
    /** Held by the pointer until the next key. @type {Set<string>} */
    this.sticky = new Set();
    /** Held by the pointer now (a key pressed and not yet let go). @type {Set<string>} */
    this.pointer = new Set();
  }

  /** @param {string} id */
  held(id) {
    return this.host.has(id) || this.sticky.has(id) || this.pointer.has(id);
  }

  /** @param {string} id */
  hostDown(id) {
    this.host.add(id);
    this.set(id, true);
  }

  /** @param {string} id */
  hostUp(id) {
    this.host.delete(id);
    if (!this.sticky.has(id) && !this.pointer.has(id)) this.set(id, false);
  }

  /** A click goes down on a key. @param {string} id @returns {boolean} whether it is now a held modifier */
  pointerDown(id) {
    if (STICKY.has(id)) {
      if (this.sticky.delete(id)) {
        if (!this.host.has(id)) this.set(id, false);
        return false;
      }
      this.sticky.add(id);
      this.set(id, true);
      return true;
    }
    if (id === "reset") this.resetAt = this.clock.now();
    this.pointer.add(id);
    this.set(id, true);
    return false;
  }

  /**
   * The click comes up.
   * @param {string} id
   * @param {boolean} [held] RESET has been held long enough already (the helper strip's Ctrl-Reset)
   */
  pointerUp(id, held = false) {
    if (STICKY.has(id)) return;
    const wait = id === "reset" && !held ? RESET_HOLD_MS - (this.clock.now() - this.resetAt) : 0;
    if (wait > 0) return this.clock.later(() => this.pointerUp(id), wait + 1);
    this.pointer.delete(id);
    if (!this.host.has(id)) this.set(id, false);
    for (const s of [...this.sticky]) {
      this.sticky.delete(s);
      if (!this.host.has(s)) this.set(s, false);
    }
  }

  /** Release the modifiers your keyboard no longer holds (their keyup lost). @param {{ ctrlKey: boolean, shiftKey: boolean }} e */
  sync(e) {
    if (!e.ctrlKey && this.host.has("ctrl")) this.hostUp("ctrl");
    if (!e.shiftKey) for (const s of ["lshift", "rshift"]) if (this.host.has(s)) this.hostUp(s);
  }

  /** The page lost the focus: let go of everything your keyboard held. */
  blur() {
    for (const id of [...this.host]) this.hostUp(id);
  }
}
