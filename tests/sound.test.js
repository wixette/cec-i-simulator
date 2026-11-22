// SPDX-License-Identifier: Apache-2.0
//
// The speaker (js/sim/sound.js): a frame's flips of the cone become samples, a square wave
// through a high-pass, joined across frames.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { render, Speaker } from "../js/sim/sound.js";

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

describe("the speaker in a page (a stand-in for Web Audio)", () => {
  /** A machine's speaker flips, and an audio context that records what is queued. */
  function rig() {
    /** @type {{ at: number, length: number }[]} */
    const queued = [];
    const ctx = {
      sampleRate: 48000,
      currentTime: 10,
      destination: {},
      state: "running",
      createBuffer: (/** @type {number} */ _c, /** @type {number} */ length) => ({ length, copyToChannel() {} }),
      createBufferSource() {
        /** @type {any} */
        const src = { connect() {}, start: (/** @type {number} */ at) => queued.push({ at, length: src.buffer.length }) };
        return src;
      },
    };
    const sp = new Speaker();
    sp.ctx = /** @type {any} */ (ctx);
    const m = { cycles: 0, speaker: /** @type {number[]} */ ([]) };
    return { sp, m, ctx, queued };
  }
  it("a frame's flips are queued 60 ms behind, and the next frame joins on where it ended", () => {
    const { sp, m, queued } = rig();
    const frame = Math.round(CLOCK_HZ / 50);
    m.speaker.push(100, 200, 300);
    m.cycles = frame;
    sp.frame(/** @type {any} */ (m), 0);
    m.speaker.push(frame + 100);
    m.cycles = 2 * frame;
    sp.frame(/** @type {any} */ (m), frame);
    assert.equal(queued.length, 2);
    assert.ok(Math.abs(queued[0].at - 10.06) < 1e-9, "60 ms behind");
    assert.ok(Math.abs(queued[1].at - (queued[0].at + queued[0].length / 48000)) < 1e-9, "joined on");
    assert.equal(m.speaker.length, 0, "the flips are taken");
  });
  it("muted, or racing ahead of real time, nothing is queued, but the cone's side is kept", () => {
    const { sp, m, queued } = rig();
    m.speaker.push(10);
    m.cycles = 20000;
    sp.setMuted(true);
    sp.frame(/** @type {any} */ (m), 0);
    sp.setMuted(false);
    m.speaker.push(20010, 20020, 20030);
    m.cycles = 40000;
    sp.frame(/** @type {any} */ (m), 20000, false);
    assert.equal(queued.length, 0);
    assert.equal(/** @type {any} */ (sp).level, 0, "four flips: back where it began");
  });
  it("silence queues nothing; a queue fallen behind starts again 60 ms ahead", () => {
    const { sp, m, ctx, queued } = rig();
    m.cycles = 20000;
    sp.frame(/** @type {any} */ (m), 0);
    assert.equal(queued.length, 0, "no flips, no sound left in the filter");
    m.speaker.push(20500);
    m.cycles = 40000;
    sp.frame(/** @type {any} */ (m), 20000);
    ctx.currentTime = 30;
    m.speaker.push(40500);
    m.cycles = 60000;
    sp.frame(/** @type {any} */ (m), 40000);
    assert.ok(Math.abs(queued[1].at - 30.06) < 1e-9);
  });
});
