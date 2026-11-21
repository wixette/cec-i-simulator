// SPDX-License-Identifier: Apache-2.0
//
// The machine on its ROMs, against what a real CEC-I does (research/README.md,
// "Measured on a real machine"): each test boots a fresh machine and types into it as a
// person would, at the keyboard's own codes.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { codeByte } from "../js/sim/chinese.js";
import { Keyboard, runFor } from "../js/sim/keyboard.js";
import { CLOCK_HZ, FIELD_CYCLES, Machine } from "../js/sim/machine.js";
import { Video } from "../js/sim/video.js";
import { MATRIX, ROMS, session, screenLines, tone } from "./boot.js";

describe("switching on", () => {
  it("beeps (about 935 Hz for 0.1 s), shows the banner and the prompt, colour on", () => {
    const m = new Machine(ROMS);
    m.powerOn();
    runFor(m, 4, []);
    const lines = screenLines(m);
    const beep = tone(m.speaker);
    assert.ok(lines.includes("           ZHONG HUA XUE XI JI"), lines.join("\n"));
    assert.ok(lines.includes("               VERSION 1.1"));
    assert.ok(lines.some((l) => /^\]/.test(l)));
    assert.equal(m.c0b0, 0x10);
    assert.ok(Math.abs(beep.hz - 935) < 60, `${beep.hz} Hz`);
    assert.ok(beep.s > 0.07 && beep.s < 0.16, `${beep.s} s`);
  });

  it("switched off, it runs nothing", () => {
    const m = new Machine(ROMS);
    assert.equal(m.run(1000), 0);
  });
});

describe("timing", () => {
  it("50 fields a second: 3,000 fields of $C019 take 60 s, beep to beep", () => {
    const s = session();
    s.type("NEW\n10 S=0: FOR I=832 TO 852: READ B: POKE I,B: S=S+B: NEXT\n20 IF S<>3261 THEN PRINT \"DATA ERROR\": END\n30 PRINT CHR$(7);\"START\": CALL 832: PRINT CHR$(7);\"STOP\"\n100 DATA 160,12,162,250,173,25,192,16,251,173,25,192,48,251,202,208,243,136,208,238,96\n", 0.5);
    s.m.speaker.length = 0;
    s.type("RUN\n", 64);
    const t = s.m.speaker;
    let gapAt = 0;
    for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] > 10 * CLOCK_HZ) gapAt = i;
    const secs = gapAt ? (t[gapAt] - t[0]) / CLOCK_HZ : 0;
    assert.ok(Math.abs(secs - 60) < 1, `${secs} s`);
    assert.ok(s.text().some((l) => l === "STOP"));
  });

  it("1,700 中 printed between two beeps in 42.03 s on a real machine (within 5 %)", () => {
    const s = session();
    s.type("{zhongwen}", 2);
    s.type('10 PRINT CHR$(7): FOR I=1 TO 1700: PRINT "{f3}5448{f1}";: NEXT: PRINT CHR$(7)\n', 0.5);
    s.m.speaker.length = 0;
    s.type("RUN\n", 0);
    s.run(48);
    const t = s.m.speaker;
    const starts = t.filter((x, i) => i === 0 || x - t[i - 1] > 0.05 * CLOCK_HZ);
    assert.ok(starts.length >= 2, `${starts.length} beep(s)`);
    const sec = (starts[1] - starts[0]) / CLOCK_HZ;
    assert.ok(Math.abs(sec - 42.03) / 42.03 < 0.05, `${sec} s`);
  });

  it("FLASH text: 20 flashes in 12.8 s", () => {
    const flashes = (12.8 * CLOCK_HZ) / FIELD_CYCLES / 32;
    assert.ok(Math.abs(flashes - 20) < 0.5);
  });
});

