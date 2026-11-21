// SPDX-License-Identifier: Apache-2.0
//
// The Chinese tool (docs/ui-design.md, U12): how a Chinese character reaches the screen, read
// off the running machine (js/sim/glyphs.js), a view the real machine never had. Four cards,
// as the character travels:
//
// 1. The string: a BASIC string variable's bytes, each 127 x y a character (its row and
//    place in GB 2312, moved past ", , and :).
// 2. The window: the latch U32 at $C0B0 as last written, its bits (the font bank, colour, the
//    table bank), and which 16 KB of the 256 KB font the window at aux $4000-$7FFF shows.
// 3. The character: the 32 bytes the Chinese system last read through the window, as 16 x 16
//    dots, its glyph number, row and place, and where it is in the font.
// 4. The screen: where those dots are on the hi-res page, and the 48 bytes they fill.

import { t } from "../../l10n/l10n.js";
import { fromQuwei } from "../../sim/chinese.js";
import { hex } from "../../sim/disasm.js";
import { findOnScreen, glyphPlace, GlyphWatch, rowPos, splitCode, stringVars } from "../../sim/glyphs.js";
import { el } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */

export class HanziTool {
  /** @param {HTMLElement} host @param {System} system */
  constructor(host, system) {
    this.system = system;
    /** The watch on the machine: it reads the latch and the glyphs as they go by. */
    this.watch = new GlyphWatch();
    this.watch.attach(system.machine);
    /** The string variable shown, by name, or null for the first. @type {string | null} */
    this.varName = null;
    /** @private */
    this.since = 1;
    /** @private what each card showed last */
    this.shown = { string: "", latch: "", glyph: "", screen: "" };
    this.varSel = /** @type {HTMLSelectElement} */ (el("select", { class: "field", "aria-label": t("hz.var") }));
    this.varSel.addEventListener("change", () => {
      this.varName = this.varSel.value;
      this.shown.string = "";
    });
    this.string = el("div", { class: "hz-string" });
    this.latch = el("div");
    this.glyph = el("div", { class: "glyph" });
    this.glyphInfo = el("dl", { class: "kv" });
    this.screen = el("div");
    /** @param {string} n @param {string} title @param {Node[]} body */
    const card = (n, title, body) => el("section", { class: "cpu-box tool-card" }, [el("h3", { text: `${n} · ${t(title)}` }), ...body]);
    host.append(
      el("p", { class: "caveat", text: t("hz.caveat") }),
      el("div", { class: "tool hz-tool" }, [
        el("div", { class: "tool-main" }, [
          card("1", "hz.string", [el("div", { class: "box-head" }, [el("span", { class: "dim", text: t("hz.string.note") }), el("span", { class: "spacer" }), this.varSel]), this.string]),
          card("2", "hz.latch", [this.latch]),
        ]),
        el("div", { class: "tool-main" }, [card("3", "hz.glyph", [el("div", { class: "glyph" }, [this.glyph, this.glyphInfo])]), card("4", "hz.screen", [this.screen])]),
      ]),
    );
  }

  /** Called each frame while shown. @param {number} dt */
  tick(dt) {
    this.since += dt;
    if (this.since < 0.12) return;
    this.since = 0;
    const m = this.system.machine;
    // the machine is a new one after each power-on: the watch stays on it
    if (this.watch.m !== m || m.watch === null) this.watch.attach(m);
    this.renderString();
    this.renderLatch();
    this.renderGlyph();
    this.renderScreen();
  }

  /** @private */
  renderString() {
    const m = this.system.machine;
    const vars = m.powered ? stringVars(m.ram) : [];
    const key = JSON.stringify(vars) + this.varName;
    if (key === this.shown.string) return;
    this.shown.string = key;
    const names = vars.map((v) => v.name);
    if (this.varSel.options.length !== names.length || [...this.varSel.options].some((o, i) => o.value !== names[i])) this.varSel.replaceChildren(...names.map((n) => el("option", { value: n, text: n })));
    const v = vars.find((x) => x.name === this.varName) ?? vars[0];
    if (v) this.varSel.value = v.name;
    if (!v) return void this.string.replaceChildren(el("p", { class: "empty", text: t("hz.string.none") }));
    this.string.replaceChildren(
      el("p", { class: "tool-note", text: t("hz.string.len", { name: v.name, n: v.bytes.length }) }),
      ...splitCode(v.bytes).map((p) => el("span", { class: `hz-char${p.bytes.length === 3 ? " cjk" : ""}` }, [el("b", { text: p.ch }), el("span", { text: p.bytes.join(" ") }), p.row ? el("span", { text: `${p.row}/${p.pos}` }) : null])),
    );
  }

