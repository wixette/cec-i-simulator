// SPDX-License-Identifier: Apache-2.0
//
// The Screen tool (docs/ui-design.md, U12): the picture as memory, a view the real machine
// never had. The display's soft switches and what they show; the text (and lo-res) page as
// its 40 x 24 bytes, row by row at their interleaved addresses, live, a cell picked to see its
// byte become a character from the character ROM U13 (or two lo-res blocks); and one hi-res
// line: its address, worked out, and its 40 bytes as dots, bit 7 the half-dot shift.

import { t } from "../../l10n/l10n.js";
import { hex } from "../../sim/disasm.js";
import { hiresLineBase, LORES, textRowBase } from "../../sim/video.js";
import { el, setTip } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */

export class ScreenTool {
  /** @param {HTMLElement} host @param {System} system */
  constructor(host, system) {
    this.system = system;
    /** The cell picked: its row and column, or null. @type {{ row: number, col: number } | null} */
    this.picked = { row: 0, col: 0 };
    /** The hi-res line shown. */
    this.line = 0;
    /** @private seconds since the last redraw */
    this.since = 1;
    this.switches = el("div", { class: "switches", "aria-label": t("screen.switches") });
    this.shows = el("p", { class: "tool-note" });
    this.grid = el("div", { class: "page-grid", role: "grid", "aria-label": t("screen.page") });
    /** @type {HTMLButtonElement[]} */
    this.cells = [];
    for (let row = 0; row < 24; row++) {
      const head = el("span", { class: "rowhead" });
      this.grid.append(head);
      for (let col = 0; col < 40; col++) {
        const c = /** @type {HTMLButtonElement} */ (el("button", { class: "page-cell", type: "button", "aria-label": `${row}, ${col}` }));
        c.addEventListener("click", () => {
          this.picked = { row, col };
          this.since = 1;
        });
        this.grid.append(c);
        this.cells.push(c);
      }
    }
    this.inspector = el("div", { class: "kv-box" });
    this.lineRange = /** @type {HTMLInputElement} */ (el("input", { type: "range", min: "0", max: "191", value: "0", "aria-label": t("screen.line") }));
    this.lineRange.addEventListener("input", () => {
      this.line = Number(this.lineRange.value);
      this.since = 1;
    });
    this.lineLabel = el("span", { class: "mono" });
    this.lineAddr = el("p", { class: "tool-note mono" });
    this.lineBytes = el("div", { class: "hires-line" });
    host.append(
      el("p", { class: "caveat", text: t("tools.caveat") }),
      el("div", { class: "tool" }, [
        el("section", { class: "cpu-box tool-card" }, [el("h3", { text: t("screen.page") }), this.switches, this.shows, this.grid]),
        el("div", { class: "tool-side" }, [
          el("section", { class: "cpu-box tool-card" }, [el("h3", { text: t("screen.cell") }), this.inspector]),
          el("section", { class: "cpu-box tool-card" }, [el("h3", { text: t("screen.hires") }), el("p", { class: "tool-note dim", text: t("screen.hires.note") }), el("div", { class: "line-pick" }, [this.lineRange, this.lineLabel]), this.lineAddr, this.lineBytes]),
        ]),
      ]),
    );
  }

