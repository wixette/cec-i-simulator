// SPDX-License-Identifier: Apache-2.0
//
// Our own programs (design/v0.0.3.md, P1), in js/programs/ by section, typed in for the visitor
// on the machine's keys, as a listing from a magazine was. Each runs in one of the machine's
// three modes: Western BASIC, the Chinese system, or LOGO; the typist gets the machine there
// first. Machine code is kept as assembly (js/sim/asm6502.js) and goes into the listing as
// DATA lines, so that the two never disagree. Titles and descriptions are messages
// (`sample.<id>.title`, `.about`); the listing is the machine's own text.

import { assemble, dataLines } from "./asm6502.js";
import { planTyping } from "./chinese.js";

/**
 * @typedef {"learn" | "chinese" | "games" | "utilities" | "music" | "logo"} Section
 * @typedef {"western" | "chinese" | "logo"} Mode
 * @typedef {object} Code machine code: its assembly, where it goes, the DATA lines' first number
 * @property {string} source
 * @property {number} org
 * @property {number} line
 * @typedef {object} Sample
 * @property {string} id
 * @property {Section} section where Programs lists it
 * @property {Mode} mode the mode it is typed in and runs in
 * @property {string} text the listing (BASIC lines; for LOGO, its procedures, typed in LOGO's editor), without RUN
 * @property {Code} [code] its machine code, if it has some
 * @property {string} [run] what starts it once typed in (BASIC: RUN)
 */

import { CHINESE } from "../programs/chinese.js";
import { GAMES } from "../programs/games.js";
import { LEARN } from "../programs/learn.js";
import { LOGO } from "../programs/logo.js";
import { MUSIC } from "../programs/music.js";
import { UTILITIES } from "../programs/utilities.js";

/** Programs' sections, in the menu's order. @type {readonly Section[]} */
export const SECTIONS = ["learn", "chinese", "games", "utilities", "music", "logo"];

/** @type {readonly Sample[]} */
export const SAMPLES = [...LEARN, ...CHINESE, ...GAMES, ...UTILITIES, ...MUSIC, ...LOGO];

/** How long the Chinese system takes to start once 中文 is pressed, and LOGO once LG is typed, s. */
const CHINESE_START_S = 2.5;
const LOGO_START_S = 3;

/** A sample's machine code, assembled. @param {Sample} s */
export function machineCode(s) {
  return s.code ? assemble(s.code.source, s.code.org) : null;
}

/**
 * A sample's whole listing: its BASIC with its machine code as DATA lines from code.line, ended
 * by -1 (the loader POKEs until it reads one), every line in its number's order, as LIST shows it.
 * @param {Sample} s
 */
export function listing(s) {
  const code = machineCode(s);
  const text = s.text.trimEnd();
  if (!code || !s.code) return text;
  const lines = [...text.split("\n"), ...dataLines([...code.bytes, -1], s.code.line).split("\n")];
  const num = (/** @type {string} */ l) => Number(/^\d+/.exec(l)?.[0] ?? 0);
  return lines.sort((a, b) => num(a) - num(b)).join("\n");
}

/**
 * What the typist types for a sample (design/v0.0.3.md, P1), as an owner did, from whatever the
 * machine is doing: Ctrl-Reset, which stops whatever runs and brings BASIC's prompt back, or,
 * from LOGO, the monitor's (then Ctrl-B, BASIC started afresh); then the sample's mode (中文
 * for the Chinese system, LG for LOGO), NEW, the listing, and what starts it. The answer to the
 * monitor's question is asked of the machine when the typist reaches it.
 * @param {Sample} s
 * @returns {{ before: string, monitor: (screen: string[]) => string, after: string }}
 */
export function typingPlan(s) {
  const before = "{reset}{wait:0.6}";
  const monitor = (/** @type {string[]} */ screen) => (screen.filter((l) => l.trim()).at(-1)?.startsWith("*") ? "\x02\n{wait:0.6}" : "");
  const body = listing(s);
  let after;
  // LOGO: TO opens its editor; Ctrl-C defines all that was typed in it
  if (s.mode === "logo") after = `LG\n{wait:${LOGO_START_S}}${body}\n\x03{wait:2}${s.run ?? ""}`;
  else {
    const text = `NEW\n${body}\n${s.run ?? "RUN\n"}`;
    after = s.mode === "chinese" ? `{zhongwen}{wait:${CHINESE_START_S}}${planTyping(text).keys}` : planTyping(text).keys;
  }
  return { before, monitor, after };
}
