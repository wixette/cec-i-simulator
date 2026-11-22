// SPDX-License-Identifier: Apache-2.0
//
// The CEC-I: the 6502, 48 KB of RAM and the language card's 16 KB, the ROMs, and the I/O as
// the hardware reference describes it (research/README.md, "How it works"). The Apple IIe's
// memory map and soft switches, with the CEC's own:
//
// - no aux RAM: aux $0000-$3FFF is main RAM again; aux $4000-$7FFF is the 16 KB window into
//   the 256 KB font (bank = $C0B0 bits 0-3); aux $8000-$BFFF a table bank ($C0B0 bit 5:
//   0 U35's low half, 1 U7's low half); aux $D000-$FFFF the Chinese system (U35's high
//   12 KB), seen with ALTZP and the language card set to read RAM (as measured on a real
//   machine by checksums of every page);
// - $C0B0-$C0BF the latch U32 (74LS174): written only; a read gives the floating bus ($BF,
//   as the real machine reads); cleared by reset (its CLR is on RESET*);
// - $C300 and $C600 from U35; $C100-$CFFF internal from U7's $4100-$4FFF;
// - $C0E0-$C0EF the floppy interface in slot 6 and its one drive (js/sim/disk.js); the
//   system ROM looks for a disk at a cold start (U7 $C800) and boots it at $C600;
// - the frame: 312 lines of 65 cycles at 50 Hz (PAL), so $C019 counts 50 fields a second;
//   192 of the lines carry the picture.
//
// No DOM: the page and the tests drive it alike.

import { Cpu6502 } from "./cpu6502.js";
import { DiskDrive } from "./disk.js";

/** The CPU clock: 14.31818 MHz, 65 cycles in 912 of its ticks (one long cycle a line). */
export const CLOCK_HZ = (14318180 * 65) / 912;
export const LINE_CYCLES = 65;
export const FIELD_LINES = 312;
export const FIELD_CYCLES = LINE_CYCLES * FIELD_LINES;
/** Lines carrying the picture; $C019 bit 7 is 1 while they are drawn. */
export const VISIBLE_LINES = 192;

/** @typedef {{ u7: Uint8Array, u35: Uint8Array, u33: Uint8Array, u34: Uint8Array, u13: Uint8Array, u26: Uint8Array }} Roms */

/**
 * The memory traffic in a stretch of time, as counts of reads and writes: of main RAM by its
 * 256-byte page ($00-$BF), of the language card's RAM, and by chip: U7 the system ROM, U35
 * the Chinese ROM, the font ROMs U33 and U34 (through the window), the latch U32 (written),
 * and the I/O page.
 * @typedef {{ pages: Uint32Array, lc: number, u7: number, u35: number, font: number, latch: number, io: number }} Traffic
 */

/** @returns {Traffic} */
const newTraffic = () => ({ pages: new Uint32Array(0xc0), lc: 0, u7: 0, u35: 0, font: 0, latch: 0, io: 0 });

/** The font ROMs' bytes as the CPU reads them: U33 at even addresses, U34 at odd, each byte's bits reversed (their D7 is wired to MD0). @param {Uint8Array} u33 @param {Uint8Array} u34 */
export function interleaveFont(u33, u34) {
  const rev = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let r = 0;
    for (let b = 0; b < 8; b++) if (i & (1 << b)) r |= 0x80 >> b;
    rev[i] = r;
  }
  const font = new Uint8Array(0x40000);
  for (let i = 0; i < 0x20000; i++) {
    font[2 * i] = rev[u33[i]];
    font[2 * i + 1] = rev[u34[i]];
  }
  return font;
}

