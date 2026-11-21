// SPDX-License-Identifier: Apache-2.0
//
// Our own programs (design/v0.0.3.md, P1): each typed in on the machine's keys, from a machine
// doing something else, as Programs types it, and run; and what it shows checked. Their
// listings are typable, their machine code assembles, and the Western ones have no Chinese.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planTyping } from "../js/sim/chinese.js";
import { findOnScreen, glyphPlace } from "../js/sim/glyphs.js";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { listing, machineCode, SAMPLES, SECTIONS, typingPlan } from "../js/sim/samples.js";
import { System } from "../js/sim/system.js";
import { textRowBase } from "../js/sim/video.js";
import { MATRIX, ROMS, tone } from "./boot.js";

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

/** A lo-res block's colour, x 0-39, y 0-39. @param {import("../js/sim/machine.js").Machine} m @param {number} x @param {number} y */
const block = (m, x, y) => (m.ram[0x400 + textRowBase(y >> 1) + x] >> ((y & 1) * 4)) & 15;
/** Where blocks of a colour are. @param {import("../js/sim/machine.js").Machine} m @param {number} c */
function blocks(m, c) {
  /** @type {{ x: number, y: number }[]} */
  const at = [];
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (block(m, x, y) === c) at.push({ x, y });
  return at;
}

describe("our programs: Games", () => {
  it("Snake: steered on the arrows to a coin, it eats it and grows", () => {
    const p = typed("snake");
    p.keys(" ");
    p.run(2);
    let dir = "right";
    for (let i = 0; i < 300 && !/COINS [1-9]/.test(p.screen()); i++) {
      const head = blocks(p.m, 15)[0];
      const coin = [...blocks(p.m, 13), ...blocks(p.m, 9), ...blocks(p.m, 11)][0];
      if (head && coin) {
        const want = head.x !== coin.x ? (head.x < coin.x ? "right" : "left") : head.y < coin.y ? "down" : "up";
        const opposite = { left: "right", right: "left", up: "down", down: "up" }[dir];
        const go = want === opposite ? (head.y < 20 ? "down" : "up") : want;
        if (go !== dir) {
          p.keys(`{${go}}`);
          dir = go;
        }
      }
      p.run(0.05);
    }
    assert.match(p.screen(), /COINS [1-9]\d* +LENGTH 5/);
  });
  it("Bricks: six rows of nine, pink, orange and yellow; the bat kept under the ball scores", () => {
    const p = typed("bricks");
    p.keys(" ");
    p.run(1);
    assert.deepEqual([block(p.m, 2, 4), block(p.m, 2, 6), block(p.m, 2, 8)], [11, 9, 13]);
    for (let i = 0; i < 400 && !/SCORE [1-9]/.test(p.screen()); i++) {
      const ball = blocks(p.m, 15).find((b) => b.y < 38);
      const bat = blocks(p.m, 7)[0];
      if (ball && bat && Math.abs(ball.x - (bat.x + 2.5)) > 1) p.keys(ball.x < bat.x + 2.5 ? "{left}" : "{right}");
      else p.run(0.05);
    }
    assert.match(p.screen(), /SCORE [1-9]/);
  });
  it("Mine hunt: the first square safe and a field opened at once; a flag; a mine opened ends it", () => {
    const p = typed("minehunt");
    p.keys(" ");
    p.run(2);
    p.keys(" ");
    assert.ok(p.until((t) => /OPEN +[1-9]\d*\/71/.test(t), 10));
    const mine = [...p.m.ram.subarray(0x6200, 0x6200 + 81)];
    assert.equal(mine.filter(Boolean).length, 10);
    for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) assert.equal(mine[y * 9 + x], 0, "none round the first square");
    // every count the mines round it
    for (let i = 0; i < 81; i++) {
      const [x, y] = [i % 9, Math.floor(i / 9)];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < 9 && y + dy >= 0 && y + dy < 9) n += mine[(y + dy) * 9 + x + dx];
      assert.equal(p.m.ram[0x6260 + i], n, `square ${i}`);
    }
    // to a mine, flag it, then open it
    const target = mine.indexOf(1);
    const [tx, ty] = [target % 9, Math.floor(target / 9)];
    for (let i = 0; i < Math.abs(tx - 4); i++) p.keys(tx > 4 ? "{right}" : "{left}");
    for (let i = 0; i < Math.abs(ty - 4); i++) p.keys(ty > 4 ? "{down}" : "{up}");
    p.run(1);
    p.keys("F");
    assert.ok(p.until((t) => /FLAGS 1/.test(t), 3));
    assert.equal(p.m.ram[0x62c0 + target], 2);
    p.keys("F");
    p.run(1);
    p.keys(" ");
    assert.ok(p.until((t) => /^BOOM!/m.test(t), 5));
  });
});

