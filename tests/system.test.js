// SPDX-License-Identifier: Apache-2.0
//
// The rules every view obeys (js/sim/system.js): power only when whole, nothing out while it
// runs, a click taking out what is in the way first, the keys as anyone holds them, Type in
// and Save the program, and the machine's time.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { FAST_TYPING, KNOB_START, System } from "../js/sim/system.js";
import { MATRIX, ROMS, screenLines } from "./boot.js";

const ORDER = [
  { unit: "case.lid", requires: [] },
  { unit: "keyboard", requires: ["case.lid"] },
  { unit: "board.main", requires: ["keyboard"] },
];

function rig() {
  const s = new System({ roms: ROMS, matrix: MATRIX, takeApart: ORDER });
  // the machine's time, not the test computer's: no frame is cut short for being slow
  s.frameBudgetMs = Infinity;
  /** @type {string[]} */
  const said = [];
  s.say = (m) => said.push(m.key);
  return { s, said };
}

/** Runs the machine `sec` seconds of wall time, a frame at a time, as fast as it will go. @param {System} s @param {number} sec */
function frames(s, sec) {
  let t = 0;
  for (let i = 0; i < sec * 50; i++) s.frame(0.02, (t += 20));
}

/** Moves the parts until they stop. @param {System} s */
function settle(s) {
  for (let i = 0; i < 1000 && s.stepMotion(0.05); i++);
}

describe("power and the TV", () => {
  it("switches on, and says the TV is off; the TV says whether there is a picture", () => {
    const { s, said } = rig();
    assert.ok(s.power(true));
    assert.ok(s.machine.powered);
    assert.equal(said.at(-1), "power.onTvOff");
    s.tvPower(true);
    assert.equal(said.at(-1), "tv.on");
    assert.ok(!s.power(true), "already on");
  });
  it("the knobs stay between 0 and 1, and go back to where they start", () => {
    const { s } = rig();
    s.setKnob("brightness", 2);
    assert.equal(s.tv.brightness, 1);
    s.resetKnob("brightness");
    assert.equal(s.tv.brightness, KNOB_START.brightness);
  });
  it("on a black-and-white TV or a green monitor, the colour knob turns but does nothing, and says so (D6)", () => {
    const { s, said } = rig();
    s.setKnob("colour", 0.2);
    assert.equal(s.colourKnob, 0.2, "a colour TV takes it");
    s.setDisplay("green");
    assert.equal(s.colourKnob, KNOB_START.colour);
    s.setKnob("colour", 0);
    assert.equal(s.tv.colour, 0, "the knob still turns");
    assert.equal(said.at(-1), "knob.colourNone.green");
    s.setDisplay("bw");
    s.setKnob("colour", 0.5);
    assert.equal(said.at(-1), "knob.colourNone.bw");
    assert.equal(s.colourKnob, KNOB_START.colour);
  });

  it("the display type reaches the picture", () => {
    const { s, said } = rig();
    s.setDisplay("green");
    assert.equal(s.video.display, "green");
    assert.equal(said.at(-1), "display.green");
  });
});

describe("taking it apart", () => {
  it("nothing comes out while it is on", () => {
    const { s, said } = rig();
    s.power(true);
    assert.ok(!s.toggleUnit("case.lid"));
    assert.equal(said.at(-1), "apart.poweredOn");
    assert.ok(!s.takeAllApart());
  });
  it("a click on the board takes out the lid and the keyboard first, in order", () => {
    const { s } = rig();
    s.toggleUnit("board.main");
    assert.deepEqual([...s.motion.values()].map((m) => m.target), [1, 1, 1]);
    s.stepMotion(0.1);
    assert.ok((s.motion.get("case.lid")?.f ?? 0) > 0);
    assert.equal(s.motion.get("keyboard")?.f, 0, "the keyboard waits for the lid");
    settle(s);
    assert.deepEqual([...s.motion.values()].map((m) => m.f), [1, 1, 1]);
  });
  it("the computer will not switch on while apart, and putting the lid back puts back what sits on it", () => {
    const { s, said } = rig();
    s.toggleUnit("keyboard");
    settle(s);
    assert.ok(!s.power(true));
    assert.equal(said.at(-1), "power.apart");
    s.toggleUnit("case.lid");
    assert.deepEqual([...s.motion.values()].map((m) => m.target), [0, 0, 0]);
    settle(s);
    assert.ok(s.whole);
    assert.ok(s.power(true));
  });
  it("putting everything back at once (going to 2D)", () => {
    const { s } = rig();
    s.takeAllApart();
    settle(s);
    assert.ok(s.putBackNow());
    assert.ok(s.whole);
    assert.ok(!s.putBackNow());
  });
});

