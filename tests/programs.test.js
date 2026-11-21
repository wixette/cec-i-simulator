// SPDX-License-Identifier: Apache-2.0
//
// Our own programs (design/v0.0.3.md, P1): each typed in on the machine's keys, from a machine
// doing something else, as Programs types it, and run; and what it shows checked. Their
// listings are typable, their machine code assembles, and the Western ones have no Chinese.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planTyping } from "../js/sim/chinese.js";
import { glyphPlace } from "../js/sim/glyphs.js";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { listing, machineCode, SAMPLES, SECTIONS, typingPlan } from "../js/sim/samples.js";
import { System } from "../js/sim/system.js";
import { textRowBase } from "../js/sim/video.js";
import { MATRIX, ROMS } from "./boot.js";

const ORDER = [
  { unit: "case.lid", requires: [] },
  { unit: "keyboard", requires: ["case.lid"] },
  { unit: "board.main", requires: ["keyboard"] },
];

/**
 * A machine switched on, doing `before` (keys, typed and run), then the sample typed in as
 * Programs does it; and ways to work it.
 * @param {string} id @param {string} [before]
 */
function typed(id, before = "") {
  const s = new System({ roms: ROMS, matrix: MATRIX, takeApart: ORDER });
  s.frameBudgetMs = Infinity;
  let now = 0;
  const run = (/** @type {number} */ sec) => {
    for (let i = 0; i < sec * 50; i++) s.frame(0.02, (now += 20));
  };
  const keys = (/** @type {string} */ k) => {
    s.type(k);
    for (let g = 0; s.typist.busy && g < 20000; g++) run(0.1);
  };
  s.power(true);
  run(3);
  if (before) keys(before);
  const sample = /** @type {import("../js/sim/samples.js").Sample} */ (SAMPLES.find((x) => x.id === id));
  s.typeProgram(sample, id);
  for (let g = 0; s.typist.busy && g < 20000; g++) run(0.2);
  const m = s.machine;
  const screen = () => m.screenText().join("\n");
  /** Runs until the text screen passes a test (or max s). @param {(t: string) => boolean} test @param {number} max */
  const until = (test, max) => {
    for (let t = 0; t < max && !test(screen()); t += 0.2) run(0.2);
    return test(screen());
  };
  return { s, m, run, keys, screen, until };
}

describe("our programs: the catalogue", () => {
  it("every program in a section, ids unique, sections in the menu's order", () => {
    assert.equal(new Set(SAMPLES.map((x) => x.id)).size, SAMPLES.length);
    for (const x of SAMPLES) assert.ok(SECTIONS.includes(x.section), x.id);
  });
  it("every listing can be typed on the machine's keys; only the Chinese ones have Chinese", () => {
    for (const x of SAMPLES) {
      const plan = planTyping(listing(x));
      assert.deepEqual(plan.refused, [], x.id);
      assert.equal(plan.chinese, x.mode === "chinese", `${x.id}: Chinese in it`);
      if (x.mode !== "logo") for (const l of listing(x).split("\n")) assert.match(l, /^\d+ /, `${x.id}: a numbered line`);
    }
  });
  it("every machine code assembles, and its DATA lines are its bytes, ended by -1", () => {
    for (const x of SAMPLES.filter((y) => y.code)) {
      const code = /** @type {{ bytes: number[] }} */ (machineCode(x));
      const data = listing(x)
        .split("\n")
        .filter((l) => Number(l.split(" ")[0]) >= /** @type {{ line: number }} */ (x.code).line && / DATA /.test(l))
        .flatMap((l) => l.replace(/^\d+ DATA /, "").split(",").map(Number));
      assert.deepEqual(data.slice(0, code.bytes.length + 1), [...code.bytes, -1], x.id);
    }
  });
  it("typing starts with Ctrl-Reset; from LOGO's monitor, BASIC afresh", () => {
    const plan = typingPlan(SAMPLES[0]);
    assert.match(plan.before, /^\{reset\}/);
    assert.equal(plan.monitor(["", "*"]), "\x02\n{wait:0.6}");
    assert.equal(plan.monitor(["]"]), "");
  });
});

describe("our programs: Learn", () => {
  it("Guess my number: found by halving, from a program that was running", () => {
    const p = typed("guess", "10 GOTO 10\nRUN\n");
    assert.ok(p.until((t) => /YOUR GUESS\?/.test(t), 5));
    let lo = 1;
    let hi = 100;
    for (let i = 0; i < 8; i++) {
      const g = Math.floor((lo + hi) / 2);
      p.keys(`${g}\n`);
      p.run(0.5);
      const said = p.screen().split("\n").filter((l) => /^(TOO SMALL|TOO BIG|YES)/.test(l)).at(-1) ?? "";
      if (said.startsWith("YES")) break;
      if (said.startsWith("TOO SMALL")) lo = g + 1;
      else hi = g - 1;
    }
    assert.match(p.screen(), /YES, IT IS +\d+!/);
    assert.match(p.screen(), /YOU GOT IT IN +\d+ GUESSES/);
  });
  it("Bar chart: three bars, the tallest full height, their names under them", () => {
    const p = typed("barchart");
    p.keys("RICE\n30\nTEA\n15\nSALT\n5\n\n");
    assert.ok(p.until((t) => /^PRESS A KEY FOR A NEW CHART/m.test(t), 20));
    assert.match(p.screen(), /RICE +TEA +SALT/);
    // the tallest bar 37 blocks high (rows 2-38, the baseline row 39), in colour 13 (yellow);
    // the second, half its number, 19 blocks, in colour 9 (orange)
    const at = (/** @type {number} */ y, /** @type {number} */ x) => (p.m.ram[0x400 + textRowBase(y >> 1) + x] >> ((y & 1) * 4)) & 15;
    assert.deepEqual([at(1, 2), at(2, 2), at(38, 2)], [0, 13, 13]);
    assert.deepEqual([at(19, 14), at(20, 14)], [0, 9]);
  });
  it("Hi-res curves: the axes and the sine waves on page 1, the caption under them", () => {
    const p = typed("curves");
    assert.ok(p.until((t) => /^SINE WAVES/m.test(t) && /^PRESS A KEY/m.test(t), 60));
    assert.ok(p.m.hires && p.m.mixed && !p.m.text);
    let lit = 0;
    for (let a = 0x2000; a < 0x4000; a++) if (p.m.ram[a]) lit++;
    assert.ok(lit > 1000, `${lit} bytes drawn`);
  });
  it("Big character: 中's 32 bytes fetched through the window, as the font holds them", () => {
    const p = typed("bigchar");
    p.keys("5448\n");
    assert.ok(p.until((t) => /GLYPH +4721, BANK +9/.test(t), 30));
    const place = glyphPlace(4721);
    const want = [...p.m.font.subarray(place.bank * 0x4000 + place.window - 0x4000, place.bank * 0x4000 + place.window - 0x4000 + 32)];
    assert.deepEqual([...p.m.ram.subarray(0x340, 0x360)], want);
    assert.ok(!p.m.ramrd, "the window shut again");
  });
  it("BASIC against machine code: the right half the same picture as the left, block for block", () => {
    const p = typed("versus");
    assert.ok(p.until((t) => /^PRESS A KEY TO DRAW THEM AGAIN/m.test(t), 90));
    for (let row = 0; row < 20; row++) {
      const base = 0x400 + textRowBase(row);
      assert.deepEqual([...p.m.ram.subarray(base + 20, base + 40)], [...p.m.ram.subarray(base, base + 20)], `row ${row}`);
    }
    assert.ok(p.m.cycles > 0 && CLOCK_HZ > 0);
  });
});