export class Machine {
  /** @param {Roms} roms */
  constructor(roms) {
    this.roms = roms;
    this.font = interleaveFont(roms.u33, roms.u34);
    /** The memory traffic since takeTraffic() last took it. */
    this.traffic = newTraffic();
    /**
     * The instruments' hooks, called as the machine works, or null while none watches (the
     * Chinese tool, js/sim/glyphs.js): the latch written, a byte read through the font window.
     * @type {{ latch: (v: number) => void, font: (addr: number, value: number) => void } | null}
     */
    this.watch = null;
    /** The disk drive in slot 6. */
    this.drive = new DiskDrive();
    /** A listener at one address: called with A each time the 6502 is about to run the instruction there (what LOGO prints, read as it prints it). @type {{ pc: number, fn: (a: number) => void } | null} */
    this.tap = null;
    this.ram = new Uint8Array(0x10000);
    /** The language card's RAM: $D000 bank 1, $D000 bank 2, $E000-$FFFF. */
    this.lc = new Uint8Array(0x4000);
    this.cpu = new Cpu6502({ read: (a) => this.read(a), write: (a, v) => this.write(a, v) });
    // the keyboard: the latch, its strobe, and whether a key is held
    this.kbd = 0;
    this.strobe = false;
    /** The RESET line held low (Ctrl and Reset both down). */
    this.resetLow = false;
    this.keyDown = false;
    /** Joystick: four paddles (0-255) and three buttons. A machine with none connected reads 255. */
    this.paddles = [255, 255, 255, 255];
    this.buttons = [false, false, false];
    /** @private cycle the paddle timers were triggered at */
    this.paddleT = -1e9;
    /** The speaker's toggles, as cycle numbers, since the page last took them. @type {number[]} */
    this.speaker = [];
    /** The speaker cone's side (flips at each toggle). */
    this.speakerLevel = 0;
    this.powered = false;
    // the MMU's switches and the latch (resetSwitches sets them as Reset leaves them)
    this.ramrd = false;
    this.ramwrt = false;
    this.altzp = false;
    this.store80 = false;
    this.intcx = false;
    this.slotc3 = false;
    this.intc8 = false;
    this.lcread = false;
    this.lcwrite = true;
    this.lcbank2 = true;
    this.lcprewrite = false;
    this.c0b0 = 0;
    // display switches (the IOU's; not reset by Reset)
    this.text = true;
    this.mixed = false;
    this.page2 = false;
    this.hires = false;
    this.altchar = false;
    this.col80 = false;
  }

  /** The MMU's switches and the latch, as Reset leaves them. */
  resetSwitches() {
    this.ramrd = false;
    this.ramwrt = false;
    this.altzp = false;
    this.store80 = false;
    this.intcx = false;
    this.slotc3 = false;
    this.intc8 = false;
    this.lcread = false;
    this.lcwrite = true;
    this.lcbank2 = true;
    this.lcprewrite = false;
    this.c0b0 = 0;
  }

  /** Switch on: the RAM keeps no contents (here, zeros), no key is waiting, then Reset. */
  powerOn() {
    this.ram.fill(0);
    this.lc.fill(0);
    this.kbd = 0;
    this.strobe = false;
    this.keyDown = false;
    this.speaker.length = 0;
    this.speakerLevel = 0;
    this.cpu.cycles = 0;
    this.cpu.s = 0xfd;
    this.resetLow = false;
    this.text = true;
    this.mixed = this.page2 = this.hires = this.altchar = this.col80 = false;
    this.powered = true;
    this.reset();
  }

  powerOff() {
    this.powered = false;
    this.drive.reset(this.cpu.cycles);
  }

  /**
   * The RESET line held low (Ctrl-Reset while both keys are down): the 6502 stops, and starts
   * its reset sequence only when the line goes high again (as the 6502's RES works). Time
   * goes on meanwhile: the keyboard's repeat still sets the strobe, so TEST held through
   * Ctrl-Reset is waiting in the latch when the reset code reads it at $FF1A (the self-test,
   * as the manuals say). @param {boolean} low
   */
  holdReset(low) {
    if (low) this.resetLow = true;
    else if (this.resetLow) {
      this.resetLow = false;
      this.reset();
    }
  }

  /** The reset sequence now (power-on, or the RESET line let go). The keyboard's latch is not touched, so a key held through it is still waiting. */
  reset() {
    this.resetSwitches();
    this.drive.reset(this.cpu.cycles);
    this.cpu.reset();
  }

  get cycles() {
    return this.cpu.cycles;
  }

  /** Where the video scan is in its field, in cycles. */
  get fieldCycle() {
    return this.cpu.cycles % FIELD_CYCLES;
  }

