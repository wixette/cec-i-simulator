// SPDX-License-Identifier: Apache-2.0
//
// The 6502 disassembler, for the CPU & Memory tool: an instruction's bytes, its text in the
// notation of the Apple II's own monitor (LDA $C000,X; LDA ($06),Y; BNE $FD1B), and its length.
// The opcode table is the CPU's own (js/sim/cpu6502.js, opInfo), so the two cannot disagree.
// An undocumented opcode is shown as ??? with its length. Pure logic, no DOM.

import { opInfo } from "./cpu6502.js";

/** Bytes an addressing mode takes after the opcode. */
const OPERAND = /** @type {const} */ ({ imp: 0, acc: 0, imm: 1, zp: 1, zpx: 1, zpy: 1, abs: 2, abx: 2, aby: 2, izx: 1, izy: 1, ind: 2, rel: 1 });

/** @param {number} n @param {number} d */
export const hex = (n, d) => n.toString(16).toUpperCase().padStart(d, "0");

/**
 * @typedef {object} Instruction
 * @property {number} addr where it is
 * @property {number[]} bytes its bytes
 * @property {string} text as the monitor's listing writes it
 * @property {number} length
 * @property {boolean} undocumented
 * @property {number | null} target where it reads, writes or goes, if its operand fixes it
 */

/**
 * One instruction.
 * @param {(addr: number) => number} peek reads memory without side effects
 * @param {number} addr
 * @returns {Instruction}
 */
export function disassemble(peek, addr) {
  const op = peek(addr & 0xffff);
  const info = opInfo(op);
  const n = OPERAND[info.mode];
  const bytes = [op];
  for (let i = 1; i <= n; i++) bytes.push(peek((addr + i) & 0xffff));
  const b = bytes[1] ?? 0;
  const w = b | ((bytes[2] ?? 0) << 8);
  /** @type {number | null} */
  let target = null;
  let arg = "";
  switch (info.mode) {
    case "acc":
      arg = "A";
      break;
    case "imm":
      arg = `#$${hex(b, 2)}`;
      break;
    case "zp":
      arg = `$${hex(b, 2)}`;
      target = b;
      break;
    case "zpx":
      arg = `$${hex(b, 2)},X`;
      break;
    case "zpy":
      arg = `$${hex(b, 2)},Y`;
      break;
    case "abs":
      arg = `$${hex(w, 4)}`;
      target = w;
      break;
    case "abx":
      arg = `$${hex(w, 4)},X`;
      break;
    case "aby":
      arg = `$${hex(w, 4)},Y`;
      break;
    case "izx":
      arg = `($${hex(b, 2)},X)`;
      break;
    case "izy":
      arg = `($${hex(b, 2)}),Y`;
      break;
    case "ind":
      arg = `($${hex(w, 4)})`;
      break;
    case "rel":
      target = (addr + 2 + (b < 0x80 ? b : b - 0x100)) & 0xffff;
      arg = `$${hex(target, 4)}`;
      break;
    default:
      break;
  }
  const text = !info.documented ? "???" : arg ? `${info.name} ${arg}` : info.name;
  return { addr: addr & 0xffff, bytes, text, length: 1 + n, undocumented: !info.documented, target: info.documented ? target : null };
}

/**
 * Instructions one after another from an address.
 * @param {(addr: number) => number} peek
 * @param {number} addr
 * @param {number} count
 * @returns {Instruction[]}
 */
export function listing(peek, addr, count) {
  /** @type {Instruction[]} */
  const out = [];
  let a = addr;
  for (let i = 0; i < count; i++) {
    const ins = disassemble(peek, a);
    out.push(ins);
    a = (a + ins.length) & 0xffff;
  }
  return out;
}
