// SPDX-License-Identifier: Apache-2.0
//
// The Keyboard tool (docs/ui-design.md, U12): how a key becomes a byte, a view the real machine
// never had. The keyboard's matrix, eight X lines the encoder KB3600 (U25) drives by the nine Y
// lines it reads back (Y0-Y8: the CEC-I's keys use no more), each key at a crossing, lit while
// it is down; Ctrl, the Shifts, Caps
// Lock and Reset on lines of their own. Then the last key's code: its group, 10 X + Y, and the
// byte's address in the keyboard ROM U26 (Caps Lock up adds $200; four bytes a group: plain,
// Shift, Ctrl, both). And the latch the program reads at $C000, its strobe in bit 7, cleared
// by reading $C010.

import { t } from "../../l10n/l10n.js";
import { hex } from "../../sim/disasm.js";
import { el } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */

/** The Y lines the keys use. */
const Y_LINES = 9;

/** A code as it shows: the character, or ^X for a control code. @param {number} code */
const showCode = (code) => (code < 32 ? `^${String.fromCharCode(code + 64)}` : code === 127 ? "DEL" : code === 32 ? "␠" : String.fromCharCode(code));

export class KeyboardTool {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   * @param {{ id: string, legends: string[], arrow?: string }[]} keys model/params/keyboard.json's keys, for their legends
   */
  constructor(host, system, keys) {
    this.system = system;
    /** @private */
    this.since = 1;
    /** @private what the matrix showed last */
    this.shownDown = "";
    const legend = (/** @type {string} */ id) => {
      const k = keys.find((x) => x.id === id);
      if (!k) return id;
      if (k.arrow) return { up: "▲", down: "▼", left: "◀", right: "▶" }[k.arrow] ?? id;
      if (id === "space") return "␠";
      return k.legends.length === 2 && k.legends.every((l) => l.length === 1) ? k.legends[0] : k.legends.join(" ");
    };
    const matrix = system.keyboard.matrix;
    /** @type {Map<string, HTMLElement>} */
    this.keyCells = new Map();
    const grid = el("div", { class: "matrix", role: "table", "aria-label": t("kbd.matrix") });
    const head = el("div", { class: "matrix-row matrix-head kbd-head", role: "row" }, [el("span", { text: "" }), ...Array.from({ length: Y_LINES }, (_, y) => el("span", { class: "mx-key none", text: `Y${y}` }))]);
    grid.append(head);
    for (let x = 0; x < 8; x++) {
      const row = el("div", { class: "matrix-row kbd-row", role: "row" }, [el("span", { class: "mx-addr", text: `X${x}` })]);
      for (let y = 0; y < Y_LINES; y++) {
        const id = Object.keys(matrix).find((k) => {
          const at = matrix[k];
          return Array.isArray(at) && at[0] === x && at[1] === y;
        });
        const cell = el("span", { class: `mx-key${id ? "" : " none"}`, text: id ? legend(id) : "" });
        if (id) this.keyCells.set(id, cell);
        row.append(cell);
      }
      grid.append(row);
    }
    const own = el("div", { class: "matrix-row kbd-own", role: "row" }, [el("span", { class: "mx-addr", text: t("kbd.ownLines") })]);
    for (const id of ["ctrl", "lshift", "rshift", "capslock", "reset"]) {
      const cell = el("span", { class: "mx-key", text: legend(id) });
      this.keyCells.set(id, cell);
      own.append(cell);
    }
    grid.append(own);
    this.latch = el("div", { class: "kbd-latch" });
    this.lookup = el("div", { class: "lookup", "aria-live": "polite" });
    host.append(
      el("p", { class: "caveat", text: t("tools.caveat") }),
      el("div", { class: "tool" }, [
        el("section", { class: "cpu-box tool-card" }, [el("h3", { text: t("kbd.matrix") }), grid, el("p", { class: "tool-note dim", text: t("kbd.matrix.note") })]),
        el("div", { class: "tool-side" }, [
          el("section", { class: "cpu-box tool-card" }, [el("h3", { text: t("kbd.latch") }), this.latch, el("p", { class: "tool-note dim", text: t("kbd.latch.note") })]),
          el("section", { class: "cpu-box tool-card" }, [el("h3", { text: t("kbd.u26") }), this.lookup]),
        ]),
      ]),
    );
  }

  /** Called each frame while shown. @param {number} dt */
  tick(dt) {
    const s = this.system;
    const down = s.keysDown();
    const kb = s.keyboard;
    const key = [...down].sort().join(",") + (kb.caps ? "|caps" : "");
    if (key !== this.shownDown) {
      this.shownDown = key;
      for (const [id, cell] of this.keyCells) cell.classList.toggle("down", down.has(id) || (id === "capslock" && kb.caps));
    }
    this.since += dt;
    if (this.since < 0.1) return;
    this.since = 0;
    const m = s.machine;
    const v = m.kbd | (m.strobe ? 0x80 : 0);
    this.latch.replaceChildren(
      el("span", { text: "$C000" }),
      el("b", { text: m.powered ? `$${hex(v, 2)}` : "––" }),
      el("span", { class: "dim", text: m.powered ? t("kbd.latchIs", { code: showCode(m.kbd), strobe: m.strobe ? 1 : 0 }) : t("cpu.off") }),
    );
    const l = kb.last;
    this.lookup.textContent = !l
      ? t("kbd.pressAKey")
      : [
          t("kbd.lookup.key", { key: l.id, x: l.x, y: l.y }),
          t("kbd.lookup.group", { x: l.x, y: l.y, group: l.group }),
          `${l.caps ? "" : "$200 + "}4 × ${l.group}${l.shift ? " + 1" : ""}${l.ctrl ? " + 2" : ""} = $${hex(l.addr, 3)}   (${[l.caps ? "Caps Lock" : "", l.shift ? "Shift" : "", l.ctrl ? "Ctrl" : ""].filter(Boolean).join(", ") || t("kbd.lookup.plain")})`,
          t("kbd.lookup.code", { addr: hex(l.addr, 3), code: hex(l.code, 2), dec: l.code, ch: showCode(l.code) }),
        ].join("\n");
  }
}
