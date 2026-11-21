// SPDX-License-Identifier: Apache-2.0
//
// The picture: what the video circuit makes of memory, field by field, into an RGBA buffer of
// 560 x 192 (each of the 280 dots two pixels wide, so that hi-res's half-dot shift shows). No
// DOM: the page puts the buffer on a canvas, flat or on the 3D tube.
//
// - Text 40 x 24 from the character ROM U13 (its low 1 KB: 128 glyphs, bit 0 the left dot);
//   the primary set (inverse, flashing, normal) or the alternate (inverse and normal, lower
//   case); flashing every 16 fields (20 flashes in 12.8 s, as timed on a real machine).
// - Lo-res 40 x 48, hi-res 280 x 192, mixed (four text rows at the foot), page 1 or 2.
// - The colours on a colour TV (design/decisions.md, D5): in full text mode with $C0B0 bit 4
//   set (colour enabled, as Western BASIC leaves it) the whole picture is a darker green with
//   pale characters, as a real machine shows it on a clean video path; with bit 4 clear
//   (LOGO's text screen, the Chinese system) and in the graphics modes' text rows, white on
//   black. Graphics in the Apple lo-res and hi-res palettes (their order checked on a real
//   machine) while bit 4 lets colour through, and a sharp black-and-white picture while it
//   does not.
// - On a black-and-white TV or a green monitor (D6) there is no colour to decode: the picture
//   is always the sharp black-and-white one, white or green.

export const WIDTH = 560;
export const HEIGHT = 192;

/** @typedef {"colour" | "bw" | "green"} Display the set the computer is plugged into */
/** @typedef {readonly number[]} Rgb */

/** Text mode's field and characters on a colour TV, colour enabled (D5). */
export const TEXT_FIELD = [0x1d, 0x4a, 0x35];
export const TEXT_INK = [0xee, 0xf3, 0xd6];
/** A green monitor's phosphor at full brightness. */
export const GREEN_PHOSPHOR = [0x4a, 0xff, 0x7a];
const BLACK = [0, 0, 0];
const WHITE = [0xff, 0xff, 0xff];

/** The Apple lo-res palette, in its order: black, magenta, dark blue, purple, dark green, ... */
export const LORES = [
  [0x00, 0x00, 0x00], [0xdd, 0x00, 0x33], [0x00, 0x00, 0x99], [0xdd, 0x22, 0xdd],
  [0x00, 0x77, 0x22], [0x55, 0x55, 0x55], [0x22, 0x22, 0xff], [0x66, 0xaa, 0xff],
  [0x88, 0x55, 0x00], [0xff, 0x66, 0x00], [0xaa, 0xaa, 0xaa], [0xff, 0x99, 0x88],
  [0x11, 0xdd, 0x00], [0xff, 0xff, 0x00], [0x44, 0xff, 0x99], [0xff, 0xff, 0xff],
];
/** Hi-res's four colours: HCOLOR 1 green, 2 violet, 5 orange, 6 blue. */
const HGREEN = LORES[12];
const HVIOLET = LORES[3];
const HORANGE = LORES[9];
const HBLUE = LORES[6];

/** A text row's (or a lo-res pair's) start in its page: the IIe's interleave. @param {number} row */
export const textRowBase = (row) => (row & 7) * 128 + (row >> 3) * 40;
/** A hi-res line's start in its page. @param {number} y */
export const hiresLineBase = (y) => (y & 7) * 1024 + ((y >> 3) & 7) * 128 + (y >> 6) * 40;

/** A colour's brightness, 0..255 (the luma a black-and-white set shows). @param {Rgb} c */
export const luma = (c) => Math.round(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);

export class Video {
  /** @param {Uint8Array} u13 the character ROM */
  constructor(u13) {
    this.u13 = u13;
    this.pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    /** The set the computer is plugged into. @type {Display} */
    this.display = "colour";
    /** The colour round the picture (the field in green text mode, black otherwise). @type {Rgb} */
    this.border = BLACK;
    /** Whether the last field drawn was the green text picture (a colour TV, D5). */
    this.greenText = false;
    /** @private the green monitor's phosphor, or null for white */
    this.phosphor = /** @type {Rgb | null} */ (null);
  }

