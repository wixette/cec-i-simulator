// SPDX-License-Identifier: Apache-2.0
//
// Chinese text and the CEC-I (research/README.md, "Chinese on an 8-bit machine"):
//
// - GB2312, the national character set the font ROMs hold: 94 rows of 94 positions. A
//   character's row and position, its 区位码 (quwei code, four digits), is how the Chinese
//   system's 区位 input method takes it.
// - The internal code: in a BASIC string a Chinese character is three bytes, 127 (the
//   marker), then its row and its position, each n + 28, plus 1 for each of 34 ("), 44 (,)
//   and 58 (:) that the sum reaches, so that no code byte can cut a string or a DATA item.
//
// The table of GB2312 is the browser's own (TextDecoder's GB18030, of which GB2312 is a
// part), built once when it is first needed. Pure logic, no DOM: tests/chinese.test.js.

/** The internal code's marker byte. */
export const MARK = 127;

/**
 * The places GB2312 fills, row by row: [row, first, last] (rows 16 to 87 are the 6,763
 * characters, all but the last five places of row 55). GB18030 has characters in some of the
 * other places too; they are not GB2312's, and the font ROMs have nothing there.
 * @type {[number, number, number][]}
 */
const FILLED = [
  [1, 1, 94], [2, 17, 66], [2, 69, 78], [2, 81, 92], [3, 1, 94], [4, 1, 83], [5, 1, 86],
  [6, 1, 24], [6, 33, 56], [7, 1, 33], [7, 49, 81], [8, 1, 26], [8, 37, 73], [9, 4, 79],
];
/** @param {number} row @param {number} pos */
const filled = (row, pos) => (row >= 16 && row <= 87 ? !(row === 55 && pos > 89) : FILLED.some(([r, a, b]) => r === row && pos >= a && pos <= b));

/** @type {{ toUnicode: Map<number, string>, fromUnicode: Map<string, number> } | null} */
let table = null;

/** GB2312 both ways: row * 100 + position to the character, and back. */
function gb2312() {
  if (table) return table;
  const dec = new TextDecoder("gb18030", { fatal: true });
  /** @type {Map<number, string>} */
  const toUnicode = new Map();
  /** @type {Map<string, number>} */
  const fromUnicode = new Map();
  for (let row = 1; row <= 94; row++) {
    for (let pos = 1; pos <= 94; pos++) {
      if (!filled(row, pos)) continue;
      let ch;
      try {
        ch = dec.decode(new Uint8Array([0xa0 + row, 0xa0 + pos]));
      } catch {
        continue; // a place GB2312 leaves empty
      }
      // GB18030 fills some of GB2312's empty places with private-use characters: not GB2312's
      if ([...ch].length !== 1 || /[-]/.test(ch)) continue;
      toUnicode.set(row * 100 + pos, ch);
      if (!fromUnicode.has(ch)) fromUnicode.set(ch, row * 100 + pos);
    }
  }
  table = { toUnicode, fromUnicode };
  return table;
}

/**
 * A character's 区位码, row * 100 + position, or null if GB2312 has no such character.
 * @param {string} ch one character
 * @returns {number | null}
 */
export function quwei(ch) {
  return gb2312().fromUnicode.get(ch) ?? null;
}

/**
 * The character at a 区位码, or null.
 * @param {number} code row * 100 + position
 * @returns {string | null}
 */
export function fromQuwei(code) {
  return gb2312().toUnicode.get(code) ?? null;
}

/** One number, 1 to 94, as its internal code byte. @param {number} n */
export function codeByte(n) {
  let v = n + 28;
  for (const s of [34, 44, 58]) if (v >= s) v++;
  return v;
}

/** An internal code byte back to its number, 1 to 94, or null. @param {number} b */
export function byteNumber(b) {
  for (let n = 1; n <= 94; n++) if (codeByte(n) === b) return n;
  return null;
}

/**
 * A character's three bytes in a BASIC string, or null for a character GB2312 lacks.
 * @param {string} ch
 * @returns {[number, number, number] | null}
 */
export function internalCode(ch) {
  const q = quwei(ch);
  return q === null ? null : [MARK, codeByte(Math.floor(q / 100)), codeByte(q % 100)];
}

/**
 * Bytes as the machine holds them (a string, a program line) to text: 127 and two code
 * bytes to their Chinese character, other bytes as ASCII (their high bit cleared). A 127
 * not followed by two code bytes stays as it is.
 * @param {ArrayLike<number>} bytes
 * @returns {string}
 */
export function decodeBytes(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0x7f;
    if (b === MARK && i + 2 < bytes.length) {
      const row = byteNumber(bytes[i + 1] & 0x7f);
      const pos = byteNumber(bytes[i + 2] & 0x7f);
      const ch = row && pos ? fromQuwei(row * 100 + pos) : null;
      if (ch) {
        out += ch;
        i += 2;
        continue;
      }
    }
    out += String.fromCharCode(b);
  }
  return out;
}

/**
 * @typedef {object} Plan what to type for a text, on the machine's keys
 * @property {string} keys for the typist (js/sim/keyboard.js): Chinese as 区位 codes
 * @property {boolean} chinese whether the text holds Chinese (and so needs the Chinese system)
 * @property {string[]} refused characters neither ASCII nor GB2312, each once, in order
 */

/** Characters typed as they are: the printable ASCII and the newline. */
const PLAIN = /^[\n\x20-\x7e]$/;

/**
 * How to type a text on the CEC-I: ASCII as it is; each run of Chinese characters (anything
 * in GB2312, full-width signs included) as F3 (the 区位 input), four digits a character, then
 * F1 (back to Western letters), so that the machine's own input method takes it. A text with
 * Chinese needs the Chinese system on (the 中文 key), which the caller presses first.
 * @param {string} text
 * @returns {Plan}
 */
export function planTyping(text) {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\t/g, " ");
  let keys = "";
  let inChinese = false;
  let chinese = false;
  /** @type {string[]} */
  const refused = [];
  for (const ch of clean) {
    if (PLAIN.test(ch)) {
      if (inChinese) keys += "{f1}";
      inChinese = false;
      // braces are the typist's own: typed as the key they are
      keys += ch === "{" ? "{lbrace}" : ch;
      continue;
    }
    const q = quwei(ch);
    if (q === null) {
      if (!refused.includes(ch)) refused.push(ch);
      continue;
    }
    if (!inChinese) keys += "{f3}";
    inChinese = true;
    chinese = true;
    keys += String(q).padStart(4, "0");
  }
  if (inChinese) keys += "{f1}";
  return { keys, chinese, refused };
}
