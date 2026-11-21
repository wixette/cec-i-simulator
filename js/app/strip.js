// SPDX-License-Identifier: Apache-2.0
//
// The helper strip (docs/ui-design.md, U4): the controls that are hard to reach on the machine
// itself, as large buttons in one strip at the stage's foot, centred, in 2D and in 3D: the
// computer's power switch (a rocker on its left side), Ctrl-Reset (two keys at once, at the
// keyboard's two ends), the TV's power button, and the joystick plugged in or out
// (design/v0.0.3.md, P2). They are not parts of the machine, so they
// speak in the instrument's voice (P5). Each is the same operation as the control on the
// machine (P2), and one that cannot act now is greyed and still answers, saying why (P6). A tab
// on the strip's top edge folds it away, and the choice is remembered. As the TRS-80
// simulator's (https://github.com/wixette/trs-80-simulator, Apache-2.0, by the same author).

import { t } from "../l10n/l10n.js";
import { el, icon, setTip } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */

const STORE = "ceci.strip";

export class HelperStrip {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   */
  constructor(host, system) {
    this.system = system;
    const s = system;
    /** @param {import("../ui/components.js").IconName} ic @param {string} label @param {string} tip @param {() => void} run */
    const button = (ic, label, tip, run) => {
      const b = el("button", { class: "btn tonal small has-icon", type: "button" }, [icon(ic), el("span", { class: "strip-label", text: label })]);
      b.setAttribute("data-tip-describes", "");
      setTip(b, tip);
      // the strip's buttons never take the keyboard's focus from the machine
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", run);
      return b;
    };
    this.powerBtn = button("power_settings_new", t("strip.computer"), t("strip.computer.tip"), () => s.power(!s.machine.powered));
    this.resetBtn = button("restart_alt", t("strip.reset"), t("strip.reset.tip"), () => s.ctrlReset());
    this.tvBtn = button("tv", t("strip.tv"), t("strip.tv.tip"), () => s.tvPower(!s.tv.on));
    this.joyBtn = button("joystick", t("strip.joystick"), t("strip.joystick.tip"), () => s.setJoystick(!s.joystick.on));
    this.body = el("div", { class: "strip-body", id: "strip-body", role: "group", "aria-label": t("strip.label") }, [
      el("div", { class: "strip-group" }, [this.powerBtn, this.resetBtn]),
      el("div", { class: "strip-group" }, [this.tvBtn, this.joyBtn]),
    ]);
    this.tab = el("button", { class: "strip-tab", type: "button", "aria-controls": "strip-body" }, [icon("keyboard_arrow_down")]);
    this.tab.addEventListener("click", () => this.setFolded(!this.folded));
    host.append(this.tab, this.body);
    this.host = host;
    /** @private */
    this.shownKey = "";
    // at first folded only in a short window (a phone on its side), where the stage needs the room
    let folded = window.innerHeight <= 520;
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) folded = saved === "folded";
    } catch {
      // not remembered
    }
    this.folded = folded;
    this.setFolded(folded, false);
  }

  /** Folds the strip away to its tab, or brings it back. @param {boolean} folded @param {boolean} [remember] */
  setFolded(folded, remember = true) {
    this.folded = folded;
    this.host.classList.toggle("folded", folded);
    this.tab.setAttribute("aria-expanded", String(!folded));
    setTip(this.tab, t(folded ? "strip.unfold" : "strip.fold"));
    if (!remember) return;
    try {
      localStorage.setItem(STORE, folded ? "folded" : "shown");
    } catch {
      // not remembered
    }
  }

  /** The buttons' states: called each frame, and does the work only on a change. */
  refresh() {
    const s = this.system;
    const key = `${s.machine.powered}${s.tv.on}${s.joystick.on}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.powerBtn.classList.toggle("lit", s.machine.powered);
    this.powerBtn.setAttribute("aria-pressed", String(s.machine.powered));
    this.tvBtn.classList.toggle("lit", s.tv.on);
    this.tvBtn.setAttribute("aria-pressed", String(s.tv.on));
    this.resetBtn.setAttribute("aria-disabled", String(!s.machine.powered));
    this.joyBtn.classList.toggle("lit", s.joystick.on);
    this.joyBtn.setAttribute("aria-pressed", String(s.joystick.on));
  }
}
