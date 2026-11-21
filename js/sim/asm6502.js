// SPDX-License-Identifier: Apache-2.0
//
// A small 6502 assembler, for the machine code in our programs (design/v0.0.3.md, P1): each
// program keeps its routines as assembly, readable, and its listing's DATA lines are made from
// it, so that the two never disagree. It uses the CPU's own table of the documented opcodes
// (js/sim/cpu6502.js), so that it cannot assemble what the CPU would run otherwise.
//
// The notation is the usual one: a label at the start of a line (with or without a colon);
// `NAME = expr` for a constant; `* = expr` or `.org expr` for where the code goes; `.byte`
// and `.word` for data; `#` for an immediate operand; `(zp,X)`, `(zp),Y`, `(abs)`; `,X`, `,Y`;
// numbers in decimal, `$hex` or `%binary`; `'c'` for a character's code; `<expr` and `>expr`
// for the low and high byte of the whole expression; `+ - * /` and parentheses; `*` alone for where the line starts;
// `;` to the end of the line a comment. An operand under 256 known when it is first met takes
// the zero page form where there is one.

import { DOCUMENTED, opInfo } from "./cpu6502.js";

/** @typedef {import("./cpu6502.js").Mode} Mode */

/** Every documented opcode, by its name and its mode. @type {Map<string, Map<Mode, number>>} */
const OPCODES = new Map();
for (let op = 0; op < 256; op++) {
  if (!DOCUMENTED[op]) continue;
  const { name, mode } = opInfo(op);
  if (!OPCODES.has(name)) OPCODES.set(name, new Map());
  /** @type {Map<Mode, number>} */ (OPCODES.get(name)).set(mode, op);
}

/** The zero page form of each absolute mode. @type {Partial<Record<Mode, Mode>>} */
const ZERO_PAGE = { abs: "zp", abx: "zpx", aby: "zpy" };

/** An assembly error, with its line. */
export class AsmError extends Error {
  /** @param {string} message @param {number} line 1-based */
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

/**
 * Assembles a source at its origin (`* =`, else `org`).
 * @param {string} source
 * @param {number} [org]
 * @returns {{ org: number, bytes: number[], labels: Map<string, number> }}
 */
export function assemble(source, org = 0x300) {
  const lines = source.split("\n");
  /** @type {Map<string, number>} */
  const labels = new Map();
  /** the size each line took in the first pass, so that the second agrees @type {Map<number, number>} */
  const sizes = new Map();
  /** @type {number[]} */
  let bytes = [];
  let start = org;
  for (const pass of [1, 2]) {
    let pc = org;
    start = org;
    let started = false;
    bytes = [];
    for (let i = 0; i < lines.length; i++) {
      const n = i + 1;
      let text = stripComment(lines[i]);
      if (!text.trim()) continue;
      // a constant
      const eq = /^\s*([A-Za-z_][\w]*)\s*=\s*(.+)$/.exec(text);
      if (eq) {
        const v = evaluate(eq[2], labels, pc, n, pass === 2);
        if (v !== null) labels.set(eq[1].toUpperCase(), v);
        continue;
      }
      // where the code goes
      const at = /^\s*(?:\*\s*=|\.org\s)\s*(.+)$/i.exec(text);
      if (at) {
        const v = evaluate(at[1], labels, pc, n, true);
        if (v === null) throw new AsmError("origin unknown", n);
        if (started && v !== pc) throw new AsmError("the origin moves once the code has started", n);
        pc = v;
        if (!started) start = v;
        continue;
      }
      // a label: at the line's start, not indented (an instruction is indented)
      const lab = /^([A-Za-z_][\w]*):?(?=\s|$)/.exec(text);
      if (lab && OPCODES.has(lab[1].toUpperCase())) throw new AsmError(`${lab[1]} is an instruction: indent it, or name the label otherwise`, n);
      if (lab) {
        const name = lab[1].toUpperCase();
        if (pass === 1 && labels.has(name)) throw new AsmError(`${name} defined twice`, n);
        labels.set(name, pc);
        text = text.slice(lab[0].length);
        if (!text.trim()) continue;
      }
      started = true;
      const out = statement(text.trim(), labels, pc, n, pass === 2, sizes.get(n));
      if (pass === 1) sizes.set(n, out.length);
      else bytes.push(...out);
      pc += out.length;
      if (pc > 0x10000) throw new AsmError("past $FFFF", n);
    }
  }
  return { org: start, bytes, labels };
}

/** @param {string} line */
function stripComment(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "'") quoted = !quoted;
    else if (line[i] === ";" && !quoted) return line.slice(0, i);
  }
  return line;
}

