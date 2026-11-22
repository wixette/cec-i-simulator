// SPDX-License-Identifier: Apache-2.0
//
// The CPU & Memory tool (docs/ui-design.md, U12): a view the real machine never had. The
// 6502's registers and flags; the next instructions, disassembled (js/sim/disasm.js); the
// memory map, each region lit by its share of the traffic (js/sim/memmap.js); a memory dump
// that can follow PC, the stack or an address. Pause, Step (one instruction), Run to an
// address, and a slower clock. While paused, everything waits: the picture, the keys, the
// typist. With the computer off the tool keeps its layout, greyed, and says why (P6). As the
// TRS-80 simulator's CPU tool (https://github.com/wixette/trs-80-simulator, Apache-2.0).

import { t } from "../../l10n/l10n.js";
import { disassemble, hex, listing, parseHex } from "../../sim/disasm.js";
import { REGIONS, regionShares } from "../../sim/memmap.js";
import { el, icon, setTip } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */

/** The speeds offered: the real machine, and slower. */
export const SPEEDS = [1, 0.1, 0.01, 0.001];
/** The flags, from bit 7 down (bit 5 is always 1, and not shown). */
const FLAGS = /** @type {[string, number][]} */ ([
  ["N", 7],
  ["V", 6],
  ["B", 4],
  ["D", 3],
  ["I", 2],
  ["Z", 1],
  ["C", 0],
]);
/** How many instructions to list, and rows of 16 bytes to dump. */
const LIST = 8;
const DUMP_ROWS = 8;

/** @typedef {{ a: number, x: number, y: number, s: number, p: number, pc: number }} Registers */