  /** Draw the field the machine is in. @param {import("./machine.js").Machine} m */
  draw(m) {
    const px = this.pixels;
    this.phosphor = this.display === "green" ? GREEN_PHOSPHOR : null;
    if (!m.powered) {
      px.fill(0);
      for (let i = 3; i < px.length; i += 4) px[i] = 255;
      this.border = BLACK;
      this.greenText = false;
      return;
    }
    const page2 = m.shownPage2;
    // colour is decoded only by a colour TV, and only while $C0B0 bit 4 lets it through
    const colour = this.display === "colour" && !!(m.c0b0 & 0x10);
    const flashOn = Math.floor(m.field / 16) % 2 === 1;
    const green = m.text && colour;
    this.greenText = green;
    this.border = green ? TEXT_FIELD : BLACK;
    const [ink, field] = green ? [TEXT_INK, TEXT_FIELD] : [this.mono(WHITE), BLACK];
    const textBase = page2 ? 0x800 : 0x400;
    for (let row = 0; row < 24; row++) {
      const y0 = row * 8;
      if (m.text || (m.mixed && row >= 20)) {
        this.textRow(m.ram, textBase + textRowBase(row), y0, ink, field, m.altchar, flashOn);
      } else if (m.hires) {
        const hb = page2 ? 0x4000 : 0x2000;
        for (let y = y0; y < y0 + 8; y++) this.hiresLine(m.ram, hb + hiresLineBase(y), y, colour);
      } else {
        this.loresRow(m.ram, textBase + textRowBase(row), y0, colour);
      }
    }
  }

  /** @private A grey (or white) as the set shows it: itself, or the green phosphor's. @param {Rgb} c */
  mono(c) {
    const p = this.phosphor;
    if (!p) return c;
    const l = c[0] / 255;
    return [Math.round(p[0] * l), Math.round(p[1] * l), Math.round(p[2] * l)];
  }

  /** @private @param {number} x @param {number} y @param {Rgb} c */
  put(x, y, c) {
    const i = (y * WIDTH + x) * 4;
    const px = this.pixels;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  }

  /**
   * @private
   * @param {Uint8Array} ram @param {number} base @param {number} y0
   * @param {Rgb} ink @param {Rgb} field @param {boolean} alt @param {boolean} flashOn
   */
  textRow(ram, base, y0, ink, field, alt, flashOn) {
    const rom = this.u13;
    for (let col = 0; col < 40; col++) {
      const b = ram[base + col];
      let glyph;
      let inverse;
      if (b >= 0x80) {
        glyph = b & 0x7f;
        inverse = false;
      } else if (b < 0x40) {
        glyph = b;
        inverse = true;
      } else if (alt) {
        glyph = b & 0x7f;
        inverse = true;
      } else {
        glyph = b & 0x3f;
        inverse = flashOn;
      }
      for (let r = 0; r < 8; r++) {
        const bits = rom[glyph * 8 + r];
        for (let d = 0; d < 7; d++) {
          const c = !!(bits & (1 << d)) !== inverse ? ink : field;
          const x = (col * 7 + d) * 2;
          this.put(x, y0 + r, c);
          this.put(x + 1, y0 + r, c);
        }
      }
    }
  }

  /** @private @param {Uint8Array} ram @param {number} base @param {number} y0 @param {boolean} colour */
  loresRow(ram, base, y0, colour) {
    for (let col = 0; col < 40; col++) {
      const b = ram[base + col];
      for (let half = 0; half < 2; half++) {
        const n = half ? b >> 4 : b & 0x0f;
        // without colour: the colour's brightness (its pattern seen without colour)
        const l = luma(LORES[n]);
        const c = colour ? LORES[n] : this.mono([l, l, l]);
        for (let y = y0 + half * 4; y < y0 + half * 4 + 4; y++) for (let x = col * 14; x < col * 14 + 14; x++) this.put(x, y, c);
      }
    }
  }

  /** @private @param {Uint8Array} ram @param {number} base @param {number} y @param {boolean} colour */
  hiresLine(ram, base, y, colour) {
    const row = this.pixels.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4);
    for (let i = 0; i < row.length; i += 4) {
      row[i] = row[i + 1] = row[i + 2] = 0;
      row[i + 3] = 255;
    }
    const white = this.mono(WHITE);
    // the 280 dots and each one's byte's bit 7 (the half-dot delay), with a blank at each end
    const dots = new Uint8Array(282);
    const high = new Uint8Array(282);
    for (let col = 0; col < 40; col++) {
      const b = ram[base + col];
      for (let d = 0; d < 7; d++) {
        dots[col * 7 + d + 1] = (b >> d) & 1;
        high[col * 7 + d + 1] = b >> 7;
      }
    }
    for (let i = 1; i <= 280; i++) {
      const x = (i - 1) * 2 + high[i];
      let c = /** @type {Rgb} */ (BLACK);
      if (dots[i]) {
        if (!colour || dots[i - 1] || dots[i + 1]) c = white;
        else if (high[i]) c = (i - 1) & 1 ? HORANGE : HBLUE;
        else c = (i - 1) & 1 ? HGREEN : HVIOLET;
      } else if (colour && dots[i - 1] && dots[i + 1] && high[i - 1] === high[i + 1]) {
        // a single gap between two dots of one colour keeps the colour (the Apple's fill)
        const k = i - 1;
        c = high[k] ? ((k - 1) & 1 ? HORANGE : HBLUE) : (k - 1) & 1 ? HGREEN : HVIOLET;
      }
      this.put(Math.min(x, WIDTH - 2), y, c);
      this.put(Math.min(x + 1, WIDTH - 1), y, c);
    }
  }
}
