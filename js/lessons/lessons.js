// SPDX-License-Identifier: Apache-2.0
//
// The lessons (design/v0.0.4.md; docs/ui-design.md, U13), as data: six short ones, each ending
// with one of our programs to play. For each step: what to type ("Type it": keys for the typist,
// or text with Chinese, typed through 区位), what to look at ("Show me": a view, or an
// instrument beside the lesson), a program to open, and a check on the machine that ticks the
// step done. Their words are messages (js/l10n/lessons.en.js, `lesson.<lesson>.<step>.*`); a
// listing is the machine's own text, and stays here. No DOM: tests/lessons.test.js runs every
// lesson on a headless machine, doing the visitor's part (`act`) where a step needs one.

import { quwei } from "../sim/chinese.js";
import { LOGO_START_S } from "../sim/samples.js";
import { findOnScreen, glyphOf, glyphPlace } from "../sim/glyphs.js";
import { textRowBase } from "../sim/video.js";

/** @typedef {import("../sim/system.js").System} System */
/**
 * @typedef {object} Show what "Show me" points at
 * @property {"3d" | "2d"} [mode]
 * @property {"front" | "screen" | "keyboard" | "angle" | "back" | "inside" | "apart"} [view] a 3D view
 * @property {"cpu" | "screen" | "hanzi" | "keyboard"} [tool] an instrument, beside the lesson
 */
/**
 * @typedef {object} Step
 * @property {string} id
 * @property {string} [type] keys for "Type it", as the typist takes them ({name} a key)
 * @property {string} [text] or text with Chinese, typed as Type in does (中文 first if needed)
 * @property {boolean} [fresh] Ctrl-Reset first, so that whatever runs stops (BASIC afresh from LOGO)
 * @property {string} [listing] a program, shown as the machine's text
 * @property {string} [program] one of our programs (js/sim/samples.js), to open from the step
 * @property {string} [photo] a photograph in images/photos/
 * @property {Show} [show]
 * @property {boolean} [more] it has a "Going further" aside
 * @property {(s: System) => boolean} [done] the machine shows the step done (a step with a program: once it is typed in and started; one with Show me alone: once it is shown)
 * @property {(s: System) => void} [act] the visitor's own part, for the end-to-end test
 */
/** @typedef {{ id: string, steps: Step[] }} Lesson */

/** The text screen's lines. @param {System} s */
const screen = (s) => s.machine.screenText();
/** Whether a line of the text screen matches. @param {System} s @param {RegExp} re */
const shows = (s, re) => screen(s).some((l) => re.test(l));
/** A lo-res block's colour. @param {System} s @param {number} x @param {number} y */
const block = (s, x, y) => (s.machine.ram[0x400 + textRowBase(y >> 1) + x] >> ((y & 1) * 4)) & 15;

/** A Chinese character's 32 bytes, as the font holds them. @param {System} s @param {string} ch */
function glyph(s, ch) {
  const q = /** @type {number} */ (quwei(ch));
  const p = glyphPlace(glyphOf(Math.floor(q / 100), q % 100));
  const at = p.bank * 0x4000 + p.window - 0x4000;
  return [...s.machine.font.subarray(at, at + 32)];
}
/** Whether a Chinese character is on the Chinese system's screen. @param {System} s @param {string} ch */
const onChineseScreen = (s, ch) => s.chineseOn && findOnScreen(s.machine.ram, 2, glyph(s, ch)) !== null;

/**
 * A BASIC string variable's length, from its descriptor (its name's second letter has bit 7 set).
 * @param {System} s @param {string} name one letter
 * @returns {number | null}
 */
function stringLength(s, name) {
  const r = s.machine.ram;
  for (let a = r[0x69] | (r[0x6a] << 8), end = r[0x6b] | (r[0x6c] << 8); a < end; a += 7) if (r[a] === name.charCodeAt(0) && r[a + 1] === 0x80) return r[a + 2];
  return null;
}

/** A step with one of our programs is done once the program is typed in and started. @param {string} id */
const ran = (id) => (/** @type {System} */ s) => s.programsRun.has(id);

const FIRST = ['10 PRINT "HELLO, CEC-I"', '20 PRINT "2+2 = ";2+2'].join("\n");
const TABLE = ["10 FOR I=1 TO 9", '20 PRINT I;" X 7 = ";I*7', "30 NEXT I"].join("\n");
const ASK = ['10 INPUT "HOW MANY LEGS DOES A SPIDER HAVE? ";A', '20 IF A=8 THEN PRINT "RIGHT!":END', '30 PRINT "NO, TRY AGAIN.":GOTO 10'].join("\n");
const LORES = "GR:COLOR=13:FOR Y=10 TO 29:HLIN 10,29 AT Y:NEXT";
const HIRES = "HGR:HCOLOR=5:HPLOT 0,0 TO 279,159:HCOLOR=6:HPLOT 0,159 TO 279,0";
const TURTLE = "FD 50\nRT 90\nFD 50\nLT 45\nFD 30";
const SCALE = "FOR P=161 TO 81 STEP -10:MUSIC P,30:NEXT";

