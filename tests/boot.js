// SPDX-License-Identifier: Apache-2.0
//
// For the tests: the ROM set from roms/, a machine booted on it, and ways to work it as a
// person would, at the keyboard's own codes, and to read its screen and its speaker.

import { readFileSync } from "node:fs";
import { runFor, Typist } from "../js/sim/keyboard.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { ROM_FILES } from "../js/sim/roms.js";

/** @returns {import("../js/sim/machine.js").Roms} */
export function loadRoms() {
  const rom = (/** @type {keyof typeof ROM_FILES} */ c) => new Uint8Array(readFileSync(new URL(`../roms/${ROM_FILES[c].file}`, import.meta.url)));
  return { u7: rom("u7"), u35: rom("u35"), u33: rom("u33"), u34: rom("u34"), u13: rom("u13"), u26: rom("u26") };
}

/** @type {Record<string, [number, number] | string>} */
export const MATRIX = JSON.parse(readFileSync(new URL("../model/params/keyboard_matrix.json", import.meta.url), "utf8")).keys;

/** The ROMs, read once for all the tests in a file. */
export const ROMS = loadRoms();

/** The 40 x 24 text page 1, a string a row (Machine.screenText). @param {Machine} m */
export const screenLines = (m) => m.screenText();

/**
 * The speaker's tone in a run of toggles: its frequency and how long it sounded (the longest
 * burst with no gap over 20 ms).
 * @param {number[]} toggles
 */
export function tone(toggles) {
  if (toggles.length < 4) return { hz: 0, s: 0 };
  let best = [0, 0];
  let start = 0;
  for (let i = 1; i <= toggles.length; i++) {
    if (i === toggles.length || toggles[i] - toggles[i - 1] > 0.02 * CLOCK_HZ) {
      if (i - start > best[1] - best[0]) best = [start, i];
      start = i;
    }
  }
  const [a, b] = best;
  const s = (toggles[b - 1] - toggles[a]) / CLOCK_HZ;
  return { hz: s > 0 ? (b - a - 1) / 2 / s : 0, s };
}

/** A fresh machine, switched on and run to BASIC's prompt, and ways to work it. */
export function session() {
  const m = new Machine(ROMS);
  const t = new Typist(m);
  m.powerOn();
  runFor(m, 4, [t]);
  return {
    m,
    t,
    /** @param {number} s */
    run: (s) => runFor(m, s, [t]),
    /** Type, and run until it is all taken and `after` seconds more. @param {string} text @param {number} [after] */
    type(text, after = 1) {
      t.type(text);
      let guard = 0;
      while (t.busy && guard++ < 4000) runFor(m, 0.05, [t]);
      runFor(m, after, [t]);
    },
    /** Run until the program waits at a prompt for a key (within `max` s). @param {number} max */
    untilIdle(max) {
      const end = m.cycles + max * CLOCK_HZ;
      // waiting for a key: the ROM polls $C000; seen as the PC inside the input loop a while
      let quiet = 0;
      while (m.cycles < end) {
        runFor(m, 0.01, [t]);
        const pc = m.cpu.pc;
        quiet = pc >= 0xfd1b && pc <= 0xfd2e ? quiet + 1 : 0;
        if (quiet > 3) break;
      }
    },
    text: () => screenLines(m),
    /** Run until the screen's text passes `test` (or `max` s); the text then. @param {(t: string) => boolean} test @param {number} max */
    until(test, max) {
      const end = m.cycles + max * CLOCK_HZ;
      let txt = screenLines(m).join(" ");
      while (!test(txt) && m.cycles < end) {
        runFor(m, 0.5, [t]);
        txt = screenLines(m).join(" ");
      }
      return txt;
    },
    /** A BASIC expression's value, by PRINTing it and reading the line. @param {string} expr */
    print(expr) {
      this.type(`PRINT "=";${expr}\n`, 0.5);
      return this.out();
    },
    /** The last output marked "=" at its start, its wrapped lines joined (up to the next prompt). */
    out() {
      const lines = screenLines(m);
      let at = -1;
      lines.forEach((l, i) => {
        if (l.startsWith("=")) at = i;
      });
      if (at < 0) return "";
      let s = lines[at].slice(1);
      for (let i = at + 1; i < lines.length && !lines[i].startsWith("]"); i++) s += lines[i];
      return s.replace(/ +/g, " ").trim();
    },
  };
}