export class CpuTool {
  /** @param {HTMLElement} host @param {System} system */
  constructor(host, system) {
    this.system = system;
    /** What the dump follows: "pc", "sp", or an address. @type {"pc" | "sp" | number} */
    this.follow = "pc";
    /** @private the registers before the last step, to mark what changed @type {Registers | null} */
    this.before = null;
    /** @private eased lights per region */
    this.lit = new Map(REGIONS.map((r) => [r.id, 0]));
    /** @private seconds since the last full redraw, and what it showed */
    this.since = 1;
    this.shown = "";
    /** @private what the controls showed last */
    this.look = "";
    const s = system;

    this.pauseBtn = el("button", { class: "btn tonal small has-icon", type: "button" });
    this.pauseBtn.addEventListener("click", () => this.togglePause());
    this.stepBtn = el("button", { class: "btn tonal small has-icon", type: "button" }, [icon("skip_next"), el("span", { text: t("cpu.step") })]);
    this.stepBtn.setAttribute("data-tip-describes", "");
    setTip(this.stepBtn, t("cpu.step.tip"));
    this.stepBtn.addEventListener("click", () => this.step());
    this.toField = /** @type {HTMLInputElement} */ (el("input", { class: "field mono", type: "text", maxlength: "5", size: "6", placeholder: "FD1B", "aria-label": t("cpu.runTo.field"), spellcheck: "false", autocomplete: "off" }));
    this.toBtn = el("button", { class: "btn tonal small has-icon", type: "button" }, [icon("fast_forward"), el("span", { text: t("cpu.runTo") })]);
    this.toBtn.setAttribute("data-tip-describes", "");
    setTip(this.toBtn, t("cpu.runTo.tip"));
    this.toBtn.addEventListener("click", () => this.runTo());
    this.toField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runTo();
    });
    this.speed = el("div", { class: "segmented", role: "radiogroup", "aria-label": t("cpu.speed") });
    for (const sp of SPEEDS) {
      const b = el("button", { type: "button", role: "radio", "aria-checked": String(sp === 1), "data-speed": String(sp), text: sp === 1 ? t("cpu.speed.real") : `1/${Math.round(1 / sp)}` });
      setTip(b, t(sp === 1 ? "cpu.speed.real.tip" : "cpu.speed.slow.tip", { n: Math.round(1 / sp) }));
      b.addEventListener("click", () => {
        s.setSpeed(sp);
        s.say({ key: sp === 1 ? "cpu.speedReal" : "cpu.speedSlow", params: { n: Math.round(1 / sp) } });
      });
      this.speed.append(b);
    }
    const controls = el("div", { class: "tool-actions cpu-controls" }, [this.pauseBtn, this.stepBtn, el("span", { class: "group" }, [this.toField, this.toBtn]), this.speed]);

    this.regs = el("div", { class: "regs mono", "aria-label": t("cpu.registers") });
    this.flags = el("div", { class: "flags", "aria-label": t("cpu.flags") });
    this.code = el("ol", { class: "code mono", "aria-label": t("cpu.next") });
    // the memory map: a group of buttons, each region reached with Tab as with the pointer (P10)
    this.map = el("div", { class: "memmap", role: "group", "aria-label": t("cpu.map") });
    for (const r of REGIONS) {
      const size = r.end - r.start + 1;
      const seg = el("button", { type: "button", class: `region ${r.id}`, style: `flex: ${Math.max(0.03, size / 0x10000)} 1 0`, "data-region": r.id, "data-tip-describes": "" }, [el("span", { text: t(`region.${r.id}`) })]);
      setTip(seg, t("cpu.region", { name: t(`region.${r.id}.long`), start: hex(r.start, 4), end: hex(r.end, 4), chips: r.chips.join(", ") }));
      seg.addEventListener("click", () => {
        this.follow = r.start;
        this.followSel.value = "addr";
        this.addrField.value = hex(r.start, 4);
        this.shown = "";
      });
      this.map.append(seg);
    }
    this.followSel = /** @type {HTMLSelectElement} */ (el("select", { class: "field", "aria-label": t("cpu.follow") }, ["pc", "sp", "addr"].map((v) => el("option", { value: v, text: t(`cpu.follow.${v}`) }))));
    this.addrField = /** @type {HTMLInputElement} */ (el("input", { class: "field mono", type: "text", maxlength: "5", size: "6", "aria-label": t("cpu.address"), spellcheck: "false", autocomplete: "off" }));
    this.followSel.addEventListener("change", () => {
      const v = this.followSel.value;
      this.follow = v === "addr" ? (parseHex(this.addrField.value) ?? 0x0800) : /** @type {"pc" | "sp"} */ (v);
      if (v === "addr" && !this.addrField.value) this.addrField.value = "0800";
      this.shown = "";
    });
    this.addrField.addEventListener("change", () => {
      const a = parseHex(this.addrField.value);
      if (a === null) return;
      this.follow = a;
      this.followSel.value = "addr";
      this.shown = "";
    });
    this.dump = el("div", { class: "dump mono", role: "table", "aria-label": t("cpu.dump") });
    this.state = el("p", { class: "cpu-state", "aria-live": "polite" });
    host.append(
      el("p", { class: "caveat", text: t("tools.caveat") }),
      el("div", { class: "tool cpu-tool" }, [
        el("div", { class: "cpu-top" }, [controls, this.state]),
        el("div", { class: "cpu-grid" }, [
          el("section", { class: "cpu-box" }, [el("h3", { text: t("cpu.registers") }), this.regs, this.flags]),
          el("section", { class: "cpu-box" }, [el("h3", { text: t("cpu.next") }), this.code]),
          el("section", { class: "cpu-box wide" }, [el("div", { class: "box-head" }, [el("h3", { text: t("cpu.memory") }), el("span", { class: "spacer" }), this.followSel, this.addrField]), this.map, this.dump]),
        ]),
      ]),
    );
    s.onStop = (pc) => s.say({ key: "cpu.reached", params: { addr: hex(pc, 4) } });
  }

  /** @private @returns {Registers} */
  regsNow() {
    const c = this.system.machine.cpu;
    return { a: c.a, x: c.x, y: c.y, s: c.s, p: c.p, pc: c.pc };
  }

  /** @private */
  togglePause() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "cpu.off" });
    if (s.paused) {
      s.resume();
      s.say({ key: "cpu.running" });
    } else {
      s.pause();
      this.before = this.regsNow();
      s.say({ key: "cpu.paused", params: { addr: hex(s.machine.cpu.pc, 4) } });
    }
  }

  /** One instruction; running, the first press pauses. */
  step() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "cpu.off" });
    if (!s.paused) {
      s.pause();
      this.before = this.regsNow();
      s.say({ key: "cpu.paused", params: { addr: hex(s.machine.cpu.pc, 4) } });
      return;
    }
    const ins = disassemble((a) => s.machine.peek(a), s.machine.cpu.pc);
    this.before = this.regsNow();
    const n = s.step();
    s.say({ key: "cpu.stepped", params: { text: ins.text, addr: hex(ins.addr, 4), n } });
  }

  /** @private Runs until PC reaches the address in the field. */
  runTo() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "cpu.off" });
    const a = parseHex(this.toField.value);
    if (a === null) return void s.say({ key: "cpu.badAddress" });
    s.runTo(a);
    s.say({ key: "cpu.runningTo", params: { addr: hex(a, 4) } });
  }

  /** Called each frame while shown. @param {number} dt */
  tick(dt) {
    const s = this.system;
    const m = s.machine;
    const on = m.powered;
    const look = `${s.paused}|${on}|${s.speedSet}`;
    if (look !== this.look) {
      this.look = look;
      this.pauseBtn.replaceChildren(icon(s.paused ? "play_arrow" : "pause"), el("span", { text: t(s.paused ? "cpu.run" : "cpu.pause") }));
      this.pauseBtn.setAttribute("data-tip-describes", "");
      setTip(this.pauseBtn, t(s.paused ? "cpu.run.tip" : "cpu.pause.tip"));
      for (const b of [this.pauseBtn, this.stepBtn, this.toBtn]) b.setAttribute("aria-disabled", String(!on));
      for (const x of /** @type {HTMLCollectionOf<HTMLElement>} */ (this.speed.children)) x.setAttribute("aria-checked", String(Number(x.dataset.speed) === s.speedSet));
    }
    this.state.textContent = !on ? t("cpu.off") : s.paused ? t("cpu.state.paused", { addr: hex(m.cpu.pc, 4) }) : s.stops.size ? t("cpu.state.runningTo", { addr: hex([...s.stops][0], 4) }) : t("cpu.state.running");
    this.renderMap(dt);
    // the registers, code and dump: ten times a second while it runs; paused, when they change
    this.since += dt;
    const key = `${on}|${s.paused}|${m.cycles}|${String(this.follow)}`;
    if (key === this.shown || (!s.paused && on && this.since < 0.1)) return;
    this.shown = key;
    this.since = 0;
    const r = on ? this.regsNow() : null;
    this.renderRegs(r);
    this.renderCode(r);
    this.renderDump(r);
  }

  /** @private @param {Registers | null} r */
  renderRegs(r) {
    const b = this.before;
    /** @param {string} name @param {keyof Registers} k @param {number} d */
    const cell = (name, k, d) => el("span", { class: `reg${r && b && r[k] !== b[k] ? " changed" : ""}` }, [el("small", { text: name }), el("b", { text: r ? hex(r[k], d) : "–".repeat(d) })]);
    this.regs.replaceChildren(el("div", { class: "reg-row" }, [cell("A", "a", 2), cell("X", "x", 2), cell("Y", "y", 2), cell("S", "s", 2), cell("P", "p", 2), cell("PC", "pc", 4)]));
    // made once and lit after: made again each time, their tooltips never showed
    if (!this.flags.childElementCount)
      this.flags.replaceChildren(
        ...FLAGS.map(([n]) => {
          const e = el("span", { class: "flag", text: n });
          setTip(e, t(`flag.${n}`));
          return e;
        }),
      );
    FLAGS.forEach(([, bit], i) => this.flags.children[i].classList.toggle("on", !!r && ((r.p >> bit) & 1) === 1));
  }

  /** @private @param {Registers | null} r */
  renderCode(r) {
    if (!r) {
      this.code.replaceChildren(...Array.from({ length: LIST }, () => el("li", { class: "dim", text: "–" })));
      return;
    }
    const m = this.system.machine;
    this.code.replaceChildren(
      ...listing((a) => m.peek(a), r.pc, LIST).map((ins, i) =>
        el("li", { class: `${i === 0 ? "at-pc" : ""}${ins.undocumented ? " undoc" : ""}` }, [
          el("span", { class: "c-addr", text: hex(ins.addr, 4) }),
          el("span", { class: "c-bytes", text: ins.bytes.map((x) => hex(x, 2)).join(" ") }),
          el("span", { class: "c-text", text: ins.text }),
        ]),
      ),
    );
  }

  /** @private @param {number} dt */
  renderMap(dt) {
    const shares = this.system.machine.powered && !this.system.paused ? regionShares(this.system.traffic) : new Map();
    for (const seg of this.map.children) {
      const id = /** @type {HTMLElement} */ (seg).dataset.region ?? "";
      const target = shares.get(id) ?? 0;
      const now = (this.lit.get(id) ?? 0) + (target - (this.lit.get(id) ?? 0)) * Math.min(1, dt * 8);
      this.lit.set(id, now);
      /** @type {HTMLElement} */ (seg).style.setProperty("--lit", now.toFixed(3));
    }
  }

  /** @private @param {Registers | null} r */
  renderDump(r) {
    const m = this.system.machine;
    const at = !r ? 0x0800 : this.follow === "pc" ? r.pc : this.follow === "sp" ? 0x100 | r.s : this.follow;
    const start = ((at & 0xfff0) - (this.follow === "pc" ? 0x10 : 0)) & 0xffff;
    const pcLen = r ? disassemble((a) => m.peek(a), r.pc).length : 0;
    /** @type {HTMLElement[]} */
    const rows = [];
    for (let i = 0; i < DUMP_ROWS; i++) {
      const base = (start + i * 16) & 0xffff;
      /** @type {HTMLElement[]} */
      const bytes = [];
      let ascii = "";
      for (let k = 0; k < 16; k++) {
        const a = (base + k) & 0xffff;
        const v = r ? m.peek(a) : 0;
        const atPc = r && ((a - r.pc) & 0xffff) < pcLen;
        const atSp = r && a === (0x100 | r.s);
        bytes.push(el("span", { class: `${atPc ? "at-pc" : ""}${atSp ? " at-sp" : ""}`, text: r ? hex(v, 2) : "··" }));
        const c = v & 0x7f;
        ascii += r && c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : "·";
      }
      rows.push(el("div", { class: "dump-row", role: "row" }, [el("span", { class: "d-addr", text: hex(base, 4) }), el("span", { class: "d-bytes" }, bytes), el("span", { class: "d-ascii", text: ascii })]));
    }
    this.dump.replaceChildren(...rows);
  }
}