describe("the ROMs as the machine reads them", () => {
  it("checksums of the main ROM, the tables, the Chinese ROM and the language card's pages give a real machine's numbers", () => {
    const s = session();
    s.type("NEW\n10 S=0: FOR I=768 TO 813: READ B: POKE I,B: S=S+B: NEXT\n20 IF S<>6724 THEN PRINT \"DATA ERROR\": END\n30 HOME: FOR T=1 TO 3: READ N$,H,P,V,A,B: GOSUB 200: NEXT\n50 READ N$,H,P,V,A,B: GOSUB 200\n60 POKE 49328,16: END\n100 DATA 165,9,141,176,192,141,3,192,169,0,133,250,133,251,133,252,160,0,177,6,24,101,250\n110 DATA 133,250,144,6,230,251,208,2,230,252,200,208,238,230,7,198,8,208,232,141,2,192,96\n120 DATA MAIN,208,48,16,2,2,T10,128,64,16,3,2,T30,128,64,48,3,2,CHIN,208,48,16,9,8\n200 POKE 6,0: POKE 7,H: POKE 8,P: POKE 9,V: POKE 774,A: POKE 811,B: CALL 768\n210 PRINT N$;\" \";PEEK(250)+256*PEEK(251)+65536*PEEK(252): RETURN\nRUN\n", 0.2);
    s.untilIdle(60);
    const p1 = s.text().filter((l) => /^[A-Z0-9]+ \d+$/.test(l)).join(", ");
    assert.equal(p1, "MAIN 1594602, T10 2685544, T30 1809416, CHIN 1594602");
    s.type("NEW\n5 RESTORE\n10 S=0: FOR I=768 TO 819: READ B: POKE I,B: S=S+B: NEXT\n20 IF S<>7395 THEN PRINT \"DATA ERROR\": END\n30 HOME: FOR T=1 TO 5: READ N$,H,P,A,C,B,D\n40 POKE 6,0: POKE 7,H: POKE 8,P: POKE 9,16: POKE 774,A: POKE 777,C: POKE 814,B: POKE 817,D: CALL 768\n50 PRINT N$;\" \";PEEK(250)+256*PEEK(251)+65536*PEEK(252): NEXT: END\n100 DATA 165,9,141,176,192,141,3,192,141,3,192,169,0,133,250,133,251,133,252,160,0,177,6,24,101,250\n110 DATA 133,250,144,6,230,251,208,2,230,252,200,208,238,230,7,198,8,208,232,141,2,192,141,2,192,96\n120 DATA D0,208,16,2,2,2,2,E0,224,16,2,2,2,2,F0,240,16,2,2,2,2\n130 DATA CX,193,15,7,7,6,6,CHIN,208,48,9,128,8,130\nRUN\n", 0.2);
    s.untilIdle(60);
    const p3 = s.text().filter((l) => /^[A-Z0-9]+ \d+$/.test(l)).join(", ");
    assert.equal(p3, "D0 540977, E0 529555, F0 524070, CX 609671, CHIN 1595707");
    s.type("300 HOME: FOR H=193 TO 255: IF H>223 AND H<240 THEN 340\n310 A=2: B=2: IF H<208 THEN A=7: B=6\n320 POKE 6,0: POKE 7,H: POKE 8,1: POKE 9,16: POKE 774,A: POKE 777,A: POKE 814,B: POKE 817,B: CALL 768\n330 PRINT H;\"=\";PEEK(250)+256*PEEK(251);\" \";\n340 NEXT: END\nRUN 300\n", 0.2);
    s.untilIdle(60);
    const p4 = s.text().join(" ");
    for (const page of ["200=36297", "205=40327", "211=44378", "250=32709"]) assert.ok(p4.includes(page), page);
  });

  it("$C0B0 is written only: a read gives $BF", () => {
    const s = session();
    assert.equal(s.print("PEEK(49328)"), "191");
  });
});

describe("Chinese", () => {
  it("中华学习机 is 15 bytes in a string, its right five N.机, and lists as ▒UO… in Western mode", () => {
    const s = session();
    s.type("{zhongwen}", 2);
    s.type('10 A$="{f3}54482710490747162790{f1}"\n', 1);
    s.type("{xiwen}", 1);
    s.type("RUN\n", 1);
    assert.equal(s.print("LEN(A$)"), "15");
    s.type('PRINT "=";: FOR I=1 TO 15: PRINT ASC(MID$(A$,I,1));" ";: NEXT: PRINT\n', 1);
    assert.equal(s.out(), "127 85 79 127 57 39 127 80 36 127 78 46 127 57 121");
    assert.equal(s.print("RIGHT$(A$,5)"), "N.▒9y");
    s.type("LIST\n", 1);
    assert.equal(s.text().find((l) => /^10 +A\$/.test(l))?.replace(/ +/g, " "), '10 A$ = "▒UO▒9\'▒P$▒N.▒9y"');
  });

  it("pinyin zhong gives 中盅忠钟衷终 in order; 区位 1601 gives 啊", () => {
    const s = session();
    s.type("{zhongwen}", 2);
    s.type('10 A$="{f2}zhong1zhong2zhong3zhong4zhong5zhong6{f1}"\n20 B$="{f3}1601{f1}"\n', 1);
    s.type("{xiwen}", 1);
    s.type("RUN\n", 1);
    s.type('PRINT "=";: FOR I=1 TO 18: PRINT ASC(MID$(A$,I,1));" ";: NEXT: PRINT\n', 1);
    assert.equal(s.out(), [48, 49, 50, 51, 52, 53].map((p) => `127 ${codeByte(54)} ${codeByte(p)}`).join(" "));
    s.type('PRINT "=";: FOR I=1 TO 3: PRINT ASC(MID$(B$,I,1));" ";: NEXT: PRINT\n', 1);
    assert.equal(s.out(), `127 ${codeByte(16)} ${codeByte(1)}`);
  });

  it("the Chinese screen is hi-res with colour off; HIMEM 49152, then 37376, and 37376 back in Western mode", () => {
    const s = session();
    assert.equal(s.print("PEEK(115)+256*PEEK(116)"), "49152");
    s.type("{zhongwen}", 2);
    assert.ok(!s.m.text && s.m.hires && !(s.m.c0b0 & 0x10));
    assert.equal(s.m.ram[0x73] + 256 * s.m.ram[0x74], 37376);
    s.type("{xiwen}", 1);
    assert.equal(s.print("PEEK(115)+256*PEEK(116)"), "37376");
  });
});