/** @type {Lesson[]} */
export const LESSONS = [
  {
    id: "meet",
    steps: [
      { id: "machine", photo: "cec-i-front-right.jpg", show: { mode: "3d", view: "angle" }, more: true },
      { id: "on", type: "{reset}", done: (s) => shows(s, /^\]/), more: true },
      { id: "tv", show: { mode: "3d", view: "screen" } },
      { id: "inside", photo: "mainboard-top.jpg", show: { mode: "3d", view: "inside" }, more: true },
      { id: "play", program: "snake", done: ran("snake") },
    ],
  },
  {
    id: "basic",
    steps: [
      { id: "first", type: `NEW\n${FIRST}\nRUN\n`, fresh: true, listing: FIRST, done: (s) => shows(s, /^HELLO, CEC-I$/) && shows(s, /^2\+2 = 4$/), more: true },
      { id: "loop", type: `NEW\n${TABLE}\nRUN\n`, listing: TABLE, done: (s) => shows(s, /^9 X 7 = 63$/) },
      { id: "ask", type: `NEW\n${ASK}\nRUN\n`, listing: ASK, done: (s) => shows(s, /^RIGHT!$/), act: (s) => void s.type("8\n"), more: true },
      { id: "guess", program: "guess", done: ran("guess") },
    ],
  },
  {
    id: "chinese",
    steps: [
      { id: "key", type: "{zhongwen}", fresh: true, done: (s) => s.chineseOn, more: true },
      { id: "hello", text: 'PRINT "你好，中华学习机"\n', done: (s) => onChineseScreen(s, "你") && onChineseScreen(s, "机") },
      { id: "bytes", text: 'A$="中华学习机":PRINT LEN(A$)\n', show: { tool: "hanzi" }, done: (s) => stringLength(s, "A") === 15, more: true },
      { id: "font", program: "bigchar", show: { tool: "hanzi" }, done: ran("bigchar"), more: true },
      { id: "numbers", program: "numread", done: ran("numread") },
    ],
  },
  {
    id: "screen",
    steps: [
      { id: "poke", type: "HOME:POKE 1029,193\n", fresh: true, show: { tool: "screen" }, done: (s) => s.machine.peek(0x405) === 0xc1, more: true },
      { id: "lores", type: `${LORES}\n`, listing: LORES, show: { tool: "screen" }, done: (s) => !s.machine.text && !s.machine.hires && block(s, 20, 20) === 13 },
      { id: "hires", type: `${HIRES}\n`, listing: HIRES, done: (s) => s.machine.hires && s.machine.ram.subarray(0x2000, 0x4000).some((b) => b !== 0), more: true },
      { id: "chart", program: "barchart", done: ran("barchart") },
      { id: "turtle", type: `LG\n{wait:${LOGO_START_S}}${TURTLE}\n`, fresh: true, listing: TURTLE, done: (s) => s.machine.hires && !s.machine.text && s.machine.ram.subarray(0x2000, 0x4000).some((b) => b !== 0), more: true },
      { id: "logo", program: "kaleidoscope", done: ran("kaleidoscope"), more: true },
    ],
  },
  {
    id: "sound",
    steps: [
      { id: "matrix", show: { tool: "keyboard" }, done: (s) => s.keyboard.last !== null, act: (s) => void s.type("G"), more: true },
      { id: "music", type: "MUSIC 128,110\n", fresh: true, done: (s) => shows(s, /^\]MUSIC 128,110$/) },
      { id: "scale", type: `${SCALE}\n`, listing: SCALE, done: (s) => shows(s, /^\]FOR P=161 TO 81/), more: true },
      { id: "organ", program: "organ", done: ran("organ") },
      { id: "box", program: "musicbox", done: ran("musicbox") },
    ],
  },
  {
    id: "cpu",
    steps: [
      { id: "pause", show: { tool: "cpu" }, done: (s) => s.paused, act: (s) => s.pause(), more: true },
      { id: "slow", show: { tool: "cpu" }, done: (s) => !s.paused && s.speedSet < 1, act: (s) => (s.resume(), s.setSpeed(0.01)) },
      { id: "real", show: { tool: "cpu" }, done: (s) => !s.paused && s.speedSet === 1, act: (s) => s.setSpeed(1) },
      { id: "versus", program: "versus", done: ran("versus"), more: true },
      { id: "clock", program: "clock", done: ran("clock") },
    ],
  },
];