/**
 * One statement's bytes (in the first pass, the right number of them).
 * @param {string} text @param {Map<string, number>} labels @param {number} pc @param {number} n
 * @param {boolean} final @param {number | undefined} size the first pass's size
 * @returns {number[]}
 */
function statement(text, labels, pc, n, final, size) {
  const [word, ...rest] = text.split(/\s+/);
  const operand = rest.join(" ").trim();
  const dir = word.toLowerCase();
  if (dir === ".byte" || dir === ".db" || dir === "db") {
    return splitArgs(operand).flatMap((a) => {
      const str = /^"(.*)"$/.exec(a);
      if (str) return [...str[1]].map((c) => c.charCodeAt(0));
      return [byte(evaluate(a, labels, pc, n, final) ?? 0, n, final)];
    });
  }
  if (dir === ".word" || dir === ".dw" || dir === "dw") {
    return splitArgs(operand).flatMap((a) => {
      const v = evaluate(a, labels, pc, n, final) ?? 0;
      return [v & 0xff, (v >> 8) & 0xff];
    });
  }
  const name = word.toUpperCase();
  const modes = OPCODES.get(name);
  if (!modes) throw new AsmError(`unknown instruction ${word}`, n);
  const { mode, expr } = addressing(operand, modes, n);
  if (mode === "imp" || mode === "acc") return [/** @type {number} */ (modes.get(mode))];
  const v = evaluate(expr, labels, pc, n, final);
  if (mode === "rel") {
    const target = v ?? pc + 2;
    const d = target - (pc + 2);
    if (final && (d < -128 || d > 127)) throw new AsmError(`branch out of reach (${d})`, n);
    return [/** @type {number} */ (modes.get("rel")), d & 0xff];
  }
  if (mode === "imm") return [/** @type {number} */ (modes.get("imm")), byte(v ?? 0, n, final)];
  if (mode === "izx" || mode === "izy") return [/** @type {number} */ (modes.get(mode)), byte(v ?? 0, n, final)];
  if (mode === "ind") return [/** @type {number} */ (modes.get("ind")), (v ?? 0) & 0xff, ((v ?? 0) >> 8) & 0xff];
  // abs, abx, aby, or their zero page forms: the zero page while the value is known and small,
  // and the size the first pass chose
  const zpMode = /** @type {Mode} */ (ZERO_PAGE[mode]);
  const wantZp = size === undefined ? v !== null && v < 256 && modes.has(zpMode) : size === 2;
  if (wantZp) {
    if (final && (v === null || v > 255)) throw new AsmError("a zero page operand grew past $FF", n);
    return [/** @type {number} */ (modes.get(zpMode)), (v ?? 0) & 0xff];
  }
  const op = modes.get(mode);
  if (op === undefined) throw new AsmError(`${name} has no ${mode} mode`, n);
  return [op, (v ?? 0) & 0xff, ((v ?? 0) >> 8) & 0xff];
}

/**
 * The addressing mode an operand is written in, and its expression.
 * @param {string} operand @param {Map<Mode, number>} modes @param {number} n
 * @returns {{ mode: Mode, expr: string }}
 */
function addressing(operand, modes, n) {
  const o = operand.replace(/'.'|\s+/g, (m) => (m.startsWith("'") ? m : ""));
  if (!o) {
    if (modes.has("imp")) return { mode: "imp", expr: "" };
    if (modes.has("acc")) return { mode: "acc", expr: "" };
    throw new AsmError("an operand is missing", n);
  }
  if (/^A$/i.test(o) && modes.has("acc")) return { mode: "acc", expr: "" };
  if (modes.has("rel")) return { mode: "rel", expr: o };
  if (o.startsWith("#")) return { mode: "imm", expr: o.slice(1) };
  let m;
  if ((m = /^\((.+),X\)$/i.exec(o))) return { mode: "izx", expr: m[1] };
  if ((m = /^\((.+)\),Y$/i.exec(o))) return { mode: "izy", expr: m[1] };
  if ((m = /^\((.+)\)$/.exec(o)) && modes.has("ind")) return { mode: "ind", expr: m[1] };
  if ((m = /^(.+),X$/i.exec(o))) return { mode: "abx", expr: m[1] };
  if ((m = /^(.+),Y$/i.exec(o))) return { mode: "aby", expr: m[1] };
  return { mode: "abs", expr: o };
}