  /** Fields since power-on (the flash's count). */
  get field() {
    return Math.floor(this.cpu.cycles / FIELD_CYCLES);
  }

  /**
   * Run at least `n` cycles; with stops, until the 6502 is about to run an instruction at one
   * of them (Run to).
   * @param {number} n
   * @param {ReadonlySet<number>} [stops]
   * @param {boolean} [leaving] the 6502 is at a stop now and is to leave it: its instruction runs
   * @returns {number} the cycles run
   */
  run(n, stops, leaving = false) {
    if (!this.powered) return 0;
    const cpu = this.cpu;
    const end = cpu.cycles + n;
    const c0 = cpu.cycles;
    if (this.resetLow) cpu.cycles = end; // held in reset: the clock runs, the 6502 does not
    if (stops?.size) {
      // Run to: before each instruction, whether the 6502 is at a stop (the first one excepted
      // when leaving one)
      let first = leaving;
      while (cpu.cycles < end) {
        if (!first && stops.has(cpu.pc)) break;
        first = false;
        cpu.step();
      }
    } else if (this.tap) {
      const tap = this.tap;
      while (cpu.cycles < end) {
        if (cpu.pc === tap.pc) tap.fn(cpu.a);
        cpu.step();
      }
    } else while (cpu.cycles < end) cpu.step();
    this.drive.tick(cpu.cycles);
    return cpu.cycles - c0;
  }

  /** One instruction (the CPU tool's Step), or none while held in reset. @returns {number} its cycles */
  step() {
    if (!this.powered || this.resetLow) return 0;
    return this.cpu.step();
  }

  // --- the keyboard (the KB3600 and U26) ------------------------------------------------

  /** A key's code into the latch, the strobe up. @param {number} code */
  keyPress(code) {
    this.kbd = code & 0x7f;
    this.strobe = true;
    this.keyDown = true;
  }

  keyUp() {
    this.keyDown = false;
  }

  // --- memory -------------------------------------------------------------------------

  /** @param {number} a */
  read(a) {
    const t = this.traffic;
    if (a < 0x0200) {
      t.pages[a >> 8]++;
      return this.ram[a]; // aux zero page and stack are main's (CEC)
    }
    if (a < 0xc000) {
      if (this.ramrd && a >= 0x4000) {
        if (a < 0x8000) {
          t.font++;
          const addr = ((this.c0b0 & 0x0f) << 14) + a - 0x4000;
          this.watch?.font(addr, this.font[addr]);
          return this.font[addr];
        }
        if (this.c0b0 & 0x20) t.u7++;
        else t.u35++;
        return (this.c0b0 & 0x20 ? this.roms.u7 : this.roms.u35)[a - 0x8000];
      }
      t.pages[a >> 8]++;
      return this.ram[a];
    }
    if (a < 0xc100) {
      t.io++;
      return this.io(a, false, 0);
    }
    if (a < 0xd000) return this.cx(a);
    // the Chinese ROM at aux $D000 needs ALTZP and LC read-RAM (the machine's page sums; U35 $C3AB)
    if (this.lcread && this.altzp) {
      t.u35++;
      return this.roms.u35[0x5000 + a - 0xd000];
    }
    if (this.lcread) {
      t.lc++;
      if (a < 0xe000) return this.lc[(this.lcbank2 ? 0 : 0x1000) + a - 0xd000];
      return this.lc[0x2000 + a - 0xe000];
    }
    t.u7++;
    return this.roms.u7[0x5000 + a - 0xd000];
  }

