// SPDX-License-Identifier: Apache-2.0
//
// The disk drive and its controller in slot 6 (design/v0.0.5.md, P1): the CEC-I's own floppy
// interface on its board (U39-U44), compatible with Apple's Disk II, and one 5.25-inch drive.
// The 6502 works it through sixteen soft switches, $C0E0-$C0EF:
//
// - $C0E0-$C0E7: the stepper's four phases, each off or on; the head follows the one on
//   beside it, half a track a step (the head is kept on quarter tracks, as WOZ maps them);
// - $C0E8, $C0E9: the motor off (after about a second, as the drive's own timer) and on;
// - $C0EA, $C0EB: drive 1, drive 2 (the CEC-I has one drive: 2 is empty);
// - $C0EC-$C0EF: Q6 and Q7. Reading (Q7 off), the bits under the head, one each 4 cycles,
//   shift into the data latch, which shows a whole disk byte (its top bit set) for two bit
//   times; with Q6 on, a read senses write protect. Writing (Q7 on), a byte loaded with Q6 on
//   is shifted out to the disk a bit each 4 cycles, as DOS writes it, 32 cycles a byte (40 for
//   a self-sync byte, its two zeros the shifted-out latch).
//
// The disk turns while the motor runs; its bits are counted from the 6502's cycles when the
// controller is touched, never in between. RESET clears the controller's latch U41: the
// phases, the motor, Q6 and Q7 off.

/** @typedef {import("./disk-image.js").Disk} Disk */

/** Cycles a bit: 4 µs at 1.02 MHz. */
const BIT_CYCLES = 4;
/** The motor's run-on after it is switched off, cycles (about a second). */
const MOTOR_RUN_ON = 1_000_000;
/** The highest quarter track the head reaches. */
const LAST_QUARTER = 159;

export class DiskDrive {
  constructor() {
    /** The disk in the drive, or null. @type {Disk | null} */
    this.disk = null;
    /** The head, in quarter tracks. */
    this.quarter = 0;
    /** The last phase that pulled the head. */
    this.phase = 0;
    this.phases = 0;
    this.motor = false;
    /** The cycle the motor stops at, after it is switched off (or Infinity while on). */
    this.stopAt = -1;
    this.drive2 = false;
    this.q6 = false;
    this.q7 = false;
    /** Where the head is along its track, in bits. */
    this.pos = 0;
    /** The cycle the disk's turning was last counted to. */
    this.last = 0;
    /** The shift register: the disk byte being read. */
    this.sr = 0;
    /** The last whole byte, and the bit times it is still shown for. */
    this.whole = 0;
    this.hold = 0;
    /** The byte being written. */
    this.out = 0;
    /** Called when the motor starts or stops (the drive's lamp). @type {(on: boolean) => void} */
    this.onMotor = () => {};
  }

  /** Whether the motor turns now. @param {number} cycles */
  spinning(cycles) {
    return this.motor || cycles < this.stopAt;
  }

  /** RESET: the controller's latch cleared. @param {number} cycles */
  reset(cycles) {
    this.turn(cycles);
    this.phases = 0;
    const was = this.spinning(cycles);
    this.motor = false;
    this.stopAt = -1;
    this.drive2 = false;
    this.q6 = this.q7 = false;
    if (was) this.onMotor(false);
  }

  /** A disk in, or out (null). @param {Disk | null} disk @param {number} cycles */
  insert(disk, cycles) {
    this.turn(cycles);
    this.disk = disk;
    this.pos = 0;
    this.sr = 0;
    this.hold = 0;
  }

  /** The track under the head, or null (no disk, drive 2, or no track there). */
  track() {
    if (!this.disk || this.drive2) return null;
    const t = this.disk.tmap[this.quarter];
    return t === 255 ? null : (this.disk.tracks[t] ?? null);
  }

  /** @private The disk turned to `cycles`: its bits read into the latch, or written. @param {number} cycles */
  turn(cycles) {
    // the clock started again (switched on): the disk's count starts with it
    if (cycles < this.last) {
      this.last = cycles;
      return;
    }
    if (!this.spinning(this.last)) {
      this.last = cycles;
      return;
    }
    const until = Math.min(cycles, this.motor ? cycles : this.stopAt);
    let n = Math.floor((until - this.last) / BIT_CYCLES);
    this.last += n * BIT_CYCLES;
    if (until < cycles) this.last = cycles;
    const track = this.track();
    if (!track || !track.length) {
      if (n > 0) this.hold = 0;
      return;
    }
    const len = track.length;
    if (this.q7) {
      // writing: the latch's top bit to the disk, each bit time
      const writable = !this.disk?.writeProtected;
      for (; n > 0; n--) {
        if (writable) track[this.pos] = (this.out >> 7) & 1;
        this.out = (this.out << 1) & 0xff;
        this.pos = (this.pos + 1) % len;
      }
      if (writable && this.disk) this.disk.changed = true;
      return;
    }
    // a long time unwatched: only the last bits matter to the latch
    if (n > 64) {
      this.pos = (this.pos + n - 64) % len;
      n = 64;
      this.hold = 0;
    }
    for (; n > 0; n--) {
      const bit = track[this.pos];
      this.pos = this.pos + 1 === len ? 0 : this.pos + 1;
      if (this.hold > 0) this.hold--;
      if (this.sr === 0 && bit === 0) continue;
      this.sr = (this.sr << 1) | bit;
      if (this.sr & 0x80) {
        this.whole = this.sr;
        this.hold = 2;
        this.sr = 0;
      }
    }
  }

  /** @private A phase on or off: the head pulled half a track toward the phase beside it. @param {number} p @param {boolean} on */
  setPhase(p, on) {
    if (on) this.phases |= 1 << p;
    else this.phases &= ~(1 << p);
    if (!on) return;
    const d = (p - this.phase + 4) % 4;
    if (d === 1 || d === 3) {
      this.quarter = Math.max(0, Math.min(LAST_QUARTER, this.quarter + (d === 1 ? 2 : -2)));
      this.phase = p;
    } else if (d === 0) this.phase = p;
  }

  /**
   * The 6502 at $C0E0-$C0EF.
   * @param {number} k the address's low four bits
   * @param {boolean} write
   * @param {number} v the byte written
   * @param {number} cycles now
   * @returns {number} the byte read
   */
  access(k, write, v, cycles) {
    this.turn(cycles);
    if (k < 8) this.setPhase(k >> 1, !!(k & 1));
    else if (k === 8) {
      if (this.motor) {
        this.motor = false;
        this.stopAt = cycles + MOTOR_RUN_ON;
      }
    } else if (k === 9) {
      const was = this.spinning(cycles);
      this.motor = true;
      if (!was) {
        this.last = cycles;
        this.onMotor(true);
      }
    } else if (k === 10) this.drive2 = false;
    else if (k === 11) this.drive2 = true;
    else if (k === 12) this.q6 = false;
    else if (k === 13) this.q6 = true;
    else if (k === 14) this.q7 = false;
    else this.q7 = true;
    if (write && this.q7 && this.q6) this.out = v;
    if (k & 1) return 0;
    if (this.q7) return this.out;
    if (this.q6) return this.disk?.writeProtected && !this.drive2 ? 0x80 : 0;
    return this.hold > 0 ? this.whole : this.sr;
  }

  /** The motor stopped by its run-on running out (called with the time, so the lamp goes off). @param {number} cycles */
  tick(cycles) {
    if (!this.motor && this.stopAt >= 0 && cycles >= this.stopAt) {
      this.turn(cycles);
      this.stopAt = -1;
      this.onMotor(false);
    }
  }
}
