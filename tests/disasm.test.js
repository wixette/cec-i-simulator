// SPDX-License-Identifier: Apache-2.0
//
// The 6502 disassembler (js/sim/disasm.js): each addressing mode in the monitor's notation,
// the lengths, branches to their targets, and the ROM's own code read as the monitor lists it.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { disassemble, listing, parseHex } from "../js/sim/disasm.js";
import { Machine } from "../js/sim/machine.js";
import { ROMS } from "./boot.js";

/** A memory holding these bytes from $0300. @param {number[]} bytes */
const mem = (bytes) => (/** @type {number} */ a) => (a >= 0x300 && a < 0x300 + bytes.length ? bytes[a - 0x300] : 0);

describe("the disassembler", () => {
  it("each addressing mode, as the monitor writes it", () => {
    const cases = /** @type {[number[], string][]} */ ([
      [[0xea], "NOP"],
      [[0x0a], "ASL A"],
      [[0xa9, 0x41], "LDA #$41"],
      [[0xa5, 0x06], "LDA $06"],
      [[0xb5, 0x06], "LDA $06,X"],
      [[0xb6, 0x06], "LDX $06,Y"],
      [[0xad, 0x00, 0xc0], "LDA $C000"],
      [[0xbd, 0x00, 0xc0], "LDA $C000,X"],
      [[0xb9, 0x00, 0xc0], "LDA $C000,Y"],
      [[0xa1, 0x06], "LDA ($06,X)"],
      [[0xb1, 0x06], "LDA ($06),Y"],
      [[0x6c, 0xf2, 0x03], "JMP ($03F2)"],
      [[0x8d, 0xb0, 0xc0], "STA $C0B0"],
    ]);
    for (const [bytes, text] of cases) {
      const ins = disassemble(mem(bytes), 0x300);
      assert.equal(ins.text, text);
      assert.equal(ins.length, bytes.length, text);
      assert.deepEqual(ins.bytes, bytes, text);
    }
  });

  it("a branch shows where it goes, forward or back", () => {
    assert.equal(disassemble(mem([0xd0, 0x05]), 0x300).text, "BNE $0307");
    assert.equal(disassemble(mem([0xd0, 0xfb]), 0x300).text, "BNE $02FD");
    assert.equal(disassemble(mem([0xd0, 0xfb]), 0x300).target, 0x2fd);
  });

  it("an undocumented opcode: ??? and its length", () => {
    const ins = disassemble(mem([0x02]), 0x300);
    assert.equal(ins.text, "???");
    assert.ok(ins.undocumented);
  });

  it("the reset vector's code lists one instruction after another", () => {
    const m = new Machine(ROMS);
    const start = m.peek(0xfffc) | (m.peek(0xfffd) << 8);
    const list = listing((a) => m.peek(a), start, 4);
    assert.equal(list[0].addr, start);
    for (let i = 1; i < 4; i++) assert.equal(list[i].addr, (list[i - 1].addr + list[i - 1].length) & 0xffff);
    assert.ok(list.every((x) => !x.undocumented), list.map((x) => x.text).join("; "));
  });
});

describe("an address the visitor types", () => {
  it("in hex: with or without $, any case, up to four digits; else null", () => {
    assert.equal(parseHex("FD1B"), 0xfd1b);
    assert.equal(parseHex(" $c0b0 "), 0xc0b0);
    assert.equal(parseHex("0"), 0);
    assert.equal(parseHex("12345"), null);
    assert.equal(parseHex("G0"), null);
    assert.equal(parseHex(""), null);
  });
});
