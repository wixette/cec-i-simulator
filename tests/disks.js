// SPDX-License-Identifier: Apache-2.0
//
// Disks of our own for the tests (no Apple software): made here, booted by the machine's own
// ROMs (tests/disk.test.js, tests/browser/disk.mjs).

import { assemble } from "../js/sim/asm6502.js";
import { SECTOR_IMAGE_BYTES } from "../js/sim/disk-image.js";

/** Bytes that look like nothing in particular. @param {number} n @param {number} seed */
export function noise(n, seed) {
  const b = new Uint8Array(n);
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    b[i] = x >>> 24;
  }
  return b;
}

/** Where a DOS-order image keeps each physical sector. */
const DOS = [0x0, 0x7, 0xe, 0x6, 0xd, 0x5, 0xc, 0x4, 0xb, 0x3, 0xa, 0x2, 0x9, 0x1, 0x8, 0xf];

/**
 * A disk of our own: its boot sector (track 0, physical sector 0) says to load three
 * sectors; the code in it prints the text the ROM loaded from physical sectors 1 and 2, as
 * DOS's own boot loads its second stage.
 */
export function bootDisk() {
  const img = noise(SECTOR_IMAGE_BYTES, 7);
  const { bytes } = assemble(
    `
        * = $800
        .byte 3
        LDX #0
one     LDA $900,X
        BEQ two
        JSR $FDED
        INX
        BNE one
two     LDX #0
more    LDA $A00,X
        BEQ done
        JSR $FDED
        INX
        BNE more
done    JMP done`,
    0x800,
  );
  const sector = (/** @type {number} */ p) => img.subarray(DOS[p] * 256, DOS[p] * 256 + 256);
  sector(0).fill(0).set(bytes);
  const text = (/** @type {string} */ s) => [...s].map((c) => c.charCodeAt(0) | 0x80).concat(0);
  sector(1).fill(0).set(text("BOOTED FROM A DISK"));
  sector(2).fill(0).set(text(" OF OUR OWN"));
  return img;
}

