// SPDX-License-Identifier: Apache-2.0
//
// The 6502 (U1 on the main board), NMOS, instruction-exact: every documented opcode with its
// cycle count (the extra cycle on a page crossed by an indexed read, on a branch taken and on
// one crossing a page), decimal mode as the NMOS part does it (Z from the binary sum, N and V
// from the half-adjusted one). Undocumented opcodes run as NOPs of their documented length:
// the CEC-I's ROMs use none.
//
// Written for this simulator (design/decisions.md, D3) and checked against Tom Harte's
// SingleStepTests for the NMOS 6502 (MIT), opcode by opcode: a sample with the unit tests
// (tests/cpu6502.test.js), every case of every documented opcode with `pnpm test:6502`
// (tools/harte6502.mjs).

/**
 * @typedef {object} Bus
 * @property {(addr: number) => number} read
 * @property {(addr: number, value: number) => void} write
 */

const C = 0x01;
const Z = 0x02;
const I = 0x04;
const D = 0x08;
const B = 0x10;
const U = 0x20;
const V = 0x40;
const N = 0x80;

export class Cpu6502 {
  /** @param {Bus} bus */
  constructor(bus) {
    this.bus = bus;
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.s = 0xfd;
    this.p = U | I;
    this.pc = 0;
    /** Cycles run since power-on. */
    this.cycles = 0;
    /** An interrupt request held low by a device. */
    this.irqLine = false;
    /** @private an NMI edge waiting */
    this.nmiPending = false;
  }

  /** The reset sequence: the vector at $FFFC, I set, S down by three (7 cycles). */
  reset() {
    this.s = (this.s - 3) & 0xff;
    this.p |= I | U;
    this.pc = this.read16(0xfffc);
    this.cycles += 7;
  }

  nmi() {
    this.nmiPending = true;
  }

  /** @param {number} a */
  read16(a) {
    return this.bus.read(a) | (this.bus.read((a + 1) & 0xffff) << 8);
  }

  /** @private @param {number} v */
  push(v) {
    this.bus.write(0x100 | this.s, v & 0xff);
    this.s = (this.s - 1) & 0xff;
  }

  /** @private */
  pull() {
    this.s = (this.s + 1) & 0xff;
    return this.bus.read(0x100 | this.s);
  }

  /** @private @param {number} v */
  nz(v) {
    this.p = (this.p & ~(N | Z)) | (v & N) | (v ? 0 : Z);
    return v;
  }

  /** @private @param {number} vector @param {boolean} brk */
  interrupt(vector, brk) {
    this.push(this.pc >> 8);
    this.push(this.pc);
    this.push((this.p | U | (brk ? B : 0)) & ~(brk ? 0 : B));
    this.p |= I;
    this.pc = this.read16(vector);
  }

