// SPDX-License-Identifier: Apache-2.0
//
// The joystick's pad for a touch screen (design/v0.0.3.md, P2): on a phone there are no arrow
// keys, so while the joystick is plugged in, a row under the picture holds four arrows on the
// left and the two buttons, A (button 0) and B (button 1), on the right, where the thumbs are,
// leaving the machine's keys free to tap. Each holds while pressed, several at once.

import { t } from "../l10n/l10n.js";
import { el } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../sim/joystick.js").Direction} Direction */

/** Whether the screen is a touch one: the pad shows only there. */
const touch = () => matchMedia("(pointer: coarse)").matches;

export class JoyPad {
  /** @param {HTMLElement} before what the pad goes in front of (the helper strip) @param {System} system */
  constructor(before, system) {
    this.system = system;
    /**
     * A pad button: pressed while a pointer is down on it.
     * @param {string} cls @param {string} text @param {string} label @param {(down: boolean) => void} act
     */
    const key = (cls, text, label, act) => {
      const b = el("button", { class: `joypad-key ${cls}`, type: "button", "aria-label": label, text });
      /** @type {Set<number>} */
      const pointers = new Set();
      const down = (/** @type {PointerEvent} */ e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        if (!pointers.size) act(true);
        pointers.add(e.pointerId);
        b.classList.add("held");
      };
      const up = (/** @type {PointerEvent} */ e) => {
        if (!pointers.delete(e.pointerId)) return;
        if (!pointers.size) {
          act(false);
          b.classList.remove("held");
        }
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", up);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      return b;
    };
    const js = system.joystick;
    const arrow = (/** @type {Direction} */ d, /** @type {string} */ text) => key(`arrow ${d}`, text, t(`joypad.${d}`), (down) => js.push(d, down));
    this.el = el("div", { class: "joypad", role: "group", "aria-label": t("joypad.label"), hidden: true }, [
      el("div", { class: "joypad-arrows" }, [arrow("up", "▲"), arrow("left", "◀"), arrow("right", "▶"), arrow("down", "▼")]),
      el("div", { class: "joypad-buttons" }, [key("b", "B", t("joypad.b"), (down) => js.button(1, down)), key("a", "A", t("joypad.a"), (down) => js.button(0, down))]),
    ]);
    before.before(this.el);
    /** @private */
    this.shown = false;
  }

  /** Shown while the joystick is plugged in, on a touch screen: called each frame, works only on a change. */
  refresh() {
    const show = this.system.joystick.on && touch();
    if (show === this.shown) return;
    this.shown = show;
    this.el.hidden = !show;
  }
}
