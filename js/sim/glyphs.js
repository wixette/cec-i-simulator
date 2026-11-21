// SPDX-License-Identifier: Apache-2.0
//
// How a Chinese character reaches the screen, read off the running machine for the Chinese
// tool (docs/ui-design.md, U12; research/README.md, "How a Chinese character reaches the
// screen"). Views the real CEC-I never had:
//
//   the string's bytes   a BASIC string variable, its bytes, each 127 x y read as a character
//   the latch            $C0B0 as last written: the font bank (bits 0-3), colour (bit 4), the
//                        table bank (bit 5), and which 16 KB of the 256 KB font is in the window
//   the 32 bytes         the glyph the Chinese system last read through the window (aux $4000-$7FFF)
//   the dots             where those dots are on the hi-res page, and so on the screen
//
// The font holds 32 bytes a glyph, two a line, the left half first, bit 0 the leftmost dot (as
// the CPU reads it: js/sim/machine.js, interleaveFont). Its glyphs are numbered from 0; the
// Chinese characters from 1102 on, row by row of GB 2312 from row 16. Pure logic, no DOM.

import { byteNumber, fromQuwei } from "./chinese.js";

/** The first Chinese character's glyph number in the font (GB 2312 row 16, place 1: 啊). */
export const FIRST_HANZI = 1102;
/** Glyphs a 16 KB bank of the font holds. */
export const BANK_GLYPHS = 512;

/** A character's glyph number, from its GB 2312 row (16 on) and place. @param {number} row @param {number} pos */
export const glyphOf = (row, pos) => (row - 16) * 94 + (pos - 1) + FIRST_HANZI;

/** A glyph number back to its row and place, or null below the Chinese characters. @param {number} d */
export function rowPos(d) {
  if (d < FIRST_HANZI) return null;
  return { row: 16 + Math.floor((d - FIRST_HANZI) / 94), pos: ((d - FIRST_HANZI) % 94) + 1 };
}

/** Where a glyph is: its bank (what $C0B0's low bits select) and its address in the window. @param {number} d */
export const glyphPlace = (d) => ({ bank: Math.floor(d / BANK_GLYPHS), window: 0x4000 + (d % BANK_GLYPHS) * 32, font: d * 32 });

/**
 * A string's bytes split as the Chinese system reads them: 127 and the two bytes after it a
 * character (its row and place), anything else a byte of its own.
 * @param {number[]} bytes
 * @returns {{ bytes: number[], ch: string, row?: number, pos?: number }[]}
 */
export function splitCode(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 127 && i + 2 < bytes.length) {
      const row = byteNumber(bytes[i + 1]) ?? 0;
      const pos = byteNumber(bytes[i + 2]) ?? 0;
      out.push({ bytes: bytes.slice(i, i + 3), ch: (row && pos && fromQuwei(row * 100 + pos)) || "?", row, pos });
      i += 2;
    } else {
      const b = bytes[i];
      out.push({ bytes: [b], ch: b >= 32 && b < 127 ? String.fromCharCode(b) : "·" });
    }
  }
  return out;
}

/**
 * The BASIC program's simple string variables, from Applesoft's table of variables ($69
 * VARTAB to $6B ARYTAB, 7 bytes each: the name's two bytes, then the length and the address).
 * @param {Uint8Array} ram
 * @returns {{ name: string, bytes: number[] }[]}
 */
export function stringVars(ram) {
  const start = ram[0x69] | (ram[0x6a] << 8);
  const end = ram[0x6b] | (ram[0x6c] << 8);
  const out = [];
  for (let a = start; a + 7 <= end && a < 0xc000 && out.length < 16; a += 7) {
    const n1 = ram[a];
    const n2 = ram[a + 1];
    if (n1 & 0x80 || !(n2 & 0x80)) continue; // a string: the first name byte plain, the second's bit 7 set
    const name = String.fromCharCode(n1) + (n2 & 0x7f ? String.fromCharCode(n2 & 0x7f) : "") + "$";
    const len = ram[a + 2];
    const p = ram[a + 3] | (ram[a + 4] << 8);
    out.push({ name, bytes: [...ram.subarray(p, p + len)] });
  }
  return out;
}

