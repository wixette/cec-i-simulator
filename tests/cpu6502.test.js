// SPDX-License-Identifier: Apache-2.0
//
// The 6502 against a sample of Tom Harte's SingleStepTests (MIT): the first 12 cases of every
// documented opcode, registers, memory and cycles. `pnpm test:6502` (tools/harte6502.mjs)
// runs all 1,510,000 cases.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Cpu6502, DOCUMENTED } from "../js/sim/cpu6502.js";
import { runCase } from "../tools/harte6502.mjs";

const cases = JSON.parse(readFileSync(new URL("./data/harte6502-sample.json", import.meta.url), "utf8"));

describe("the 6502", () => {
  it(`passes ${cases.length} SingleStepTests cases, every documented opcode`, () => {
    /** @type {[string, string | null][]} */
    const results = cases.map((/** @type {any} */ t) => [t.name, runCase(t)]);
    const bad = results.filter((r) => r[1]);
    assert.deepEqual(bad, []);
    const ops = new Set(cases.map((/** @type {any} */ t) => t.initial.ram.find((/** @type {[number, number]} */ [a]) => a === t.initial.pc)?.[1]));
    assert.equal(ops.size, DOCUMENTED.filter(Boolean).length);
  });

  it("the reset reads the vector at $FFFC, sets I and takes S down by three", () => {
    const mem = new Uint8Array(0x10000);
    mem[0xfffc] = 0x34;
    mem[0xfffd] = 0x12;
    const cpu = new Cpu6502({ read: (a) => mem[a], write: (a, v) => void (mem[a] = v) });
    cpu.s = 0xff;
    cpu.p = 0;
    cpu.reset();
    assert.equal(cpu.pc, 0x1234);
    assert.equal(cpu.s, 0xfc);
    assert.ok(cpu.p & 0x04);
  });

  it("an IRQ waits while I is set; an NMI does not", () => {
    const mem = new Uint8Array(0x10000).fill(0xea); // NOPs
    mem[0xfffe] = 0x00;
    mem[0xffff] = 0x30;
    mem[0xfffa] = 0x00;
    mem[0xfffb] = 0x40;
    const cpu = new Cpu6502({ read: (a) => mem[a], write: (a, v) => void (mem[a] = v) });
    cpu.pc = 0x2000;
    cpu.p = 0x24;
    cpu.irqLine = true;
    cpu.step();
    assert.equal(cpu.pc, 0x2001, "I set: the NOP runs");
    cpu.p = 0x20;
    cpu.step();
    assert.equal(cpu.pc, 0x3000, "I clear: the IRQ is taken");
    cpu.nmi();
    cpu.step();
    assert.equal(cpu.pc, 0x4000, "the NMI is taken whatever I says");
  });
});