/** @param {string} s */
function splitArgs(s) {
  /** @type {string[]} */
  const out = [];
  let cur = "";
  let q = "";
  for (const c of s) {
    if (q) {
      cur += c;
      if (c === q) q = "";
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** @param {number} v @param {number} n @param {boolean} final */
function byte(v, n, final) {
  if (final && (v < -128 || v > 255)) throw new AsmError(`${v} is not a byte`, n);
  return v & 0xff;
}

/**
 * An expression's value, or null while a label in it is not yet known (an error in the second pass).
 * @param {string} src @param {Map<string, number>} labels @param {number} pc @param {number} n @param {boolean} final
 * @returns {number | null}
 */
export function evaluate(src, labels, pc, n, final) {
  // spaces dropped, but for a character's own (' ')
  const s = src.replace(/'.'|\s+/g, (m) => (m.startsWith("'") ? m : ""));
  let i = 0;
  let unknown = false;
  const fail = (/** @type {string} */ why) => {
    throw new AsmError(`${why} in "${src}"`, n);
  };
  /** @returns {number} */
  const primary = () => {
    const c = s[i];
    if (c === "(") {
      i++;
      const v = sum();
      if (s[i++] !== ")") fail("a ) is missing");
      return v;
    }
    if (c === "-") return (i++, -primary());
    if (c === "*") return (i++, pc);
    if (c === "'") {
      const ch = s[i + 1];
      if (s[i + 2] !== "'") fail("a character is not closed");
      i += 3;
      return ch.charCodeAt(0);
    }
    let m;
    const rest = s.slice(i);
    if ((m = /^\$([0-9A-Fa-f]+)/.exec(rest))) return (i += m[0].length, parseInt(m[1], 16));
    if ((m = /^%([01]+)/.exec(rest))) return (i += m[0].length, parseInt(m[1], 2));
    if ((m = /^[0-9]+/.exec(rest))) return (i += m[0].length, parseInt(m[0], 10));
    if ((m = /^[A-Za-z_]\w*/.exec(rest))) {
      i += m[0].length;
      const v = labels.get(m[0].toUpperCase());
      if (v === undefined) {
        if (final) fail(`${m[0]} is not defined`);
        unknown = true;
        return 0;
      }
      return v;
    }
    return fail("a value is missing");
  };
  const product = () => {
    let v = primary();
    while (s[i] === "*" || s[i] === "/") {
      const op = s[i++];
      const r = primary();
      v = op === "*" ? v * r : Math.trunc(v / r);
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (s[i] === "+" || s[i] === "-") {
      const op = s[i++];
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  // < and > in front: the low or the high byte of all that follows
  const part = s[0] === "<" || s[0] === ">" ? s[i++] : "";
  let v = sum();
  if (i !== s.length) fail("something is left over");
  if (part === "<") v &= 0xff;
  if (part === ">") v = (v >> 8) & 0xff;
  return unknown ? null : v;
}

/**
 * Machine code as BASIC DATA lines, as type-in listings carried it: decimal bytes, numbered
 * from `first` in steps of `step` (consecutive by default, so that a few numbers hold them),
 * each line no longer than `width` characters.
 * @param {number[]} bytes @param {number} first @param {number} [step] @param {number} [width]
 * @returns {string}
 */
export function dataLines(bytes, first, step = 1, width = 72) {
  /** @type {string[]} */
  const out = [];
  let line = first;
  let cur = "";
  for (const b of bytes) {
    const add = cur ? `,${b}` : String(b);
    if (cur && `${line} DATA ${cur}${add}`.length > width) {
      out.push(`${line} DATA ${cur}`);
      line += step;
      cur = String(b);
    } else cur += add;
  }
  if (cur) out.push(`${line} DATA ${cur}`);
  return out.join("\n");
}
