// SPDX-License-Identifier: Apache-2.0
//
// The assembler our programs' machine code is written in (js/sim/asm6502.js): every
// documented opcode in every mode, read back by the CPU tool's disassembler; labels, constants,
// expressions and the zero page; its errors; and DATA lines as listings carried them.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AsmError, assemble, dataLines } from "../js/sim/asm6502.js";
import { DOCUMENTED, opInfo } from "../js/sim/cpu6502.js";
import { disassemble } from "../js/sim/disasm.js";

/** An operand in each mode, as the source writes it. @type {Record<string, string>} */
const OPERAND = { imp: "", acc: "A", imm: "#$12", zp: "$12", zpx: "$12,X", zpy: "$12,Y", abs: "$1234", abx: "$1234,X", aby: "$1234,Y", izx: "($12,X)", izy: "($12),Y", ind: "($1234)", rel: "*+4" };

describe("the 6502 assembler", () => {
  it("every documented opcode, in every mode, comes out as the opcode the CPU runs", () => {
    let n = 0;
    for (let op = 0; op < 256; op++) {
      if (!DOCUMENTED[op]) continue;
      const { name, mode } = opInfo(op);
      const { bytes } = assemble(` ${name} ${OPERAND[mode]}`, 0x300);
      assert.equal(bytes[0], op, `${name} ${mode}`);
      const back = disassemble((a) => bytes[a - 0x300] ?? 0, 0x300);
      assert.equal(back.length, bytes.length, `${name} ${mode}: its length`);
      n++;
    }
    assert.equal(n, 151);
  });
  it("labels forward and back, constants, the low and high byte, characters", () => {
    const src = `
SCREEN = $400
        * = $300
start   LDX #0
loop:   LDA msg,X       ; a comment
        BEQ done
        ORA #$80
        STA SCREEN+40,X
        INX
        BNE loop
done    RTS
msg     .byte "HI", 0
        .word start, >msg, <msg+1
        LDA #'A'+1`;
    const { org, bytes, labels } = assemble(src);
    assert.equal(org, 0x300);
    assert.equal(labels.get("LOOP"), 0x302);
    assert.deepEqual(bytes.slice(0, 15), [0xa2, 0x00, 0xbd, 0x10, 0x03, 0xf0, 0x08, 0x09, 0x80, 0x9d, 0x28, 0x04, 0xe8, 0xd0, 0xf3]);
    assert.deepEqual(bytes.slice(15, 25), [0x60, 0x48, 0x49, 0x00, 0x00, 0x03, 0x03, 0x00, 0x11, 0x00]);
    assert.deepEqual(bytes.slice(25), [0xa9, 0x42]);
  });
  it("the zero page form for a small operand known when met; the absolute one for a label met later", () => {
    const { bytes } = assemble(" LDA $10\n LDA far\n RTS\nfar = $20");
    assert.deepEqual(bytes, [0xa5, 0x10, 0xad, 0x20, 0x00, 0x60]);
  });
  it("says what is wrong, and where", () => {
    assert.throws(() => assemble(" LDA nowhere"), (e) => e instanceof AsmError && e.line === 1 && /nowhere/.test(e.message));
    assert.throws(() => assemble(" BNE far\n .byte " + "0,".repeat(200) + "0\nfar RTS"), /out of reach/);
    assert.throws(() => assemble(" FOO #1"), /unknown instruction/);
    assert.throws(() => assemble(" LDA #300"), /not a byte/);
  });
  it("DATA lines, as a type-in listing carried them", () => {
    assert.equal(dataLines([169, 0, 96], 1000), "1000 DATA 169,0,96");
    const many = dataLines(new Array(40).fill(255), 500, 5, 40);
    assert.ok(many.split("\n").every((l) => l.length <= 40));
    assert.equal(many.split("\n")[1].slice(0, 9), "505 DATA ");
  });
});