describe("keys", () => {
  it("a key is shown down while held, by the keyboard or the pointer", () => {
    const { s } = rig();
    s.power(true);
    s.keyDown("a", "key");
    s.keyDown("b", "pointer");
    assert.deepEqual([...s.keysDown()].sort(), ["a", "b"]);
    s.keyUp("a", "key");
    s.keyUp("b", "pointer");
    assert.deepEqual([...s.keysDown()], []);
    assert.ok(s.keyboard.caps, "Caps Lock latched, as the machine starts");
  });
  it("a key typed by the typist shows down a moment", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 4);
    s.type('"');
    s.frame(0.02, 100000);
    assert.ok(s.keysDown().has("quote") && s.keysDown().has("lshift"));
    s.frame(0.02, 100500);
    assert.ok(!s.keysDown().has("quote"));
  });
  it("Ctrl-Reset from the strip: refused while off; on, the reset runs once RESET is let go", () => {
    const { s, said } = rig();
    assert.ok(!s.ctrlReset());
    assert.equal(said.at(-1), "reset.off");
    s.power(true);
    /** @type {(() => void)[]} */
    const later = [];
    s.ctrlReset((f) => later.push(f));
    assert.ok(s.machine.resetLow);
    later[0]();
    assert.ok(!s.machine.resetLow);
    assert.ok(!s.keysDown().has("ctrl"));
  });
});

describe("Type in and Save the program", () => {
  it("refused while off; a character the machine cannot type refuses the text", () => {
    const { s, said } = rig();
    assert.ok(!s.typeIn("PRINT 1\n"));
    assert.equal(said.at(-1), "type.off");
    s.power(true);
    assert.ok(!s.typeIn('PRINT "€"\n'));
    assert.equal(said.at(-1), "type.refused");
  });
  it("a program with Chinese: the 中文 key first, NEW, then the lines; saved back as typed (capitals, as Caps Lock gives them)", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 4);
    s.machine.ram.fill(0, 0x800, 0x900);
    assert.ok(!s.chineseOn);
    s.typeIn('10 print "中华学习机"\n', { program: true });
    frames(s, 6);
    assert.ok(s.chineseOn);
    assert.equal(s.listing(), '10 PRINT "中华学习机"\n');
  });
  it("typing runs the machine faster, and the machine keeps real time otherwise", () => {
    const { s } = rig();
    s.power(true);
    let ran = s.frame(0.02, 0);
    assert.ok(Math.abs(ran - 0.02 * CLOCK_HZ) < 2000);
    s.type("PRINT\n");
    ran = s.frame(0.02, 20);
    assert.ok(ran > 0.02 * CLOCK_HZ * (FAST_TYPING - 1), `${ran}`);
    assert.ok(s.racing);
  });
  it("a frame that runs over its budget stops, and the machine runs slow rather than freeze", () => {
    const { s } = rig();
    s.power(true);
    s.frameBudgetMs = 0;
    const ran = s.frame(0.02, 0);
    assert.ok(ran > 0 && ran < 0.02 * CLOCK_HZ, `${ran}`);
    assert.ok(s.speed < 1);
  });
  it("Western BASIC's prompt after switching on, in frames", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 4);
    assert.ok(screenLines(s.machine).some((l) => l.startsWith("]")));
  });
});
