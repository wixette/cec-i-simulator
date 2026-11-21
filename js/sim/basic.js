// SPDX-License-Identifier: Apache-2.0
//
// The BASIC program in memory as text (Save the program): CEC-BASIC keeps a program as
// Applesoft does, a chain of lines from TXTTAB ($67-$68): each line a link to the next (two
// bytes, 0 at the end), its number (two bytes), its bytes, and a 0. A byte of $80 or more is a
// keyword, numbered from $80 in the ROM's own table of names (U7 $C300, Applesoft's 107 and
// CEC-BASIC's four: MUSIC, PLAY, LG, GAME). Chinese in strings, REM and DATA is in the
// internal code (js/sim/chinese.js), and comes out as Chinese.
//
// The text is much as LIST shows it, a keyword with a space either side (none before a
// bracket), so that typing it in again (Type in) gives the same program. Pure logic, no DOM: tests/basic.test.js.

import { decodeBytes } from "./chinese.js";

/** Where the keyword names are in U7 (the CPU sees them at $C300), and how many there are. */
export const TOKEN_TABLE = 0x4300;
export const TOKEN_COUNT = 111;

/**
 * The keyword names, from $80 on, read from U7: each name's last letter has bit 7 set.
 * @param {Uint8Array} u7
 * @returns {string[]}
 */
export function tokenNames(u7) {
  /** @type {string[]} */
  const names = [];
  let name = "";
  for (let i = TOKEN_TABLE; names.length < TOKEN_COUNT && i < u7.length; i++) {
    name += String.fromCharCode(u7[i] & 0x7f);
    if (u7[i] & 0x80) {
      names.push(name);
      name = "";
    }
  }
  return names;
}

/**
 * One line's bytes (after its number, before its 0) as text.
 * @param {ArrayLike<number>} bytes
 * @param {readonly string[]} names tokenNames()
 */
export function lineText(bytes, names) {
  let out = "";
  /** @type {number[]} */
  let run = [];
  const flush = () => {
    out += decodeBytes(run);
    run = [];
  };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      run.push(b);
      continue;
    }
    flush();
    const name = names[b - 0x80] ?? "?";
    if (out && !out.endsWith(" ")) out += " ";
    out += name;
    // a space after it, unless one follows already, or its bracket; after REM and DATA none,
    // since their text is kept as it was typed
    if (name !== "REM" && name !== "DATA" && i + 1 < bytes.length && bytes[i + 1] !== 0x20 && bytes[i + 1] !== 0x28) out += " ";
  }
  flush();
  return out.trimEnd();
}

/**
 * The program in memory as a listing, a line each, or "" for none.
 * @param {{ ram: Uint8Array }} m the machine (BASIC's program is in main RAM)
 * @param {readonly string[]} names tokenNames()
 * @returns {string}
 */
export function listProgram(m, names) {
  const ram = m.ram;
  /** @type {string[]} */
  const lines = [];
  let at = ram[0x67] | (ram[0x68] << 8);
  let last = -1;
  // the chain must run forward through memory, and end: a program cleared or overwritten does not
  while (at > 0 && at < 0xbfff && lines.length < 10000) {
    const next = ram[at] | (ram[at + 1] << 8);
    if (next === 0) break;
    if (next <= at) return "";
    const number = ram[at + 2] | (ram[at + 3] << 8);
    if (number <= last) return "";
    last = number;
    let end = at + 4;
    while (end < next && ram[end] !== 0) end++;
    lines.push(`${number} ${lineText(ram.subarray(at + 4, end), names)}`);
    at = next;
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}