  /** @private */
  renderLatch() {
    const w = this.watch;
    const v = this.system.machine.powered ? w.latch : 0;
    const bank = v & 15;
    const key = `${v}|${w.banks.join(",")}`;
    if (key === this.shown.latch) return;
    this.shown.latch = key;
    const bits = el("div", { class: "bits" });
    for (let b = 5; b >= 0; b--) bits.append(el("span", { class: `bit${(v >> b) & 1 ? " on" : ""}` }, [el("small", { text: `D${b}` }), el("span", { text: String((v >> b) & 1) })]));
    const banks = el("div", { class: "banks", "aria-label": t("hz.banks") }, Array.from({ length: 16 }, (_, i) => el("span", { class: `bank${i === bank ? " on" : ""}`, text: String(i) })));
    this.latch.replaceChildren(
      el("div", { class: "kbd-latch" }, [el("span", { text: "$C0B0" }), el("b", { text: `$${hex(v, 2)}` })]),
      bits,
      el("dl", { class: "kv" }, [
        el("dt", { text: t("hz.latch.bank") }),
        el("dd", { text: t("hz.latch.bankIs", { bank, from: hex(bank * 0x4000, 5), to: hex(bank * 0x4000 + 0x3fff, 5) }) }),
        el("dt", { text: t("hz.latch.colour") }),
        el("dd", { text: t(v & 0x10 ? "hz.latch.colourOn" : "hz.latch.colourOff") }),
        el("dt", { text: t("hz.latch.table") }),
        el("dd", { text: t(v & 0x20 ? "hz.latch.tableU7" : "hz.latch.tableU35") }),
      ]),
      banks,
      el("p", { class: "tool-note dim", text: t("hz.latch.note") }),
    );
  }

  /** @private */
  renderGlyph() {
    const g = this.watch.hanzi ?? this.watch.glyph;
    const key = g ? `${g.d}|${g.bytes.join(",")}` : "";
    if (key === this.shown.glyph) return;
    this.shown.glyph = key;
    if (!g) {
      this.glyph.replaceChildren(el("p", { class: "empty", text: t("hz.glyph.none") }));
      this.glyphInfo.replaceChildren();
      return;
    }
    const dots = el("div", { class: "glyph16" });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) dots.append(el("i", { class: (g.bytes[2 * y + (x >> 3)] >> (x & 7)) & 1 ? "on" : "" }));
    const bytes = el("div", { class: "glyph-bytes" });
    for (let y = 0; y < 16; y++) bytes.append(el("span", { text: hex(g.bytes[2 * y], 2) }), el("span", { text: hex(g.bytes[2 * y + 1], 2) }));
    this.glyph.replaceChildren(dots, bytes);
    const rp = rowPos(g.d);
    const place = glyphPlace(g.d);
    const code = rp ? rp.row * 100 + rp.pos : 0;
    this.glyphInfo.replaceChildren(
      el("dt", { text: t("hz.glyph.char") }),
      el("dd", { text: rp ? `${fromQuwei(code) ?? "?"}  ${t("hz.glyph.quwei", { code: String(code).padStart(4, "0") })}` : t("hz.glyph.symbol") }),
      el("dt", { text: t("hz.glyph.number") }),
      el("dd", { text: rp ? `${g.d} = (${rp.row} − 16) × 94 + ${rp.pos - 1} + 1102` : String(g.d) }),
      el("dt", { text: t("hz.glyph.font") }),
      el("dd", { text: `${g.d} × 32 = $${hex(place.font, 5)}` }),
      el("dt", { text: t("hz.glyph.window") }),
      el("dd", { text: t("hz.glyph.windowIs", { bank: place.bank, addr: hex(place.window, 4) }) }),
    );
  }

  /** @private */
  renderScreen() {
    const m = this.system.machine;
    const g = this.watch.hanzi;
    const at = g && m.powered ? findOnScreen(m.ram, m.shownPage2 ? 2 : 1, g.bytes) : null;
    const key = at ? `${at.x},${at.y}` : g ? "none" : "";
    if (key === this.shown.screen) return;
    this.shown.screen = key;
    if (!g) return void this.screen.replaceChildren(el("p", { class: "empty", text: t("hz.glyph.none") }));
    if (!at) return void this.screen.replaceChildren(el("p", { class: "empty", text: t("hz.screen.notFound") }));
    this.screen.replaceChildren(
      el("dl", { class: "kv" }, [
        el("dt", { text: t("hz.screen.page") }),
        el("dd", { text: m.shownPage2 ? "2 ($4000–$5FFF)" : "1 ($2000–$3FFF)" }),
        el("dt", { text: t("hz.screen.at") }),
        el("dd", { text: t("hz.screen.atIs", { x: at.x, y: at.y, col: at.x / 16 + 1, row: Math.floor(at.y / 17) + 1 }) }),
        el("dt", { text: t("hz.screen.bytes") }),
        el("dd", { text: t("hz.screen.bytesIs", { n: at.addrs.length, first: hex(at.addrs[0], 4) }) }),
      ]),
      el("p", { class: "tool-note dim", text: t("hz.screen.note") }),
    );
  }
}

