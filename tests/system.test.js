// SPDX-License-Identifier: Apache-2.0
//
// The rules every view obeys (js/sim/system.js): power only when whole, nothing out while it
// runs, a click taking out what is in the way first, the keys as anyone holds them, Type in
// and Save the program, and the machine's time.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { FAST_TYPING, KNOB_START, System } from "../js/sim/system.js";
import { blankDisk } from "../js/sim/disk-image.js";
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
  it("Reset the knobs: both back where they start, and it says so", () => {
    const { s, said } = rig();
    assert.ok(s.knobsAtStart);
    s.setKnob("brightness", 0.1);
    s.setKnob("colour", 0.2);
    assert.ok(!s.knobsAtStart);
    s.resetKnobs();
    assert.ok(s.knobsAtStart);
    assert.equal(said.at(-1), "knobs.reset");
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

describe("the CPU tool's clock", () => {
  it("paused, nothing runs; Step runs one instruction", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 1);
    s.pause();
    const c0 = s.machine.cycles;
    assert.equal(s.frame(0.02, 1000), 0);
    assert.equal(s.machine.cycles, c0);
    const pc = s.machine.cpu.pc;
    const n = s.step();
    assert.ok(n >= 2 && n <= 7, `${n} cycles`);
    assert.notEqual(s.machine.cpu.pc, pc);
    assert.equal(s.machine.cycles, c0 + n);
  });
  it("Run to stops before the instruction at the address, paused, and says where", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 4);
    /** @type {number[]} */
    const hit = [];
    s.onStop = (pc) => hit.push(pc);
    // BASIC waits for a key in the monitor's input loop at $FD1B
    s.runTo(0xfd1b);
    frames(s, 1);
    assert.deepEqual(hit, [0xfd1b]);
    assert.ok(s.paused);
    assert.equal(s.machine.cpu.pc, 0xfd1b);
    s.resume();
    s.frame(0.02, 99999);
    assert.notEqual(s.machine.cpu.pc, 0xfd1b, "resumed, it leaves the stop");
  });
  it("a slower clock runs a tenth, a hundredth of the cycles; no sound then", () => {
    const { s } = rig();
    s.power(true);
    s.setSpeed(0.1);
    let ran = 0;
    for (let i = 0; i < 10; i++) ran += s.frame(0.02, i * 20);
    assert.ok(Math.abs(ran - 0.2 * CLOCK_HZ * 0.1) < 100, `${ran}`);
    assert.ok(s.racing);
  });
  it("the memory traffic: the ROM and RAM read as BASIC runs, the latch written in 中文", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 4);
    s.frame(0.02, 5000);
    assert.ok(s.traffic.u7 > 0 && s.traffic.pages.some((n) => n > 0), "the ROM and the RAM read");
    s.type("{zhongwen}");
    let latch = 0;
    let font = 0;
    for (let i = 0; i < 150; i++) {
      s.frame(0.02, 6000 + i * 20);
      latch += s.traffic.latch;
      font += s.traffic.font;
    }
    assert.ok(latch > 0, "the Chinese system writes $C0B0");
    assert.ok(s.chineseOn);
    assert.ok(font >= 0);
  });
  it("peek reads without what reading does: the keyboard's strobe stays", () => {
    const { s } = rig();
    s.power(true);
    s.machine.keyPress(65);
    assert.equal(s.machine.peek(0xc010), 0);
    assert.equal(s.machine.peek(0xc000), 0xc1);
    assert.ok(s.machine.strobe);
    assert.equal(s.machine.peek(0xfffc), s.machine.read(0xfffc));
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

describe("what is refused, and said", () => {
  it("without ROMs the computer will not switch on; switched off, typing is refused", () => {
    const { s, said } = rig();
    s.hasRoms = false;
    assert.equal(s.power(true), false);
    assert.equal(said.at(-1), "power.noRoms");
    s.hasRoms = true;
    assert.equal(s.type("A"), false);
    assert.equal(said.at(-1), "type.off");
    assert.equal(s.typeProgram({ id: "x", section: "learn", mode: "western", text: "10 END" }, "x"), false);
    assert.equal(said.at(-1), "type.off");
  });
  it("a disk in and out is said; an empty drive emptied says nothing; starting from a disk switches off and on", () => {
    const { s, said } = rig();
    s.insertDisk(null);
    assert.ok(!said.includes("disk.out"));
    s.insertDisk(blankDisk("blank.dsk"));
    assert.equal(said.at(-1), "disk.in");
    s.insertDisk(null);
    assert.equal(said.at(-1), "disk.out");
    s.power(true);
    s.startFromDisk();
    assert.ok(s.machine.powered);
    assert.deepEqual(said.slice(-3), ["power.off", "power.onTvOff", "disk.start"]);
  });
  it("LOGO's procedures are asked of LOGO only", () => {
    const { s } = rig();
    s.power(true);
    frames(s, 4);
    assert.equal(s.logoRunning, false);
    assert.equal(s.logoProcedures(() => {}), false);
  });
});
