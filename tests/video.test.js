// SPDX-License-Identifier: Apache-2.0
//
// The picture (js/sim/video.js): the text, lo-res and hi-res modes, their colours on a colour
// TV, and the same memory on a black-and-white TV and a green monitor (design/decisions.md,
// D5, D6).

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Machine } from "../js/sim/machine.js";
import { GREEN_PHOSPHOR, hiresLineBase, LORES, TEXT_FIELD, TEXT_INK, textRowBase, Video, WIDTH } from "../js/sim/video.js";
import { ROMS } from "./boot.js";

/** A machine switched on but not run: the switches and memory set by hand. */
function machine() {
  const m = new Machine(ROMS);
  m.powered = true;
  m.c0b0 = 0x10;
  return m;
}
/** @param {Video} v @param {number} x @param {number} y */
const px = (v, x, y) => [...v.pixels.subarray((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 3)];

describe("the IIe's interleave", () => {
  it("text rows and hi-res lines start where the IIe has them", () => {
    assert.deepEqual([0, 1, 8, 23].map(textRowBase), [0, 128, 40, 0x3d0]);
    assert.deepEqual([0, 1, 8, 64, 191].map(hiresLineBase), [0, 1024, 128, 40, 0x1fd0]);
  });
});

describe("on a colour TV", () => {
  it("text with colour enabled: the green field, pale characters", () => {
    const m = machine();
    m.ram.fill(0xa0, 0x400, 0x800); // spaces
    m.ram[0x400] = 0xc1; // A
    const v = new Video(ROMS.u13);
    v.draw(m);
    assert.ok(v.greenText);
    assert.deepEqual(v.border, TEXT_FIELD);
    assert.deepEqual(px(v, 0, 7), TEXT_FIELD, "below the glyph: the field");
    const row = [...Array(14).keys()].map((x) => px(v, x, 2));
    assert.ok(row.some((c) => c.join() === TEXT_INK.join()), "the glyph's dots: the ink");
  });
  it("text with colour off ($C0B0 bit 4 clear): white on black", () => {
    const m = machine();
    m.c0b0 = 0;
    m.ram.fill(0x20, 0x400, 0x800); // inverse spaces: all lit
    const v = new Video(ROMS.u13);
    v.draw(m);
    assert.ok(!v.greenText);
    assert.deepEqual(px(v, 0, 0), [255, 255, 255]);
  });
  it("lo-res in the Apple palette", () => {
    const m = machine();
    m.text = false;
    m.ram[0x400] = 0x1d; // top: 13 (yellow), bottom: 1 (magenta)
    const v = new Video(ROMS.u13);
    v.draw(m);
    assert.deepEqual(px(v, 0, 0), LORES[13]);
    assert.deepEqual(px(v, 0, 4), LORES[1]);
  });
  it("hi-res: a lone dot coloured by its column and bit 7; two together white", () => {
    const m = machine();
    m.text = false;
    m.hires = true;
    m.ram[0x2000] = 0x01; // dot 0: violet
    m.ram[0x2000 + 1024] = 0x02; // line 1, dot 1: green
    m.ram[0x2000 + 2048] = 0x03; // line 2, dots 0 and 1: white
    const v = new Video(ROMS.u13);
    v.draw(m);
    assert.deepEqual(px(v, 0, 0), LORES[3]);
    assert.deepEqual(px(v, 2, 1), LORES[12]);
    assert.deepEqual(px(v, 0, 2), [255, 255, 255]);
  });
  it("switched off: black", () => {
    const m = machine();
    m.powered = false;
    const v = new Video(ROMS.u13);
    v.draw(m);
    assert.deepEqual(px(v, 100, 100), [0, 0, 0]);
  });
});

describe("on a black-and-white TV and a green monitor", () => {
  it("no colour is decoded: hi-res dots white (or green), text never green-tinted", () => {
    const m = machine();
    m.text = false;
    m.hires = true;
    m.ram[0x2000] = 0x01;
    const v = new Video(ROMS.u13);
    v.display = "bw";
    v.draw(m);
    assert.deepEqual(px(v, 0, 0), [255, 255, 255]);
    v.display = "green";
    v.draw(m);
    assert.deepEqual(px(v, 0, 0), GREEN_PHOSPHOR);
    m.text = true;
    v.draw(m);
    assert.ok(!v.greenText);
  });
  it("lo-res as greys of each colour's brightness", () => {
    const m = machine();
    m.text = false;
    m.ram[0x400] = 0x0f;
    const v = new Video(ROMS.u13);
    v.display = "bw";
    v.draw(m);
    assert.deepEqual(px(v, 0, 0), [255, 255, 255]);
    const [r, g, b] = px(v, 0, 4);
    assert.ok(r === g && g === b && r === 0);
  });
});