  /**
   * A byte as the CPU would read it now, without what reading does (the instruments: the
   * disassembler, the memory dump): the soft switches and the keyboard's strobe stay as they
   * are, and the I/O page reads as the keyboard's latch ($C000-$C00F) or 0.
   * @param {number} a
   */
  peek(a) {
    a &= 0xffff;
    if (a < 0xc000) {
      if (a >= 0x4000 && this.ramrd) return a < 0x8000 ? this.font[((this.c0b0 & 0x0f) << 14) + a - 0x4000] : (this.c0b0 & 0x20 ? this.roms.u7 : this.roms.u35)[a - 0x8000];
      return this.ram[a];
    }
    if (a < 0xc010) return this.kbd | (this.strobe ? 0x80 : 0);
    if (a < 0xc100) return 0;
    if (a < 0xd000) {
      const u7 = this.roms.u7;
      if (this.intcx) return u7[0x4000 + a - 0xc000];
      if (a >= 0xc300 && a < 0xc400) return this.slotc3 ? this.roms.u35[0x4000 + a - 0xc000] : u7[0x4000 + a - 0xc000];
      if (a >= 0xc800) return this.intc8 ? u7[0x4000 + a - 0xc000] : 0xff;
      if (a >= 0xc600 && a < 0xc700) return this.roms.u35[0x4000 + a - 0xc000];
      return 0xff;
    }
    if (this.lcread && this.altzp) return this.roms.u35[0x5000 + a - 0xd000];
    if (this.lcread) return a < 0xe000 ? this.lc[(this.lcbank2 ? 0 : 0x1000) + a - 0xd000] : this.lc[0x2000 + a - 0xe000];
    return this.roms.u7[0x5000 + a - 0xd000];
  }

  /**
   * The memory traffic since the last call, by chip and by region, and counted again from 0
   * (the CPU tool's memory map, Inside's lit chips).
   * @returns {Traffic}
   */
  takeTraffic() {
    const t = this.traffic;
    this.traffic = newTraffic();
    return t;
  }

  /** @param {number} a @param {number} v */
  write(a, v) {
    const t = this.traffic;
    if (a < 0x0200) {
      t.pages[a >> 8]++;
      this.ram[a] = v;
      return;
    }
    if (a < 0xc000) {
      // aux writes: $0200-$3FFF is main RAM again; above it, ROM (no write)
      if (this.ramwrt && a >= 0x4000) return;
      t.pages[a >> 8]++;
      this.ram[a] = v;
      return;
    }
    if (a < 0xc100) {
      t.io++;
      if ((a & 0xf0) === 0xb0) t.latch++;
      this.io(a, true, v);
      return;
    }
    if (a < 0xd000) {
      if (a === 0xcfff) this.intc8 = false;
      return;
    }
    if (this.lcwrite && !this.altzp) {
      t.lc++;
      if (a < 0xe000) this.lc[(this.lcbank2 ? 0 : 0x1000) + a - 0xd000] = v;
      else this.lc[0x2000 + a - 0xe000] = v;
    }
  }

  /** @private $C100-$CFFF @param {number} a */
  cx(a) {
    const u7 = this.roms.u7;
    const t = this.traffic;
    if (this.intcx) {
      t.u7++;
      return u7[0x4000 + a - 0xc000];
    }
    if (a >= 0xc300 && a < 0xc400) {
      if (!this.slotc3) {
        this.intc8 = true;
        t.u7++;
        return u7[0x4000 + a - 0xc000];
      }
      t.u35++;
      return this.roms.u35[0x4000 + a - 0xc000];
    }
    if (a >= 0xc800) {
      if (a === 0xcfff) this.intc8 = false;
      if (this.intc8) t.u7++;
      return this.intc8 ? u7[0x4000 + a - 0xc000] : 0xff;
    }
    if (a >= 0xc600 && a < 0xc700) {
      t.u35++;
      return this.roms.u35[0x4000 + a - 0xc000];
    }
    return 0xff;
  }

