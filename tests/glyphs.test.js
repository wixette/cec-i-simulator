// SPDX-License-Identifier: Apache-2.0
//
// How a Chinese character reaches the screen (js/sim/glyphs.js), read off the running machine
// as the Chinese tool reads it: the string's bytes, the latch, the 32 bytes, the dots.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findOnScreen, glyphOf, glyphPlace, GlyphWatch, rowPos, splitCode, stringVars } from "../js/sim/glyphs.js";
import { session } from "./boot.js";

describe("glyph numbers", () => {
  it("啊 (16, 1) is glyph 1102, 中 (54, 48) 4721, and back", () => {
    assert.equal(glyphOf(16, 1), 1102);
    assert.equal(glyphOf(54, 48), 4721);
    assert.deepEqual(rowPos(4721), { row: 54, pos: 48 });
    assert.equal(rowPos(100), null);
  });
  it("中 is in bank 9, at $4E20 in the window", () => {
    assert.deepEqual(glyphPlace(4721), { bank: 9, window: 0x4e20, font: 4721 * 32 });
  });
});

describe("中华学习机 on the running machine", () => {
  const s = session();
  const watch = new GlyphWatch();
  watch.attach(s.m);
  s.type("{zhongwen}", 2);
  s.type('10 A$="{f3}54482710490747162790{f1}"\nRUN\n', 1);
  watch.banks.length = 0;
  s.type('PRINT "{f3}5448{f1}"\n', 1);

  it("the string's bytes: A$ is 15 bytes, read back as 中华学习机", () => {
    const v = stringVars(s.m.ram).find((x) => x.name === "A$");
    assert.ok(v);
    assert.equal(v.bytes.length, 15);
    assert.equal(splitCode(v.bytes).map((p) => p.ch).join(""), "中华学习机");
  });

  it("the latch: printing 中 writes bank 9 to $C0B0, colour off in 中文", () => {
    assert.ok(watch.banks.includes(9), `banks ${watch.banks}`);
    assert.equal(watch.latch & 0x10, 0);
  });

  it("the 32 bytes: 中 is glyph 4721, read whole through the window, the font ROMs' own", () => {
    const g = watch.hanzi;
    assert.ok(g);
    assert.equal(g.d, 4721);
    assert.equal(g.bank, 9);
    assert.deepEqual(g.bytes, [...s.m.font.subarray(g.d * 32, g.d * 32 + 32)]);
  });

  it("the dots: the 16 x 16 found on hi-res page 2 at a 16-dot column, over 48 bytes", () => {
    const g = watch.hanzi;
    assert.ok(g);
    const at = findOnScreen(s.m.ram, 2, g.bytes);
    assert.ok(at);
    assert.equal(at.x % 16, 0);
    assert.equal(at.addrs.length, 48);
    assert.ok(s.m.shownPage2);
  });

  it("detached, the machine has no watch", () => {
    watch.detach();
    assert.equal(s.m.watch, null);
  });
});
