// SPDX-License-Identifier: Apache-2.0
//
// The speaker (js/sim/sound.js): a frame's flips of the cone become samples, a square wave
// through a high-pass, joined across frames.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { render } from "../js/sim/sound.js";

describe("the speaker's samples", () => {
  it("a frame's length of samples at the rate", () => {
    const out = render([], 0, CLOCK_HZ / 50, 0, 48000, { x: 0, y: 0 });
    assert.equal(out.length, 960);
  });
  it("a 1 kHz tone flips the wave's sign 2,000 times a second", () => {
    const toggles = [];
    for (let i = 1; i <= 200; i++) toggles.push((i * CLOCK_HZ) / 2000);
    const out = render(toggles, 0, CLOCK_HZ / 10, 0, 48000, { x: 0, y: 0 });
    let flips = 0;
    for (let i = 1; i < out.length; i++) if (Math.sign(out[i]) !== Math.sign(out[i - 1]) && Math.abs(out[i] - out[i - 1]) > 0.2) flips++;
    assert.ok(Math.abs(flips - 200) <= 2, `${flips}`);
  });
  it("a cone held still fades to silence (the high-pass)", () => {
    const hp = { x: 0, y: 0 };
    const out = render([1], 0, CLOCK_HZ, 0, 48000, hp);
    assert.ok(Math.abs(out[out.length - 1]) < 0.01);
  });
});
