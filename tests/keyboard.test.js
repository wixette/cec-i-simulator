// SPDX-License-Identifier: Apache-2.0
//
// The keyboard (js/sim/keyboard.js): each key's code read from the keyboard ROM U26 by its
// place in the matrix, against the codes GET reads on a real machine; the repeat; the keys
// the typist presses; the typist itself.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Keyboard, REPEAT_DELAY_S, REPEAT_HZ, runFor, Typist } from "../js/sim/keyboard.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { MATRIX, ROMS } from "./boot.js";

const kb = () => new Keyboard(new Machine(ROMS), MATRIX);

describe("the keys' codes, from U26, as GET reads them on a real machine", () => {
  it("F1-F5, Quit, 西文, 中文, TEST, Tab, Esc", () => {
    const k = kb();
    assert.deepEqual(["f1", "f2", "f3", "f4", "f5", "quit", "xiwen", "zhongwen", "test", "tab", "esc"].map((id) => k.code(id)), [1, 12, 23, 20, 6, 3, 17, 31, 22, 9, 27]);
  });
  it("the arrows 8, 21, 11, 10; Return 13; the space bar 32", () => {
    const k = kb();
    assert.deepEqual(["left", "right", "up", "down", "return", "space"].map((id) => k.code(id)), [8, 21, 11, 10, 13, 32]);
  });
  it("a: 65 with Caps Lock down (as it starts), 97 with it up; Ctrl-A 1 either way", () => {
    const k = kb();
    assert.equal(k.code("a"), 65);
    assert.equal(k.code("a", { caps: false }), 97);
    assert.equal(k.code("a", { caps: false, shift: true }), 65);
    for (const caps of [false, true]) assert.equal(k.code("a", { ctrl: true, caps }), 1);
  });
  it("1: 49, Shift-1 33, Ctrl-1 49; the signs as printed on the keys", () => {
    const k = kb();
    assert.deepEqual([k.code("1"), k.code("1", { shift: true }), k.code("1", { ctrl: true })], [49, 33, 49]);
    assert.deepEqual([k.code("semicolon"), k.code("semicolon", { shift: true }), k.code("quote"), k.code("quote", { shift: true })], [59, 58, 39, 34]);
  });
  it("RESET and the modifiers give no code", () => {
    const k = kb();
    for (const id of ["reset", "ctrl", "lshift", "rshift", "capslock"]) assert.equal(k.code(id), null);
  });
});

describe("pressing keys", () => {
  it("a key's code goes into the latch with the strobe; held, it repeats after its delay", () => {
    const k = kb();
    const m = k.m;
    m.powerOn();
    k.down("a");
    assert.equal(m.kbd, 65);
    assert.ok(m.strobe);
    m.strobe = false;
    runFor(m, REPEAT_DELAY_S - 0.02, [k]);
    assert.ok(!m.strobe, "no repeat before the delay");
    runFor(m, 0.04 + 1 / REPEAT_HZ, [k]);
    assert.ok(m.strobe, "repeats after it");
    k.up("a");
    assert.equal(k.held, null);
  });
  it("Caps Lock toggles; Ctrl-RESET holds the RESET line until either is let go", () => {
    const k = kb();
    k.down("capslock");
    assert.equal(k.caps, false);
    k.down("reset");
    assert.ok(!k.m.resetLow, "RESET alone does nothing");
    k.down("ctrl");
    k.down("reset");
    assert.ok(k.m.resetLow);
    k.up("reset");
    assert.ok(!k.m.resetLow);
  });
  it("the key for a code, as a person presses it: no modifier if none is needed", () => {
    const k = kb();
    assert.deepEqual(k.strokeFor(65), { id: "a", shift: false, ctrl: false });
    assert.deepEqual(k.strokeFor(34), { id: "quote", shift: true, ctrl: false });
    assert.deepEqual(k.strokeFor(31), { id: "zhongwen", shift: false, ctrl: false });
    assert.deepEqual(k.strokeFor(3), { id: "quit", shift: false, ctrl: false });
    assert.equal(k.strokeFor(0x7f)?.id ?? null, k.strokeFor(0x7f)?.id ?? null);
  });
});

describe("the typist", () => {
  it("types a code once the last was read and a gap has passed; {name} is a key; {wait:s} a pause", () => {
    const m = new Machine(ROMS);
    m.powerOn();
    const t = new Typist(m);
    /** @type {number[]} */
    const seen = [];
    t.onKey = (c) => seen.push(c);
    t.type("A{f3}{wait:1}{lbrace}\n");
    t.tick();
    assert.deepEqual(seen, [65]);
    t.tick();
    assert.deepEqual(seen, [65], "waits for the program to take the key");
    m.strobe = false;
    t.tick();
    assert.deepEqual(seen, [65], "and for the gap");
    m.cpu.cycles += t.gap;
    t.tick();
    m.strobe = false;
    assert.deepEqual(seen, [65, 23]);
    m.cpu.cycles += t.gap;
    t.tick();
    assert.deepEqual(seen, [65, 23], "the wait, a second from the last key");
    m.cpu.cycles += CLOCK_HZ;
    t.tick(); // the wait is over
    m.cpu.cycles += t.gap;
    t.tick();
    assert.deepEqual(seen, [65, 23, 123]);
    m.strobe = false;
    m.cpu.cycles += t.gap;
    t.tick();
    assert.deepEqual(seen, [65, 23, 123, 13]);
    assert.ok(!t.busy);
  });
});