/** A hi-res line's start in its page (the IIe's interleave). @param {number} y */
const lineBase = (y) => (y & 7) * 1024 + ((y >> 3) & 7) * 128 + (y >> 6) * 40;

/**
 * Where a glyph's 16 x 16 dots are on a hi-res page: looked for in the picture itself (the
 * system copies the glyph from a buffer later, with other reads between, so its writes cannot
 * be told by time). Characters stand at 16-dot columns; the last match in reading order (the
 * newest, as text runs down the screen), or null.
 * @param {Uint8Array} ram @param {number} page 1 or 2 @param {number[]} bytes the glyph's 32
 * @returns {{ x: number, y: number, addrs: number[] } | null}
 */
export function findOnScreen(ram, page, bytes) {
  const base = page === 2 ? 0x4000 : 0x2000;
  const dot = (/** @type {number} */ x, /** @type {number} */ y) => (ram[base + lineBase(y) + Math.floor(x / 7)] >> (x % 7)) & 1;
  if (bytes.every((b) => b === 0)) return null;
  let found = null;
  for (let y = 0; y <= 192 - 16; y++) {
    for (let x = 0; x <= 280 - 16; x += 16) {
      let ok = true;
      for (let yy = 0; yy < 16 && ok; yy++) {
        for (let xx = 0; xx < 16; xx++) {
          if (dot(x + xx, y + yy) !== ((bytes[2 * yy + (xx >> 3)] >> (xx & 7)) & 1)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) found = { x, y };
    }
  }
  if (!found) return null;
  const addrs = [];
  for (let y = found.y; y < found.y + 16; y++) for (let c = Math.floor(found.x / 7); c <= Math.floor((found.x + 15) / 7); c++) addrs.push(base + lineBase(y) + c);
  return { ...found, addrs };
}

/** @typedef {{ d: number, bytes: number[], bank: number }} Glyph a glyph read whole through the window */

/** Watches a machine for the Chinese tool: attach() makes it the machine's watch, detach() lets go. */
export class GlyphWatch {
  constructor() {
    /** $C0B0 as last written, and the writes seen since attached. */
    this.latch = 0;
    this.latchWrites = 0;
    /** The banks written to the latch lately, newest last. @type {number[]} */
    this.banks = [];
    /** The last whole glyph read through the window. @type {Glyph | null} */
    this.glyph = null;
    /** The last Chinese character's glyph (from FIRST_HANZI on). @type {Glyph | null} */
    this.hanzi = null;
    /** Glyphs read since attached. */
    this.glyphs = 0;
    /** @private the glyph being read now */
    this.reading = { d: -1, bytes: /** @type {number[]} */ ([]), seen: 0 };
    /** @type {import("./machine.js").Machine | null} */
    this.m = null;
  }

  /** @param {import("./machine.js").Machine} m */
  attach(m) {
    this.m = m;
    this.latch = m.c0b0;
    m.watch = {
      latch: (v) => {
        this.latch = v;
        this.latchWrites++;
        if (this.banks.at(-1) !== (v & 15)) this.banks.push(v & 15);
        if (this.banks.length > 8) this.banks.shift();
      },
      font: (addr, value) => this.font(addr, value),
    };
  }

  detach() {
    if (this.m) this.m.watch = null;
    this.m = null;
  }

  /** @private a byte read from the font @param {number} addr (0 to 256 KB) @param {number} value */
  font(addr, value) {
    const d = addr >> 5;
    const r = this.reading;
    if (d !== r.d) {
      r.d = d;
      r.bytes = new Array(32).fill(0);
      r.seen = 0;
    }
    r.bytes[addr & 31] = value;
    r.seen++;
    if (r.seen >= 32) {
      const g = { d, bytes: r.bytes.slice(), bank: Math.floor(d / BANK_GLYPHS) };
      this.glyph = g;
      if (d >= FIRST_HANZI) this.hanzi = g;
      this.glyphs++;
      r.d = -1;
    }
  }
}