describe("our programs: Utilities", () => {
  it("Calendar: each month's first day and length as the calendar has them, leap years too; the arrows turn the months", () => {
    const p = typed("calendar");
    p.keys("2000\n2\n");
    assert.ok(p.until((t) => /^ +FEBRUARY 2000/m.test(t) && /^N: ANOTHER DATE/m.test(t), 10));
    const check = (/** @type {number} */ y, /** @type {number} */ m) => {
      const lines = p.screen().split("\n");
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const head = lines.findIndex((l) => /^ +SUN +MON/.test(l));
      assert.equal(lines[head + 2].search(/\S/), 3 + first * 5, `${y}-${m}: the 1st under its day`);
      const numbers = lines.slice(head + 1, head + 14).flatMap((l) => l.match(/\d+/g) ?? []).map(Number);
      assert.equal(Math.max(...numbers), days, `${y}-${m}: its days`);
    };
    check(2000, 2);
    p.keys("{down}");
    assert.ok(p.until((t) => /^ +FEBRUARY 2001/m.test(t) && /^N: ANOTHER DATE/m.test(t), 5));
    check(2001, 2);
    p.keys("{right}");
    assert.ok(p.until((t) => /^ +MARCH 2001/m.test(t) && /^N: ANOTHER DATE/m.test(t), 5));
    check(2001, 3);
    p.keys("N1987\n6\n");
    assert.ok(p.until((t) => /^ +JUNE 1987/m.test(t) && /^N: ANOTHER DATE/m.test(t), 5));
    check(1987, 6);
  });
  it("Clock: set to 10:09:30, it keeps the time by the screen's fields, a minute a minute, and draws its hands", () => {
    const p = typed("clock");
    p.keys("10\n9\n30\n");
    assert.ok(p.until((t) => /^PRESS A KEY TO SET THE TIME/m.test(t), 30));
    p.run(2);
    const time = () => [...p.m.ram.subarray(0x6f00, 0x6f03)];
    const [h0, m0, s0] = time();
    p.run(60);
    const [h1, m1, s1] = time();
    const passed = (h1 * 3600 + m1 * 60 + s1) - (h0 * 3600 + m0 * 60 + s0);
    assert.ok(Math.abs(passed - 60) <= 1, `${passed} s in 60`);
    let lit = 0;
    for (let a = 0x2000; a < 0x4000; a++) if (p.m.ram[a] & 0x7f) lit++;
    assert.ok(lit > 200, `${lit} bytes of the face and hands`);
    p.keys("Q");
    assert.ok(p.until((t) => p.m.text && !/PRESS A KEY/.test(t), 3));
  });
});

describe("our programs: Music", () => {
  it("Music box: Twinkle, Twinkle starts on do (C4, 262 Hz), its notes shown as they play", () => {
    const p = typed("musicbox");
    assert.ok(p.until((t) => /^WHICH TUNE/m.test(t), 10));
    p.m.speaker.length = 0;
    p.keys("3");
    for (let i = 0; i < 100 && !p.m.speaker.length; i++) p.run(0.05);
    p.run(0.2);
    const start = p.m.speaker[0];
    const first = tone(p.m.speaker.filter((c) => c - start < 0.2 * CLOCK_HZ));
    assert.ok(Math.abs(first.hz - 262) < 6, `${first.hz} Hz`);
    assert.ok(p.until((t) => /^1 1 5 5 6 6 5 -/m.test(t), 15));
  });
  it("Organ: 5 is sol (G4, 392 Hz), and an octave up 1 is high do (523 Hz); the key lights", () => {
    const p = typed("organ");
    assert.ok(p.until((t) => /^KEYS 1-7 PLAY/m.test(t), 15));
    const play = (/** @type {string} */ k) => {
      p.m.speaker.length = 0;
      p.keys(k);
      p.run(0.4);
      return tone(p.m.speaker).hz;
    };
    p.keys("5");
    assert.equal(block(p.m, 23, 10), 13, "sol lit");
    p.run(0.5);
    const sol = play("5");
    assert.ok(Math.abs(sol - 392) < 8, `${sol} Hz`);
    p.keys("{right}");
    p.run(0.3);
    const doHigh = play("1");
    assert.ok(Math.abs(doHigh - 523) < 10, `${doHigh} Hz`);
  });
});

describe("our programs: LOGO", () => {
  it("Kaleidoscope: typed in LOGO's editor from Western BASIC, its four procedures defined, a picture drawn in colour", () => {
    const p = typed("kaleidoscope");
    assert.ok(p.until((t) => ["SHAPE", "RING", "PICTURE", "KALEIDOSCOPE"].every((n) => new RegExp(`^${n} DEFINED`, "m").test(t)), 20));
    p.run(15);
    assert.ok(p.m.hires && !p.m.text && !p.m.mixed, "the full screen");
    assert.equal(p.m.c0b0 & 0x10, 0x10, "colour let through");
    let lit = 0;
    for (let a = 0x2000; a < 0x4000; a++) if (p.m.ram[a] & 0x7f) lit++;
    assert.ok(lit > 500, `${lit} bytes drawn`);
  });
});