describe("the self-test, the monitor, reset", () => {
  const lines = ["RAM", "BFFF", "OK", "BNK1", "BNK2", "ROM1", "LOGO", "ROM2", "CEC-BASIC", "AUX1", "HZTABLE", "AUX2", "HZPROGRAM", "AUX3", "CECWL"];
  /** @param {string} t */
  const passes = (t) => t.includes("MEMORY") && lines.every((w) => t.includes(w)) && !/ERR/.test(t);

  it("Ctrl-Reset-TEST at a person's pace runs the self-test, every line OK", () => {
    const s = session();
    const kb = new Keyboard(s.m, MATRIX);
    const hold = (/** @type {number} */ sec) => runFor(s.m, sec, [kb]);
    kb.down("ctrl");
    hold(0.5);
    kb.down("test");
    hold(1);
    kb.down("reset");
    hold(0.3);
    kb.up("reset");
    hold(0.3);
    kb.up("test");
    kb.up("ctrl");
    assert.ok(passes(s.until((t) => /AUX3 +7FFF +CECWL/.test(t), 100)));
  });

  it("the monitor's C007:0, CB80G runs it too; D350G starts the mini-assembler", () => {
    const s = session();
    s.type("CALL -151\nC007:0\nCB80G\n", 0);
    assert.ok(passes(s.until((t) => /AUX3 +7FFF +CECWL/.test(t), 100)));
    const s2 = session();
    s2.type("CALL -151\n", 0.5);
    s2.type("D350G\n", 0.5);
    assert.ok(s2.text().some((l) => l.startsWith("!")));
  });

  it("Ctrl-Reset keeps the program, and from 中文 comes back to Western mode with a beep", () => {
    const s = session();
    s.type('10 PRINT "KEPT"\n', 0.3);
    s.m.reset();
    s.run(2);
    s.type("LIST\n", 0.5);
    assert.ok(s.text().some((l) => /^10 +PRINT "KEPT"/.test(l)));
    s.type("{zhongwen}", 2);
    s.m.speaker.length = 0;
    s.m.reset();
    s.run(2);
    assert.ok(tone(s.m.speaker).s > 0.05);
    assert.ok(s.m.text);
    s.type("LIST\n", 0.5);
    assert.ok(s.text().some((l) => /^10 +PRINT "KEPT"/.test(l)));
  });

  it("the RESET line held low stops the 6502 until it is let go", () => {
    const s = session();
    const pc = s.m.cpu.pc;
    const c0 = s.m.cycles;
    s.m.holdReset(true);
    s.run(0.5);
    assert.equal(s.m.cpu.pc, pc, "stopped");
    assert.ok(s.m.cycles - c0 >= 0.5 * CLOCK_HZ, "time goes on");
    s.m.holdReset(false);
    assert.equal(s.m.cpu.pc, s.m.read(0xfffc) | (s.m.read(0xfffd) << 8), "the reset runs as the line goes high");
  });
});

describe("sound", () => {
  it("MUSIC 192,110 sounds A3 (220 Hz), MUSIC 128,110 E4 (330 Hz)", () => {
    const s = session();
    s.m.speaker.length = 0;
    s.type("MUSIC 192,110\n", 1);
    const a = tone(s.m.speaker);
    s.m.speaker.length = 0;
    s.type("MUSIC 128,110\n", 1);
    const e = tone(s.m.speaker);
    assert.ok(Math.abs(a.hz - 220) < 220 * 0.03, `${a.hz}`);
    assert.ok(Math.abs(e.hz - 330) < 330 * 0.03, `${e.hz}`);
    assert.ok(a.s > 0.2 && a.s < 0.4, `${a.s}`);
  });
});

describe("LOGO and the green picture", () => {
  it("LG starts LOGO with its banner; the picture is green in BASIC's text, white in LOGO's and in 中文", () => {
    const s = session();
    const v = new Video(ROMS.u13);
    v.draw(s.m);
    assert.ok(v.greenText, "BASIC's text is green");
    s.type("LG\n", 4);
    const banner = s.text().filter((l) => l.trim()).map((l) => l.trim()).join(" / ");
    assert.ok(banner.startsWith("CHINESE EDUCATION COMPUTER / L O G O / VERSION 1.1 / 1987.6 / ?"), banner);
    v.draw(s.m);
    assert.ok(!v.greenText, "LOGO's text is white");
    s.type("FD 50 RT 90 FD 50\n", 2);
    assert.ok(s.m.hires && s.m.mixed, "the turtle draws in mixed hi-res");
    const s2 = session();
    s2.type("{zhongwen}", 2);
    v.draw(s2.m);
    assert.ok(!v.greenText, "中文 is white");
  });
});
