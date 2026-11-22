// SPDX-License-Identifier: Apache-2.0
//
// The disk drive (js/sim/disk.js, js/sim/disk-image.js; design/v0.0.5.md, P1): sectors to the
// disk's bits and back, the files, and disks of our own made here (no Apple software), booted
// by the machine's own ROMs at a cold start and by PR#6, and written to.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankDisk, decode62, denibblizeTrack, encode62, nibblizeTrack, readDisk, SECTOR_IMAGE_BYTES, trackBytes, writeDisk } from "../js/sim/disk-image.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { ROMS } from "./boot.js";
import { bootDisk, noise } from "./disks.js";

/** A machine switched on with a disk in its drive, run for some seconds. @param {Uint8Array} img @param {number} [seconds] */
function boot(img, seconds = 4) {
  const m = new Machine(ROMS);
  m.drive.insert(readDisk(img, "ours.dsk"), 0);
  m.powerOn();
  m.run(Math.round(CLOCK_HZ * seconds));
  return m;
}

describe("disk images", () => {
  it("6 and 2: every sector back as it went, whatever its bytes", () => {
    for (let seed = 1; seed < 40; seed++) {
      const d = noise(256, seed);
      assert.deepEqual(decode62(encode62(d)), d);
    }
    const bad = encode62(noise(256, 3));
    bad[100] ^= 0x01;
    assert.equal(decode62(bad), null, "a wrong byte is caught");
  });
  it("a track's 16 sectors read back from its bits, and a self-sync byte is ten bits", () => {
    const data = Array.from({ length: 16 }, (_, s) => noise(256, 100 + s));
    const bits = nibblizeTrack((p) => data[p], 5);
    const back = denibblizeTrack(bits);
    for (let s = 0; s < 16; s++) assert.deepEqual(back[s], data[s], `sector ${s}`);
    assert.ok(bits.length > 48000 && bits.length < 52000, `${bits.length} bits a turn`);
    assert.deepEqual(trackBytes(bits).slice(0, 3), [0xff, 0xff, 0xff]);
  });
  it(".dsk and .po come back as they went; a .dsk of ProDOS order is known by its volume directory", () => {
    const img = noise(SECTOR_IMAGE_BYTES, 9);
    for (const name of ["a.dsk", "a.do", "a.po"]) assert.deepEqual(writeDisk(readDisk(img, name)).bytes, img, name);
    assert.equal(readDisk(img, "a.po").kind, "po");
    const pro = Uint8Array.from(img);
    pro.set([0, 0, 3, 0, 0xf4], 1024);
    pro[1024 + 0x23] = 0x27;
    pro[1024 + 0x24] = 0x0d;
    assert.equal(readDisk(pro, "b.dsk").kind, "po");
  });
  it("WOZ: written out, and read back bit for bit", () => {
    const disk = readDisk(noise(SECTOR_IMAGE_BYTES, 11), "c.dsk");
    disk.kind = "woz";
    const { bytes, extension } = writeDisk(disk);
    assert.equal(extension, "woz");
    const back = readDisk(bytes, "c.woz");
    assert.equal(back.kind, "woz");
    assert.deepEqual(back.tmap, disk.tmap);
    disk.tracks.forEach((t, i) => assert.deepEqual(back.tracks[i], t, `track ${i}`));
  });
  it("a file of another size is refused, and said why", () => {
    assert.throws(() => readDisk(new Uint8Array(1000), "x.dsk"), /143,360/);
  });
});

describe("the disk drive", () => {
  it("an empty drive: switched on, the ROM looks for a disk for about three seconds, the motor turning, then starts BASIC", () => {
    const m = new Machine(ROMS);
    m.powerOn();
    m.run(Math.round(CLOCK_HZ * 1));
    assert.ok(m.drive.spinning(m.cycles), "the motor turns while the ROM looks");
    m.run(Math.round(CLOCK_HZ * 4));
    assert.ok(m.screenText().some((l) => l.startsWith("]")), m.screenText().join("\n"));
    assert.ok(!m.drive.spinning(m.cycles), "and stops");
  });
  it("switched on with our disk in the drive: the ROM finds it, boots it, and our code prints what the ROM loaded", () => {
    const m = boot(bootDisk());
    assert.ok(m.screenText().some((l) => l.includes("BOOTED FROM A DISK OF OUR OWN")), m.screenText().join("\n"));
  });
  it("PR#6 boots it too, from BASIC", () => {
    const m = new Machine(ROMS);
    m.powerOn();
    m.run(Math.round(CLOCK_HZ * 3));
    m.drive.insert(readDisk(bootDisk(), "ours.dsk"), m.cycles);
    for (const ch of "PR#6\r") {
      m.keyPress(ch.charCodeAt(0));
      m.run(Math.round(CLOCK_HZ * 0.05));
      m.keyUp();
    }
    m.run(Math.round(CLOCK_HZ * 3));
    assert.ok(m.screenText().some((l) => l.includes("BOOTED FROM A DISK OF OUR OWN")), m.screenText().join("\n"));
  });
  it("written: a sector written through the controller, as DOS writes it, is read back and saved", () => {
    const m = new Machine(ROMS);
    m.powerOn();
    const disk = blankDisk("blank.dsk");
    m.drive.insert(disk, m.cycles);
    // write track 0 as DOS would, at its own pace: 32 cycles a byte, 40 a self-sync byte
    const data = noise(256, 21);
    const sectorBits = nibblizeTrack((p) => (p === 0 ? data : new Uint8Array(256)), 0);
    const bytes = trackBytes(sectorBits.subarray(0, sectorBits.length));
    let t = m.cycles + 100;
    const sw = (/** @type {number} */ k, /** @type {boolean} */ w = false, v = 0) => m.drive.access(k, w, v, t);
    sw(9);
    sw(10);
    sw(13);
    sw(15, true, 0xff);
    // self-sync bytes first, then the track's bytes as read back from its bits
    for (let i = 0; i < 40; i++) {
      sw(15, true, 0xff);
      t += 40;
    }
    for (const b of bytes.slice(0, 6000)) {
      sw(15, true, b);
      t += 32;
    }
    sw(14);
    sw(12);
    sw(8);
    assert.ok(disk.changed);
    const saved = writeDisk(disk).bytes;
    assert.deepEqual(saved.subarray(0, 256), data, "physical sector 0 is the file's first");
  });
});
