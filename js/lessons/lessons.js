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
 * @property {(s: System) => boolean} [done] the machine shows the step done
 * @property {(s: System) => void} [act] the visitor's own part, for the end-to-end test
 */
/** @typedef {{ id: string, steps: Step[] }} Lesson */

/** The text screen's lines. @param {System} s */
const screen = (s) => s.machine.screenText();
/** Whether a line of the text screen matches. @param {System} s @param {RegExp} re */
const shows = (s, re) => screen(s).some((l) => re.test(l));
/** How many lines match. @param {System} s @param {RegExp} re */
const count = (s, re) => screen(s).filter((l) => re.test(l)).length;
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

const LOOP = ['10 PRINT "HELLO, CEC-I"', "20 GOTO 10"].join("\n");
const SCALE = "FOR P=161 TO 81 STEP -10:MUSIC P,30:NEXT";

/** @type {Lesson[]} */
export const LESSONS = [
  {
    id: "meet",
    steps: [
      { id: "machine", photo: "cec-i-front-right.jpg", show: { mode: "3d", view: "front" }, more: true },
      { id: "on", type: "{reset}", done: (s) => shows(s, /^\]/) },
      { id: "tv", show: { mode: "3d", view: "screen" } },
      { id: "inside", photo: "mainboard-top.jpg", show: { mode: "3d", view: "inside" }, more: true },
      { id: "play", program: "snake" },
    ],
  },
  {
    id: "basic",
    steps: [
      { id: "print", type: "PRINT 2+2\n", fresh: true, done: (s) => shows(s, /^\]PRINT 2\+2/) && shows(s, /^4$/) },
      { id: "words", type: 'PRINT "HELLO, CEC-I"\n', done: (s) => shows(s, /^HELLO, CEC-I$/) },
      { id: "program", type: `NEW\n${LOOP}\nRUN\n`, listing: LOOP, done: (s) => count(s, /^HELLO, CEC-I$/) >= 10, more: true },
      { id: "stop", type: "\x03\nLIST\n", done: (s) => shows(s, /^break in (10|20)/i) && shows(s, /^10 +PRINT "HELLO, CEC-I"/) },
      { id: "guess", program: "guess" },
    ],
  },
  {
    id: "chinese",
    steps: [
      { id: "key", type: "{zhongwen}", fresh: true, done: (s) => s.chineseOn, more: true },
      { id: "hello", text: 'PRINT "你好，中华学习机"\n', done: (s) => onChineseScreen(s, "你") && onChineseScreen(s, "机") },
      { id: "bytes", text: 'A$="中华学习机":PRINT LEN(A$)\n', show: { tool: "hanzi" }, done: (s) => stringLength(s, "A") === 15, more: true },
      { id: "font", program: "bigchar", show: { tool: "hanzi" }, more: true },
      { id: "numbers", program: "numread" },
    ],
  },
  {
    id: "screen",
    steps: [
      { id: "poke", type: "HOME:POKE 1029,193\n", fresh: true, show: { tool: "screen" }, done: (s) => s.machine.peek(0x405) === 0xc1, more: true },
      { id: "lores", type: "GR:COLOR=13:PLOT 20,20\n", show: { tool: "screen" }, done: (s) => !s.machine.text && !s.machine.hires && block(s, 20, 20) === 13 },
      { id: "hires", type: "HGR:HCOLOR=3:HPLOT 0,0 TO 279,159\n", done: (s) => s.machine.hires && s.machine.ram[0x2000] !== 0, more: true },
      { id: "chart", program: "barchart" },
      { id: "logo", program: "kaleidoscope", more: true },
    ],
  },
  {
    id: "sound",
    steps: [
      { id: "matrix", show: { tool: "keyboard" }, done: (s) => s.keyboard.last !== null, act: (s) => void s.type("G"), more: true },
      { id: "music", type: "MUSIC 128,110\n", fresh: true, done: (s) => shows(s, /^\]MUSIC 128,110$/) },
      { id: "scale", type: `${SCALE}\n`, listing: SCALE, done: (s) => shows(s, /^\]FOR P=161 TO 81/), more: true },
      { id: "organ", program: "organ" },
      { id: "box", program: "musicbox" },
    ],
  },
  {
    id: "cpu",
    steps: [
      { id: "pause", show: { tool: "cpu" }, done: (s) => s.paused, act: (s) => s.pause(), more: true },
      { id: "slow", show: { tool: "cpu" }, done: (s) => !s.paused && s.speedSet < 1, act: (s) => (s.resume(), s.setSpeed(0.01)) },
      { id: "real", show: { tool: "cpu" }, done: (s) => !s.paused && s.speedSet === 1, act: (s) => s.setSpeed(1) },
      { id: "versus", program: "versus", more: true },
      { id: "clock", program: "clock" },
    ],
  },
];