  /** One instruction (or an interrupt's entry). @returns {number} its cycles */
  step() {
    if (this.nmiPending) {
      this.nmiPending = false;
      this.interrupt(0xfffa, false);
      this.cycles += 7;
      return 7;
    }
    if (this.irqLine && !(this.p & I)) {
      this.interrupt(0xfffe, false);
      this.cycles += 7;
      return 7;
    }
    const bus = this.bus;
    const op = bus.read(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    let cyc = CYCLES[op];
    /** @type {number} */
    let ea = 0;
    // the operand's address, by addressing mode
    switch (MODE[op]) {
      case IMM:
        ea = this.pc;
        this.pc = (this.pc + 1) & 0xffff;
        break;
      case ZP:
        ea = bus.read(this.pc);
        this.pc = (this.pc + 1) & 0xffff;
        break;
      case ZPX:
        ea = (bus.read(this.pc) + this.x) & 0xff;
        this.pc = (this.pc + 1) & 0xffff;
        break;
      case ZPY:
        ea = (bus.read(this.pc) + this.y) & 0xff;
        this.pc = (this.pc + 1) & 0xffff;
        break;
      case ABS:
        ea = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        break;
      case ABX: {
        const base = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        ea = (base + this.x) & 0xffff;
        if (PAGE[op] && (base & 0xff00) !== (ea & 0xff00)) cyc++;
        break;
      }
      case ABY: {
        const base = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        ea = (base + this.y) & 0xffff;
        if (PAGE[op] && (base & 0xff00) !== (ea & 0xff00)) cyc++;
        break;
      }
      case IZX: {
        const z = (bus.read(this.pc) + this.x) & 0xff;
        this.pc = (this.pc + 1) & 0xffff;
        ea = bus.read(z) | (bus.read((z + 1) & 0xff) << 8);
        break;
      }
      case IZY: {
        const z = bus.read(this.pc);
        this.pc = (this.pc + 1) & 0xffff;
        const base = bus.read(z) | (bus.read((z + 1) & 0xff) << 8);
        ea = (base + this.y) & 0xffff;
        if (PAGE[op] && (base & 0xff00) !== (ea & 0xff00)) cyc++;
        break;
      }
      case IND: {
        const ptr = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xffff;
        // the NMOS bug: the pointer's high byte from the same page
        ea = bus.read(ptr) | (bus.read((ptr & 0xff00) | ((ptr + 1) & 0xff)) << 8);
        break;
      }
      case REL:
        ea = bus.read(this.pc);
        this.pc = (this.pc + 1) & 0xffff;
        break;
      default:
        break;
    }
    switch (OPS[op]) {
      case "LDA":
        this.a = this.nz(bus.read(ea));
        break;
      case "LDX":
        this.x = this.nz(bus.read(ea));
        break;
      case "LDY":
        this.y = this.nz(bus.read(ea));
        break;
      case "STA":
        bus.write(ea, this.a);
        break;
      case "STX":
        bus.write(ea, this.x);
        break;
      case "STY":
        bus.write(ea, this.y);
        break;
      case "ADC":
        this.adc(bus.read(ea));
        break;
      case "SBC":
        this.sbc(bus.read(ea));
        break;
      case "AND":
        this.a = this.nz(this.a & bus.read(ea));
        break;
      case "ORA":
        this.a = this.nz(this.a | bus.read(ea));
        break;
      case "EOR":
        this.a = this.nz(this.a ^ bus.read(ea));
        break;
      case "CMP":
        this.compare(this.a, bus.read(ea));
        break;
      case "CPX":
        this.compare(this.x, bus.read(ea));
        break;
      case "CPY":
        this.compare(this.y, bus.read(ea));
        break;
      case "BIT": {
        const m = bus.read(ea);
        this.p = (this.p & ~(N | V | Z)) | (m & (N | V)) | (m & this.a ? 0 : Z);
        break;
      }
      case "ASL":
      case "LSR":
      case "ROL":
      case "ROR": {
        const acc = MODE[op] === ACC;
        const m = acc ? this.a : bus.read(ea);
        if (!acc) bus.write(ea, m); // the NMOS read-modify-write writes the old value first
        const name = OPS[op];
        const cin = this.p & C;
        let r;
        let cout;
        if (name === "ASL") {
          cout = m >> 7;
          r = (m << 1) & 0xff;
        } else if (name === "LSR") {
          cout = m & 1;
          r = m >> 1;
        } else if (name === "ROL") {
          cout = m >> 7;
          r = ((m << 1) | cin) & 0xff;
        } else {
          cout = m & 1;
          r = (m >> 1) | (cin << 7);
        }
        this.p = (this.p & ~C) | cout;
        this.nz(r);
        if (acc) this.a = r;
        else bus.write(ea, r);
        break;
      }
      case "INC":
      case "DEC": {
        const m = bus.read(ea);
        bus.write(ea, m);
        const r = this.nz((m + (OPS[op] === "INC" ? 1 : 0xff)) & 0xff);
        bus.write(ea, r);
        break;
      }
      case "INX":
        this.x = this.nz((this.x + 1) & 0xff);
        break;
      case "INY":
        this.y = this.nz((this.y + 1) & 0xff);
        break;
      case "DEX":
        this.x = this.nz((this.x - 1) & 0xff);
        break;
      case "DEY":
        this.y = this.nz((this.y - 1) & 0xff);
        break;
      case "TAX":
        this.x = this.nz(this.a);
        break;
      case "TAY":
        this.y = this.nz(this.a);
        break;
      case "TXA":
        this.a = this.nz(this.x);
        break;
      case "TYA":
        this.a = this.nz(this.y);
        break;
      case "TSX":
        this.x = this.nz(this.s);
        break;
      case "TXS":
        this.s = this.x;
        break;
      case "PHA":
        this.push(this.a);
        break;
      case "PHP":
        this.push(this.p | B | U);
        break;
      case "PLA":
        this.a = this.nz(this.pull());
        break;
      case "PLP":
        this.p = (this.pull() & ~B) | U;
        break;
      case "BPL":
        cyc += this.branch(!(this.p & N), ea);
        break;
      case "BMI":
        cyc += this.branch(!!(this.p & N), ea);
        break;
      case "BVC":
        cyc += this.branch(!(this.p & V), ea);
        break;
      case "BVS":
        cyc += this.branch(!!(this.p & V), ea);
        break;
      case "BCC":
        cyc += this.branch(!(this.p & C), ea);
        break;
      case "BCS":
        cyc += this.branch(!!(this.p & C), ea);
        break;
      case "BNE":
        cyc += this.branch(!(this.p & Z), ea);
        break;
      case "BEQ":
        cyc += this.branch(!!(this.p & Z), ea);
        break;
      case "JMP":
        this.pc = ea;
        break;
      case "JSR": {
        // as the chip: the target's high byte read after the return address is pushed (it
        // can be overwritten by that push when the stack and the code meet)
        const ret = (this.pc - 1) & 0xffff;
        this.push(ret >> 8);
        this.push(ret);
        this.pc = (ea & 0xff) | (bus.read(ret) << 8);
        break;
      }
      case "RTS":
        this.pc = ((this.pull() | (this.pull() << 8)) + 1) & 0xffff;
        break;
      case "RTI":
        this.p = (this.pull() & ~B) | U;
        this.pc = this.pull() | (this.pull() << 8);
        break;
      case "BRK":
        this.pc = (this.pc + 1) & 0xffff;
        this.interrupt(0xfffe, true);
        break;
      case "CLC":
        this.p &= ~C;
        break;
      case "SEC":
        this.p |= C;
        break;
      case "CLI":
        this.p &= ~I;
        break;
      case "SEI":
        this.p |= I;
        break;
      case "CLV":
        this.p &= ~V;
        break;
      case "CLD":
        this.p &= ~D;
        break;
      case "SED":
        this.p |= D;
        break;
      default:
        break; // NOP, and the undocumented opcodes
    }
    this.cycles += cyc;
    return cyc;
  }

  /** @private @param {boolean} taken @param {number} off @returns {number} extra cycles */
  branch(taken, off) {
    if (!taken) return 0;
    const to = (this.pc + (off < 0x80 ? off : off - 0x100)) & 0xffff;
    const extra = (to & 0xff00) !== (this.pc & 0xff00) ? 2 : 1;
    this.pc = to;
    return extra;
  }

  /** @private @param {number} r @param {number} m */
  compare(r, m) {
    const t = (r - m) & 0x1ff;
    this.p = (this.p & ~C) | (r >= m ? C : 0);
    this.nz(t & 0xff);
  }

  /** @private @param {number} m */
  adc(m) {
    const a = this.a;
    const c = this.p & C;
    if (this.p & D) {
      // NMOS decimal: Z from the binary sum, N and V from the half-adjusted one
      let t = (a & 0x0f) + (m & 0x0f) + c;
      if (t > 0x09) t += 0x06;
      t = t <= 0x0f ? (t & 0x0f) + (a & 0xf0) + (m & 0xf0) : (t & 0x0f) + (a & 0xf0) + (m & 0xf0) + 0x10;
      const zero = ((a + m + c) & 0xff) === 0;
      const neg = t & 0x80;
      const ovf = (a ^ t) & 0x80 && !((a ^ m) & 0x80);
      if ((t & 0x1f0) > 0x90) t += 0x60;
      this.p = (this.p & ~(N | V | Z | C)) | (neg ? N : 0) | (ovf ? V : 0) | (zero ? Z : 0) | ((t & 0xff0) > 0xf0 ? C : 0);
      this.a = t & 0xff;
      return;
    }
    const t = a + m + c;
    this.p = (this.p & ~(V | C)) | (~(a ^ m) & (a ^ t) & 0x80 ? V : 0) | (t > 0xff ? C : 0);
    this.a = this.nz(t & 0xff);
  }

  /** @private @param {number} m */
  sbc(m) {
    const a = this.a;
    const borrow = this.p & C ? 0 : 1;
    const t = a - m - borrow;
    // flags as in binary, on the NMOS part even in decimal
    this.p = (this.p & ~(V | C)) | ((a ^ m) & (a ^ t) & 0x80 ? V : 0) | (t >= 0 ? C : 0);
    this.nz(t & 0xff);
    if (this.p & D) {
      let lo = (a & 0x0f) - (m & 0x0f) - borrow;
      let r;
      if (lo & 0x10) r = ((lo - 6) & 0x0f) | ((a & 0xf0) - (m & 0xf0) - 0x10);
      else r = (lo & 0x0f) | ((a & 0xf0) - (m & 0xf0));
      if (r & 0x100) r -= 0x60;
      this.a = r & 0xff;
      return;
    }
    this.a = t & 0xff;
  }
}

// --- the opcode tables -----------------------------------------------------------------

const IMP = 0;
const ACC = 1;
const IMM = 2;
const ZP = 3;
const ZPX = 4;
const ZPY = 5;
const ABS = 6;
const ABX = 7;
const ABY = 8;
const IZX = 9;
const IZY = 10;
const IND = 11;
const REL = 12;

/** name, mode, cycles, and "+1 on a page crossed" (reads only) */
const TABLE = `
ADC 69 imm 2|65 zp 3|75 zpx 4|6D abs 4|7D abx 4+|79 aby 4+|61 izx 6|71 izy 5+
AND 29 imm 2|25 zp 3|35 zpx 4|2D abs 4|3D abx 4+|39 aby 4+|21 izx 6|31 izy 5+
ASL 0A acc 2|06 zp 5|16 zpx 6|0E abs 6|1E abx 7
BCC 90 rel 2
BCS B0 rel 2
BEQ F0 rel 2
BIT 24 zp 3|2C abs 4
BMI 30 rel 2
BNE D0 rel 2
BPL 10 rel 2
BRK 00 imp 7
BVC 50 rel 2
BVS 70 rel 2
CLC 18 imp 2
CLD D8 imp 2
CLI 58 imp 2
CLV B8 imp 2
CMP C9 imm 2|C5 zp 3|D5 zpx 4|CD abs 4|DD abx 4+|D9 aby 4+|C1 izx 6|D1 izy 5+
CPX E0 imm 2|E4 zp 3|EC abs 4
CPY C0 imm 2|C4 zp 3|CC abs 4
DEC C6 zp 5|D6 zpx 6|CE abs 6|DE abx 7
DEX CA imp 2
DEY 88 imp 2
EOR 49 imm 2|45 zp 3|55 zpx 4|4D abs 4|5D abx 4+|59 aby 4+|41 izx 6|51 izy 5+
INC E6 zp 5|F6 zpx 6|EE abs 6|FE abx 7
INX E8 imp 2
INY C8 imp 2
JMP 4C abs 3|6C ind 5
JSR 20 abs 6
LDA A9 imm 2|A5 zp 3|B5 zpx 4|AD abs 4|BD abx 4+|B9 aby 4+|A1 izx 6|B1 izy 5+
LDX A2 imm 2|A6 zp 3|B6 zpy 4|AE abs 4|BE aby 4+
LDY A0 imm 2|A4 zp 3|B4 zpx 4|AC abs 4|BC abx 4+
LSR 4A acc 2|46 zp 5|56 zpx 6|4E abs 6|5E abx 7
NOP EA imp 2
ORA 09 imm 2|05 zp 3|15 zpx 4|0D abs 4|1D abx 4+|19 aby 4+|01 izx 6|11 izy 5+
PHA 48 imp 3
PHP 08 imp 3
PLA 68 imp 4
PLP 28 imp 4
ROL 2A acc 2|26 zp 5|36 zpx 6|2E abs 6|3E abx 7
ROR 6A acc 2|66 zp 5|76 zpx 6|6E abs 6|7E abx 7
RTI 40 imp 6
RTS 60 imp 6
SBC E9 imm 2|E5 zp 3|F5 zpx 4|ED abs 4|FD abx 4+|F9 aby 4+|E1 izx 6|F1 izy 5+
SEC 38 imp 2
SED F8 imp 2
SEI 78 imp 2
STA 85 zp 3|95 zpx 4|8D abs 4|9D abx 5|99 aby 5|81 izx 6|91 izy 6
STX 86 zp 3|96 zpy 4|8E abs 4
STY 84 zp 3|94 zpx 4|8C abs 4
TAX AA imp 2
TAY A8 imp 2
TSX BA imp 2
TXA 8A imp 2
TXS 9A imp 2
TYA 98 imp 2`;

/** @type {Record<string, number>} */
const MODES = { imp: IMP, acc: ACC, imm: IMM, zp: ZP, zpx: ZPX, zpy: ZPY, abs: ABS, abx: ABX, aby: ABY, izx: IZX, izy: IZY, ind: IND, rel: REL };
/** The undocumented opcodes' lengths, by their low bits (they run as NOPs). */
const UNDOC_MODE = [IMM, IZX, IMM, IZX, ZP, ZP, ZP, ZP, IMP, IMM, IMP, IMM, ABS, ABS, ABS, ABS];

/** @type {string[]} */
export const OPS = new Array(256).fill("NOP");
/** @type {number[]} */
const MODE = new Array(256);
/** @type {number[]} */
const CYCLES = new Array(256).fill(2);
/** @type {boolean[]} */
const PAGE = new Array(256).fill(false);
/** Whether the opcode is documented. @type {boolean[]} */
export const DOCUMENTED = new Array(256).fill(false);
for (let op = 0; op < 256; op++) MODE[op] = UNDOC_MODE[op & 0x0f];
for (const line of TABLE.trim().split("\n")) {
  const name = line.slice(0, 3);
  for (const entry of line.slice(4).split("|")) {
    const [hex, mode, cyc] = entry.trim().split(" ");
    const op = parseInt(hex, 16);
    OPS[op] = name;
    MODE[op] = MODES[mode];
    CYCLES[op] = parseInt(cyc, 10);
    PAGE[op] = cyc.endsWith("+");
    DOCUMENTED[op] = true;
  }
}

/** The addressing modes' names, by their number in MODE. @type {Record<number, string>} */
const MODE_NAME = Object.fromEntries(Object.entries(MODES).map(([k, v]) => [v, k]));

/** @typedef {"imp" | "acc" | "imm" | "zp" | "zpx" | "zpy" | "abs" | "abx" | "aby" | "izx" | "izy" | "ind" | "rel"} Mode */

/**
 * What an opcode is, for the disassembler (js/sim/disasm.js): its name, its addressing mode,
 * its cycles (the least: a page crossed or a branch taken adds), whether it is documented.
 * @param {number} op
 * @returns {{ name: string, mode: Mode, cycles: number, documented: boolean }}
 */
export function opInfo(op) {
  return { name: DOCUMENTED[op] ? OPS[op] : "???", mode: /** @type {Mode} */ (MODE_NAME[MODE[op]]), cycles: CYCLES[op], documented: DOCUMENTED[op] };
}
