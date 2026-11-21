// SPDX-License-Identifier: Apache-2.0
//
// The speaker (J8, driven by Q3): each access to $C030 flips the cone. A frame's flips become
// samples, a square wave through a high-pass (the cone does not hold a level), which Web
// Audio plays a little behind, frame after frame. render() is pure, for the tests.

import { CLOCK_HZ } from "./machine.js";

/**
 * The samples from cycle t0 to t1.
 * @param {number[]} toggles cycle numbers of the flips in [t0, t1)
 * @param {number} t0 @param {number} t1
 * @param {number} level the cone's side at t0 (0 or 1)
 * @param {number} rate samples a second
 * @param {{ x: number, y: number }} hp the filter's state, carried on
 */
export function render(toggles, t0, t1, level, rate, hp) {
  const n = Math.max(0, Math.round(((t1 - t0) / CLOCK_HZ) * rate));
  const out = new Float32Array(n);
  const a = 1 / (1 + (2 * Math.PI * 40) / rate);
  let v = level ? 0.25 : -0.25;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i / rate) * CLOCK_HZ;
    while (k < toggles.length && toggles[k] <= t) {
      v = -v;
      k++;
    }
    const y = a * (hp.y + v - hp.x);
    hp.x = v;
    hp.y = y;
    out[i] = y;
  }
  return out;
}

/** Plays the speaker in a browser. Browsers keep audio off until a gesture: unlock() from one. */
export class Speaker {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @private when the next frame's samples start, in the context's time */
    this.at = 0;
    /** @private */
    this.hp = { x: 0, y: 0 };
    /** @private the cone's side at the start of the next frame */
    this.level = 0;
    /** Sound off (the top bar's speaker button). */
    this.muted = false;
  }

  /** From a click or a key: audio may start. */
  unlock() {
    if (typeof AudioContext === "undefined") return;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
  }

  /** @param {boolean} m */
  setMuted(m) {
    this.muted = m;
  }

  /**
   * A frame of machine time: its flips taken from the machine, then queued to play (unless
   * `play` is false: the machine ran faster than real time, or the page is muted).
   * @param {import("./machine.js").Machine} m
   * @param {number} t0 the frame's first cycle
   * @param {boolean} [play]
   */
  frame(m, t0, play = true) {
    const t1 = m.cycles;
    const toggles = m.speaker.splice(0, m.speaker.length);
    const ctx = this.ctx;
    const level = this.level;
    this.level = (this.level + toggles.length) & 1;
    if (!ctx || this.muted || !play || t1 <= t0) return;
    if (!toggles.length && Math.abs(this.hp.y) < 1e-4) return; // silence: nothing to queue
    const data = render(toggles, t0, t1, level, ctx.sampleRate, this.hp);
    if (!data.length) return;
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.copyToChannel(data, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    // play 60 ms behind, so the frames join without gaps
    if (this.at < now + 0.02 || this.at > now + 0.2) this.at = now + 0.06;
    src.start(this.at);
    this.at += data.length / ctx.sampleRate;
  }
}
