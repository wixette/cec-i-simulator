// SPDX-License-Identifier: Apache-2.0
//
// Programs to and from files (design/v0.0.5.md, P2 and P3): LOGO procedures opened from a
// file are typed into LOGO's editor, and saved back as LOGO prints them (PO ALL), the same
// text; LOGO with no procedures says so.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
