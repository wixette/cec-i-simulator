// SPDX-License-Identifier: Apache-2.0
//
// Programs to and from files (design/v0.0.5.md, P2 and P3): a name fit for a file, a program's
// name from its first REM line, a text file's bytes in UTF-8 or GB18030; LOGO procedures
// opened from a file are typed into LOGO's editor, and saved back as LOGO prints them (PO
// ALL), the same text; LOGO with no procedures says so.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeText, fileName, programName } from "../js/app/files.js";
import { System } from "../js/sim/system.js";
import { MATRIX, ROMS } from "./boot.js";

const ORDER = [
  { unit: "case.lid", requires: [] },
  { unit: "keyboard", requires: ["case.lid"] },
  { unit: "board.main", requires: ["keyboard"] },
];

/** A machine switched on, and a way to run it. */
function machine() {
  const s = new System({ roms: ROMS, matrix: MATRIX, takeApart: ORDER });
  s.frameBudgetMs = Infinity;
  s.say = () => {};
  let now = 0;
  const run = (/** @type {number} */ sec) => {
    for (let i = 0; i < sec * 50; i++) s.frame(0.02, (now += 20));
  };
  s.power(true);
  run(4);
  return { s, run };
}

const PROCEDURES = ["TO SQUARE :SIZE", " REPEAT 4 [FD :SIZE RT 90]", "END", "", "TO TWO", " SQUARE 20", " SQUARE 40", "END"].join("\n");

describe("names and text for files", () => {
  it("a name fit for a file: what a file cannot hold taken out, spaces made one, at most 40 characters, else PROGRAM", () => {
    assert.equal(fileName('MY "GAME": 2/3?'), "MY GAME 23");
    assert.equal(fileName("  A   B  "), "A B");
    assert.equal(fileName("X".repeat(60)), "X".repeat(40));
    assert.equal(fileName(' */?"<>| '), "PROGRAM");
    assert.equal(fileName("", "LOGO"), "LOGO");
  });
  it("a program's name is its first REM line's words, else PROGRAM; Chinese kept", () => {
    assert.equal(programName("10 REM SNAKE GAME\n20 PRINT 1\n30 REM OTHER\n"), "SNAKE GAME");
    assert.equal(programName("10REM  TIGHT\n"), "TIGHT");
    assert.equal(programName("10 REM 猜数游戏\n"), "猜数游戏");
    assert.equal(programName("10 PRINT 1\n"), "PROGRAM");
  });
  it("a text file's bytes: UTF-8 (its BOM dropped), else GB18030 for older Chinese listings, else null", () => {
    assert.equal(decodeText(new TextEncoder().encode("\uFEFF10 PRINT \"中\"")), '10 PRINT "中"');
    // 中 in GB2312/GBK: D6 D0
    assert.equal(decodeText(Uint8Array.from([0x31, 0x30, 0x20, 0xd6, 0xd0])), "10 中");
    assert.equal(decodeText(Uint8Array.from([0x81, 0x30, 0xff])), null);
  });
});

describe("LOGO procedures, to and from a file", () => {
  it("opened: typed into LOGO's editor; saved: read back as LOGO prints them, the same procedures", () => {
    const { s, run } = machine();
    assert.equal(s.logoRunning, false, "BASIC first");
    s.typeProgram({ id: "", section: "logo", mode: "logo", text: PROCEDURES }, "two.logo");
    for (let g = 0; s.typist.busy && g < 3000; g++) run(0.1);
    run(2);
    assert.ok(s.logoRunning, "LOGO started");
    /** @type {string | null} */
    let saved = null;
    assert.ok(s.logoProcedures((text) => (saved = text)));
    for (let g = 0; saved === null && g < 100; g++) run(0.2);
    const lines = (/** @type {string} */ t) => t.split("\n").filter((l) => l.trim()).sort();
    assert.deepEqual(lines(saved ?? ""), lines(PROCEDURES));
  });
  it("LOGO with no procedures: an empty text", () => {
    const { s, run } = machine();
    s.typeProgram({ id: "", section: "logo", mode: "logo", text: "" }, "none.logo");
    for (let g = 0; s.typist.busy && g < 3000; g++) run(0.1);
    run(2);
    /** @type {string | null} */
    let saved = null;
    s.logoProcedures((text) => (saved = text));
    for (let g = 0; saved === null && g < 100; g++) run(0.2);
    assert.equal(saved, "");
  });
});