  /** Called each frame while shown. @param {number} dt */
  tick(dt) {
    this.since += dt;
    if (this.since < 0.15) return;
    this.since = 0;
    const m = this.system.machine;
    const on = m.powered;
    // the switches
    const sw = /** @type {[string, boolean, string][]} */ ([
      ["TEXT", m.text, "screen.sw.text"],
      ["MIXED", m.mixed, "screen.sw.mixed"],
      ["PAGE2", m.page2, "screen.sw.page2"],
      ["HIRES", m.hires, "screen.sw.hires"],
      ["ALTCHAR", m.altchar, "screen.sw.altchar"],
      ["$C0B0.4", !!(m.c0b0 & 0x10), "screen.sw.colour"],
    ]);
    if (!this.switches.childElementCount)
      this.switches.replaceChildren(
        ...sw.map(([n, , tip]) => {
          const e = el("span", { class: "switch-chip", text: n });
          setTip(e, t(tip));
          return e;
        }),
      );
    sw.forEach(([, v], i) => this.switches.children[i].classList.toggle("on", on && v));
    const page2 = m.shownPage2;
    const textBase = page2 ? 0x800 : 0x400;
    const hiresBase = page2 ? 0x4000 : 0x2000;
    const mode = !on ? "off" : m.text ? "text" : m.hires ? (m.mixed ? "hiresMixed" : "hires") : m.mixed ? "loresMixed" : "lores";
    this.shows.textContent = t(`screen.shows.${mode}`, { text: `$${hex(textBase, 4)}`, hires: `$${hex(hiresBase, 4)}` });
    // the text page's bytes
    const lores = on && !m.text && !m.hires;
    for (let row = 0; row < 24; row++) {
      const base = textBase + textRowBase(row);
      /** @type {HTMLElement} */ (this.grid.children[row * 41]).textContent = hex(base, 4);
      for (let col = 0; col < 40; col++) {
        const c = this.cells[row * 40 + col];
        const v = m.ram[base + col];
        c.textContent = on ? hex(v, 2) : "··";
        c.classList.toggle("picked", this.picked?.row === row && this.picked?.col === col);
        c.style.background = lores ? `linear-gradient(rgb(${LORES[v & 15].join(",")}) 50%, rgb(${LORES[v >> 4].join(",")}) 50%)` : "";
        c.style.color = lores ? "transparent" : "";
      }
    }
    this.renderCell(textBase);
    this.renderLine(hiresBase);
  }

  /** @private The cell picked: its address, its byte, and what the screen makes of it. @param {number} textBase */
  renderCell(textBase) {
    const m = this.system.machine;
    const p = this.picked;
    if (!p || !m.powered) return void this.inspector.replaceChildren(el("p", { class: "empty", text: t(m.powered ? "screen.pick" : "cpu.off") }));
    const addr = textBase + textRowBase(p.row) + p.col;
    const v = m.ram[addr];
    const kind = v >= 0x80 ? "normal" : v < 0x40 ? "inverse" : m.altchar ? "inverse" : "flash";
    const glyph = v >= 0x80 || m.altchar ? v & 0x7f : v & 0x3f;
    const dots = el("div", { class: "dots", style: "--w: 7" });
    for (let r = 0; r < 8; r++) {
      const bits = m.roms.u13[glyph * 8 + r];
      for (let d = 0; d < 7; d++) dots.append(el("span", { class: `dot${((bits >> d) & 1) !== (kind === "inverse" ? 1 : 0) ? " on" : ""}` }));
    }
    const lores = !m.text && !m.hires;
    this.inspector.replaceChildren(
      el("dl", { class: "kv" }, [
        el("dt", { text: t("screen.addr") }),
        el("dd", { text: `$${hex(addr, 4)}  (${t("screen.rowcol", { row: p.row, col: p.col })})` }),
        el("dt", { text: t("screen.byte") }),
        el("dd", { text: `$${hex(v, 2)}  ${v.toString(2).padStart(8, "0")}` }),
        el("dt", { text: t(lores ? "screen.blocks" : "screen.char") }),
        el("dd", { text: lores ? t("screen.blocksAre", { top: v & 15, bottom: v >> 4 }) : t(`screen.kind.${kind}`, { glyph: hex(glyph, 2) }) }),
      ]),
      lores ? el("div", { class: "glyph" }, [el("span", { class: "lores-cell", style: `background: rgb(${LORES[v & 15].join(",")})` }), el("span", { class: "lores-cell", style: `background: rgb(${LORES[v >> 4].join(",")})` })]) : dots,
    );
  }

  /** @private One hi-res line: its address worked out, and its 40 bytes as dots. @param {number} base */
  renderLine(base) {
    const m = this.system.machine;
    const y = this.line;
    const addr = base + hiresLineBase(y);
    this.lineLabel.textContent = t("screen.lineIs", { y });
    this.lineAddr.textContent = `$${hex(base, 4)} + ${y & 7}×$400 + ${(y >> 3) & 7}×$80 + ${y >> 6}×$28 = $${hex(addr, 4)}`;
    const bytes = [];
    for (let c = 0; c < 40; c++) {
      const v = m.powered ? m.ram[addr + c] : 0;
      const dots = el("span", { class: "hires-dots" });
      for (let d = 0; d < 7; d++) dots.append(el("i", { class: (v >> d) & 1 ? "on" : "" }));
      bytes.push(el("span", { class: `hires-byte${v & 0x80 ? " shift" : ""}` }, [dots, el("span", { text: hex(v, 2) })]));
    }
    this.lineBytes.replaceChildren(...bytes);
  }
}