  /** @private $C000-$C0FF @param {number} a @param {boolean} write @param {number} v */
  io(a, write, v) {
    const lo = a & 0xff;
    const kbd = this.kbd | (this.strobe ? 0x80 : 0);
    if (lo < 0x10) {
      if (!write) return kbd;
      switch (lo) {
        case 0x00: this.store80 = false; break;
        case 0x01: this.store80 = true; break;
        case 0x02: this.ramrd = false; break;
        case 0x03: this.ramrd = true; break;
        case 0x04: this.ramwrt = false; break;
        case 0x05: this.ramwrt = true; break;
        case 0x06: this.intcx = false; break;
        case 0x07: this.intcx = true; break;
        case 0x08: this.altzp = false; break;
        case 0x09: this.altzp = true; break;
        case 0x0a: this.slotc3 = false; break;
        case 0x0b: this.slotc3 = true; break;
        case 0x0c: this.col80 = false; break;
        case 0x0d: this.col80 = true; break;
        case 0x0e: this.altchar = false; break;
        case 0x0f: this.altchar = true; break;
      }
      return 0;
    }
    if (lo === 0x10) {
      this.strobe = false;
      return (this.keyDown ? 0x80 : 0) | this.kbd;
    }
    if (lo < 0x20) {
      if (write) return 0;
      const bit = (/** @type {boolean} */ f) => (f ? 0x80 : 0) | this.kbd;
      switch (lo) {
        case 0x11: return bit(this.lcbank2);
        case 0x12: return bit(this.lcread);
        case 0x13: return bit(this.ramrd);
        case 0x14: return bit(this.ramwrt);
        case 0x15: return bit(this.intcx);
        case 0x16: return bit(this.altzp);
        case 0x17: return bit(this.slotc3);
        case 0x18: return bit(this.store80);
        case 0x19: return bit(this.fieldCycle < VISIBLE_LINES * LINE_CYCLES);
        case 0x1a: return bit(this.text);
        case 0x1b: return bit(this.mixed);
        case 0x1c: return bit(this.page2);
        case 0x1d: return bit(this.hires);
        case 0x1e: return bit(this.altchar);
        default: return bit(this.col80);
      }
    }
    if (lo < 0x30) return 0; // the cassette output: no recorder (design/v0.0.5.md)
    if (lo < 0x40) {
      this.speakerLevel ^= 1;
      this.speaker.push(this.cpu.cycles);
      return 0;
    }
    if (lo >= 0x50 && lo < 0x58) {
      const k = lo - 0x50;
      if (k < 2) this.text = !!k;
      else if (k < 4) this.mixed = !!(k - 2);
      else if (k < 6) this.page2 = !!(k - 4);
      else this.hires = !!(k - 6);
      return 0;
    }
    if (lo < 0x60) return 0; // annunciators: unused on the CEC-I
    if (lo < 0x70) {
      if (write) return 0;
      const k = lo & 7;
      if (k === 0) return 0; // the cassette input: no recorder
      if (k < 4) return this.buttons[k - 1] ? 0x80 : 0;
      // the NE558's timers: high until about 11 cycles a step of the paddle's value
      const p = this.paddles[(k - 4) & 3];
      return this.cpu.cycles - this.paddleT < p * 11 ? 0x80 : 0;
    }
    if (lo < 0x80) {
      this.paddleT = this.cpu.cycles;
      return 0;
    }
    if (lo < 0x90) {
      // the language card
      this.lcbank2 = !(lo & 8);
      const r = lo & 3;
      this.lcread = r === 0 || r === 3;
      if (lo & 1) {
        if (!write && this.lcprewrite) this.lcwrite = true;
        this.lcprewrite = !write;
      } else {
        this.lcwrite = false;
        this.lcprewrite = false;
      }
      return 0;
    }
    if (lo >= 0xb0 && lo < 0xc0) {
      if (write) {
        this.c0b0 = v & 0x3f;
        this.watch?.latch(this.c0b0);
      }
      return 0xbf; // written only: a read sees the floating bus
    }
    if (lo >= 0xe0 && lo < 0xf0) return this.drive.access(lo & 0x0f, write, v, this.cpu.cycles);
    return 0; // the empty slots
  }

  /**
   * Text page 1 as text, a string a row, trailing spaces trimmed: control codes shown as their
   * letters, 127 (the internal code's marker, a checkerboard on the screen) as ▒. For the
   * tests and the page's checks.
   * @returns {string[]}
   */
  screenText() {
    const out = [];
    for (let row = 0; row < 24; row++) {
      const base = 0x400 + (row & 7) * 128 + (row >> 3) * 40;
      let line = "";
      for (let c = 0; c < 40; c++) {
        let ch = this.ram[base + c] & 0x7f;
        if (ch === 0x7f) {
          line += "▒";
          continue;
        }
        if (ch < 0x20) ch += 0x40;
        line += String.fromCharCode(ch);
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  /** The text/lo-res and hi-res page the picture shows (80STORE keeps PAGE2 for memory). */
  get shownPage2() {
    return this.page2 && !this.store80;
  }
}