/**
 * A BASIC program's simple numeric variable, read from its memory as CEC-BASIC keeps it (the
 * variables from VARTAB, $69, 7 bytes each: the name's two letters, then a 5-byte number).
 * @param {import("../js/sim/machine.js").Machine} m @param {string} name one or two letters
 * @returns {number | null}
 */
function basicVar(m, name) {
  const r = m.ram;
  const want = [name.charCodeAt(0), name.length > 1 ? name.charCodeAt(1) : 0];
  for (let a = r[0x69] | (r[0x6a] << 8), end = r[0x6b] | (r[0x6c] << 8); a < end; a += 7) {
    if (r[a] !== want[0] || r[a + 1] !== want[1]) continue;
    const e = r[a + 2];
    if (!e) return 0;
    const mant = ((r[a + 3] | 0x80) * 2 ** 24 + r[a + 4] * 2 ** 16 + r[a + 5] * 2 ** 8 + r[a + 6]) / 2 ** 32;
    return (r[a + 3] & 0x80 ? -1 : 1) * mant * 2 ** (e - 128);
  }
  return null;
}
/** The line CEC-BASIC is running (CURLIN, $75). @param {import("../js/sim/machine.js").Machine} m */
const line = (m) => m.ram[0x75] | (m.ram[0x76] << 8);

describe("our programs: Chinese", () => {
  it("Idiom quiz: typed in through 区位 in the Chinese system; ten right answers, full marks", () => {
    const p = typed("idioms");
    assert.ok(p.s.chineseOn, "the Chinese system on");
    p.run(2);
    p.keys(" ");
    for (let q = 1; q <= 10; q++) {
      for (let i = 0; i < 50 && line(p.m) !== 160; i++) p.run(0.1);
      assert.equal(line(p.m), 160, `question ${q} asked`);
      p.keys(String(basicVar(p.m, "R")));
      for (let i = 0; i < 50 && line(p.m) !== 190; i++) p.run(0.1);
      p.keys(" ");
    }
    for (let i = 0; i < 50 && line(p.m) !== 250; i++) p.run(0.1);
    assert.equal(basicVar(p.m, "S"), 10);
    assert.equal(line(p.m), 250, "asks to play again");
  });
  it("Word processor: letters full width, Chinese by 区位, new lines; editing in the middle; a long text wraps and scrolls", () => {
    const p = typed("wordproc");
    assert.ok(p.s.chineseOn);
    for (let i = 0; i < 100 && line(p.m) !== 90; i++) p.run(0.1);
    p.keys(" ");
    p.run(1);
    const word = (/** @type {number} */ a) => p.m.ram[a] | (p.m.ram[a + 1] << 8);
    const text = () => {
      /** @type {string[]} */
      const out = [];
      for (let a = 0x7000; a < word(0x6c04); a += 2) out.push(p.m.ram[a] === 0 ? "\n" : p.m.ram[a] === 3 ? String.fromCharCode(p.m.ram[a + 1] + 32) : p.m.ram[a] === 1 && p.m.ram[a + 1] === 1 ? " " : `[${p.m.ram[a]}-${p.m.ram[a + 1]}]`);
      return out.join("");
    };
    p.keys("HELLO, CEC-I{f3}54482710{f1}\nOK");
    p.run(1);
    assert.equal(text(), "HELLO, CEC-I[54-48][27-10]\nOK");
    assert.equal(word(0x6c06), 16, "16 characters, the new line not counted");
    // 中 on the screen: the first line's 13th cell, as the font has it
    const place = glyphPlace(4721);
    const zhong = [...p.m.font.subarray(place.bank * 0x4000 + place.window - 0x4000, place.bank * 0x4000 + place.window - 0x4000 + 32)];
    const at = findOnScreen(p.m.ram, 2, zhong);
    assert.deepEqual(at && [at.x, at.y], [12 * 16, 0]);
    // three to the left, delete, a letter in its place
    p.keys("{left}{left}{left}{f2}X");
    p.run(1);
    assert.equal(text(), "HELLO, CEC-I[54-48]X\nOK");
    // down to the second line's end (column 2), up to the first line's column 2, Return splits it there
    p.keys("{down}{up}\n");
    p.run(1);
    assert.equal(text(), "HE\nLLO, CEC-I[54-48]X\nOK");
    // a long text before OK: lines of 17 wrap, and the screen scrolls to keep the cursor on it
    p.keys("{down}{down}" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(8));
    p.run(2);
    assert.equal(text(), `HE\nLLO, CEC-I[54-48]X\n${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(8)}OK`);
    assert.ok(word(0x6c02) > 0x7000, "the top of the screen moved down the text");
    assert.equal(word(0x6c00), word(0x6c04) - 4, "the cursor before OK");
    assert.ok(p.m.ram[0x6c2a] < 10, "the cursor on the screen");
    p.keys("\x03");
    for (let i = 0; i < 30 && line(p.m) !== 100; i++) p.run(0.1);
    assert.equal(line(p.m), 100, "Quit: back to BASIC, which asks to edit again");
  });
});
