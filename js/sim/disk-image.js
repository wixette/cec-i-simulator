// SPDX-License-Identifier: Apache-2.0
//
// Disk images (design/v0.0.5.md, P1): a 5.25-inch disk as the drive sees it, a stream of bits
// for each track, and the files that hold one. A sector image (.dsk, .do, .po: 35 tracks of
// 16 sectors of 256 bytes) is written out as DOS 3.3 formats a disk: each sector an address
// field and a data field, 6-and-2 encoded, between self-sync bytes; and read back into sectors
// when it is saved. A .nib holds each track's bytes as they pass the head; a WOZ file, each
// track's bits (version 1 or 2), and keeps copy-protected disks as they are.
//
// No DOM: the page and the tests use it alike.

/** Tracks on a 5.25-inch disk, as DOS formats it. */
export const TRACKS = 35;
export const SECTORS = 16;
/** A sector image's size: 35 × 16 × 256. */
export const SECTOR_IMAGE_BYTES = TRACKS * SECTORS * 256;
/** A .nib track's bytes. */
const NIB_TRACK = 6656;
/** An unformatted track's bits: a turn of the disk at 4 µs a bit, 200 ms a turn. */
const BLANK_BITS = 51200;

/** Where each physical sector's bytes are in the file, for DOS 3.3 order and ProDOS order. */
const ORDER = {
  dos: [0x0, 0x7, 0xe, 0x6, 0xd, 0x5, 0xc, 0x4, 0xb, 0x3, 0xa, 0x2, 0x9, 0x1, 0x8, 0xf],
  prodos: [0x0, 0x8, 0x1, 0x9, 0x2, 0xa, 0x3, 0xb, 0x4, 0xc, 0x5, 0xd, 0x6, 0xe, 0x7, 0xf],
};

/** The 64 disk bytes a 6-bit value is written as. */
const WRITE62 = [
  0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6, 0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
  0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff,
];
const READ62 = new Int8Array(256).fill(-1);
WRITE62.forEach((b, i) => (READ62[b] = i));

/**
 * A disk: each track's bits (a byte a bit, 0 or 1), the quarter tracks they lie under, and
 * what it was loaded from (so that it can be saved as it came).
 * @typedef {object} Disk
 * @property {string} name the file's name, or what the page calls it
 * @property {"dsk" | "po" | "nib" | "woz"} kind
 * @property {Uint8Array[]} tracks
 * @property {Uint8Array} tmap the track under each of the 160 quarter tracks, or 255 for none
 * @property {boolean} writeProtected
 * @property {Uint8Array} [sectors] a sector image's bytes, as loaded (what saving starts from)
 * @property {boolean} [changed] written since it was loaded
 */

/** The two halves of a byte, as an address field keeps them (4 and 4). @param {number} v @param {number[]} out */
function put44(v, out) {
  out.push((v >> 1) | 0xaa, v | 0xaa);
}

/** The bits of the bytes, eight each, a self-sync byte ten (two zeros after it). @param {number[]} bytes @param {number[]} bits @param {boolean} [sync] */
function putBits(bytes, bits, sync = false) {
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    if (sync) bits.push(0, 0);
  }
}

/**
 * A sector's 256 bytes as the 343 disk bytes of its data field (6 and 2): 86 bytes of the
 * low two bits, then 256 of the high six, each the one before it exclusive-or'd in, and a
 * checksum, as the boot ROM at $C600 reads them.
 * @param {Uint8Array} d
 * @returns {number[]}
 */
export function encode62(d) {
  const swap = (/** @type {number} */ x) => ((x & 1) << 1) | ((x >> 1) & 1);
  /** @type {number[]} */
  const vals = [];
  for (let k = 0; k < 86; k++) vals.push(swap(d[k] & 3) | (swap(d[k + 86] & 3) << 2) | (k + 172 < 256 ? swap(d[k + 172] & 3) << 4 : 0));
  for (let y = 0; y < 256; y++) vals.push(d[y] >> 2);
  /** @type {number[]} */
  const out = [];
  let prev = 0;
  for (const v of vals) {
    out.push(WRITE62[v ^ prev]);
    prev = v;
  }
  out.push(WRITE62[prev]);
  return out;
}

/**
 * The 256 bytes back from a data field's 343 disk bytes, or null if a byte is not a disk byte
 * or the checksum is wrong.
 * @param {number[]} n
 * @returns {Uint8Array | null}
 */
export function decode62(n) {
  const vals = [];
  let prev = 0;
  for (let i = 0; i < 343; i++) {
    const v = READ62[n[i]];
    if (v < 0) return null;
    prev ^= v;
    vals.push(prev);
  }
  if (vals[342] !== 0) return null;
  const d = new Uint8Array(256);
  for (let y = 0; y < 256; y++) {
    const two = (vals[y % 86] >> (2 * Math.floor(y / 86))) & 3;
    d[y] = (vals[86 + y] << 2) | ((two & 1) << 1) | (two >> 1);
  }
  return d;
}

/**
 * A track of 16 sectors as DOS 3.3 formats it: self-sync bytes, then for each physical
 * sector its address field (D5 AA 96, volume, track, sector, checksum, DE AA EB), a few more
 * self-sync bytes and its data field (D5 AA AD, 343 bytes, DE AA EB).
 * @param {(physical: number) => Uint8Array} sector
 * @param {number} track
 * @param {number} [volume]
 */
export function nibblizeTrack(sector, track, volume = 254) {
  /** @type {number[]} */
  const bits = [];
  putBits(new Array(64).fill(0xff), bits, true);
  for (let s = 0; s < SECTORS; s++) {
    /** @type {number[]} */
    const addr = [0xd5, 0xaa, 0x96];
    for (const v of [volume, track, s, volume ^ track ^ s]) put44(v, addr);
    addr.push(0xde, 0xaa, 0xeb);
    putBits(addr, bits);
    putBits(new Array(6).fill(0xff), bits, true);
    putBits([0xd5, 0xaa, 0xad, ...encode62(sector(s)), 0xde, 0xaa, 0xeb], bits);
    putBits(new Array(20).fill(0xff), bits, true);
  }
  return Uint8Array.from(bits);
}

/** The bytes under the head as the controller reads them from a track's bits, twice round (so that a field across its end is whole). @param {Uint8Array} bits */
export function trackBytes(bits) {
  /** @type {number[]} */
  const out = [];
  let sr = 0;
  for (let i = 0; i < bits.length * 2; i++) {
    const b = bits[i % bits.length];
    if (sr === 0 && b === 0) continue;
    sr = (sr << 1) | b;
    if (sr & 0x80) {
      out.push(sr);
      sr = 0;
    }
  }
  return out;
}

/**
 * The sectors found on a track's bits: each physical sector's 256 bytes, or undefined where
 * none could be read.
 * @param {Uint8Array} bits
 * @returns {(Uint8Array | undefined)[]}
 */
export function denibblizeTrack(bits) {
  const n = trackBytes(bits);
  /** @type {(Uint8Array | undefined)[]} */
  const found = new Array(SECTORS);
  const de44 = (/** @type {number} */ i) => ((n[i] << 1) | 1) & n[i + 1];
  for (let i = 0; i + 14 < n.length; i++) {
    if (n[i] !== 0xd5 || n[i + 1] !== 0xaa || n[i + 2] !== 0x96) continue;
    const [vol, trk, sec, sum] = [de44(i + 3), de44(i + 5), de44(i + 7), de44(i + 9)];
    if ((vol ^ trk ^ sec) !== sum || sec >= SECTORS) continue;
    // its data field, a few bytes on
    for (let j = i + 11; j < i + 11 + 40 && j + 346 < n.length; j++) {
      if (n[j] !== 0xd5 || n[j + 1] !== 0xaa || n[j + 2] !== 0xad) continue;
      const d = decode62(n.slice(j + 3, j + 346));
      if (d && !found[sec]) found[sec] = d;
      break;
    }
  }
  return found;
}

/** Each track at its whole-track quarter, and the quarters either side of it (as WOZ maps a 5.25-inch disk). @param {number} count */
function standardTmap(count) {
  const tmap = new Uint8Array(160).fill(255);
  for (let t = 0; t < count; t++) for (const q of [4 * t - 1, 4 * t, 4 * t + 1]) if (q >= 0 && q < 160) tmap[q] = t;
  return tmap;
}

/** Whether a 140 KB image holds ProDOS order: its volume directory's key block (block 2) where ProDOS puts it. @param {Uint8Array} b */
function looksProdos(b) {
  const blk = b.subarray(2 * 512, 3 * 512);
  return blk[0] === 0 && blk[1] === 0 && (blk[4] & 0xf0) === 0xf0 && blk[0x23] === 0x27 && blk[0x24] === 0x0d;
}

/** Whether a 140 KB image holds DOS 3.3 order: a VTOC at track 17, sector 0. @param {Uint8Array} b */
function looksDos(b) {
  const v = b.subarray(17 * 16 * 256, 17 * 16 * 256 + 256);
  return v[1] === 17 && v[3] === 3 && v[0x34] === 35 && v[0x35] === 16;
}

/**
 * A disk from a sector image.
 * @param {Uint8Array} bytes 143,360 of them
 * @param {"dos" | "prodos"} order
 * @param {string} name
 * @returns {Disk}
 */
function fromSectors(bytes, order, name) {
  const map = ORDER[order];
  const tracks = [];
  for (let t = 0; t < TRACKS; t++) tracks.push(nibblizeTrack((p) => bytes.subarray((t * SECTORS + map[p]) * 256, (t * SECTORS + map[p] + 1) * 256), t));
  return { name, kind: order === "dos" ? "dsk" : "po", tracks, tmap: standardTmap(TRACKS), writeProtected: false, sectors: Uint8Array.from(bytes) };
}

/** A blank disk, never formatted: no sectors, until a DOS formats it. @param {string} name @returns {Disk} */
export function blankDisk(name) {
  const tracks = Array.from({ length: TRACKS }, () => new Uint8Array(BLANK_BITS));
  return { name, kind: "dsk", tracks, tmap: standardTmap(TRACKS), writeProtected: false, sectors: new Uint8Array(SECTOR_IMAGE_BYTES) };
}

/** A little-endian number. @param {Uint8Array} b @param {number} at @param {number} n bytes */
const le = (b, at, n) => {
  let v = 0;
  for (let i = n - 1; i >= 0; i--) v = v * 256 + b[at + i];
  return v;
};

/** The bits of a track's bytes, most significant first. @param {Uint8Array} b @param {number} count */
function unpackBits(b, count) {
  const bits = new Uint8Array(count);
  for (let i = 0; i < count; i++) bits[i] = (b[i >> 3] >> (7 - (i & 7))) & 1;
  return bits;
}

/** A WOZ file (version 1 or 2). @param {Uint8Array} b @param {string} name @returns {Disk} */
function fromWoz(b, name) {
  const version = b[3] === 0x32 ? 2 : 1;
  /** @type {Record<string, Uint8Array>} */
  const chunks = {};
  for (let at = 12; at + 8 <= b.length; ) {
    const id = String.fromCharCode(...b.subarray(at, at + 4));
    const size = le(b, at + 4, 4);
    chunks[id] = b.subarray(at + 8, at + 8 + size);
    at += 8 + size;
  }
  const info = chunks.INFO;
  const tmap = chunks.TMAP;
  const trks = chunks.TRKS;
  if (!info || !tmap || !trks) throw new Error("not a WOZ disk: a chunk is missing");
  if (info[1] !== 1) throw new Error("not a 5.25-inch disk");
  /** @type {Uint8Array[]} */
  const tracks = [];
  const count = Math.max(...[...tmap].filter((x) => x !== 255), -1) + 1;
  for (let t = 0; t < count; t++) {
    if (version === 1) {
      const at = t * 6656;
      tracks.push(unpackBits(trks.subarray(at, at + 6646), le(trks, at + 6648, 2)));
    } else {
      const start = le(trks, t * 8, 2) * 512;
      const bitCount = le(trks, t * 8 + 4, 4);
      tracks.push(unpackBits(b.subarray(start, start + Math.ceil(bitCount / 8)), bitCount));
    }
  }
  return { name, kind: "woz", tracks, tmap: Uint8Array.from(tmap.subarray(0, 160)), writeProtected: info[2] === 1 };
}

/**
 * A disk from a file: by its contents where they say (WOZ), else by its size and name.
 * @param {Uint8Array} bytes
 * @param {string} name
 * @returns {Disk}
 */
export function readDisk(bytes, name) {
  const lower = name.toLowerCase();
  if (bytes[0] === 0x57 && bytes[1] === 0x4f && bytes[2] === 0x5a && (bytes[3] === 0x31 || bytes[3] === 0x32)) return fromWoz(bytes, name);
  if (bytes.length === TRACKS * NIB_TRACK) {
    const tracks = Array.from({ length: TRACKS }, (_, t) => unpackBits(bytes.subarray(t * NIB_TRACK, (t + 1) * NIB_TRACK), NIB_TRACK * 8));
    return { name, kind: "nib", tracks, tmap: standardTmap(TRACKS), writeProtected: false };
  }
  if (bytes.length === SECTOR_IMAGE_BYTES) {
    const order = lower.endsWith(".po") ? "prodos" : lower.endsWith(".do") ? "dos" : looksProdos(bytes) && !looksDos(bytes) ? "prodos" : "dos";
    return fromSectors(bytes, order, name);
  }
  throw new Error("not a 5.25-inch disk image: a .dsk, .do or .po is 143,360 bytes, a .nib 232,960");
}

/** CRC-32, as WOZ files carry it. @param {Uint8Array} b */
function crc32(b) {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** A WOZ 2 file of a disk's tracks. @param {Disk} disk */
function toWoz(disk) {
  const blocks = disk.tracks.map((t) => Math.ceil(Math.ceil(t.length / 8) / 512));
  const size = 1536 + blocks.reduce((a, n) => a + n * 512, 0);
  const b = new Uint8Array(size);
  const put = (/** @type {number} */ at, /** @type {number} */ v, /** @type {number} */ n) => {
    for (let i = 0; i < n; i++) b[at + i] = (v / 256 ** i) & 0xff;
  };
  b.set([0x57, 0x4f, 0x5a, 0x32, 0xff, 0x0a, 0x0d, 0x0a], 0);
  // INFO
  b.set([0x49, 0x4e, 0x46, 0x4f], 12);
  put(16, 60, 4);
  b[20] = 2; // INFO version
  b[21] = 1; // 5.25-inch
  b[22] = disk.writeProtected ? 1 : 0;
  const creator = "CEC-I Simulator".padEnd(32, " ");
  for (let i = 0; i < 32; i++) b[25 + i] = creator.charCodeAt(i);
  b[57] = 1; // one side
  b[59] = 32; // optimal bit timing: 4 µs
  put(64, Math.max(...blocks, 0), 2);
  // TMAP
  b.set([0x54, 0x4d, 0x41, 0x50], 80);
  put(84, 160, 4);
  b.set(disk.tmap, 88);
  // TRKS
  b.set([0x54, 0x52, 0x4b, 0x53], 248);
  put(252, size - 256, 4);
  let block = 3;
  disk.tracks.forEach((bits, t) => {
    put(256 + t * 8, block, 2);
    put(256 + t * 8 + 2, blocks[t], 2);
    put(256 + t * 8 + 4, bits.length, 4);
    const at = block * 512;
    for (let i = 0; i < bits.length; i++) if (bits[i]) b[at + (i >> 3)] |= 0x80 >> (i & 7);
    block += blocks[t];
  });
  put(8, crc32(b.subarray(12)), 4);
  return b;
}

/**
 * A disk as a file to save: a sector image as it came, with every sector that can be read
 * from its tracks now (so what was written is in it); anything else as WOZ 2.
 * @param {Disk} disk
 * @returns {{ bytes: Uint8Array, extension: string }}
 */
export function writeDisk(disk) {
  if ((disk.kind === "dsk" || disk.kind === "po") && disk.sectors) {
    const map = ORDER[disk.kind === "dsk" ? "dos" : "prodos"];
    const out = Uint8Array.from(disk.sectors);
    for (let t = 0; t < TRACKS; t++) {
      const found = denibblizeTrack(disk.tracks[t]);
      found.forEach((d, p) => d && out.set(d, (t * SECTORS + map[p]) * 256));
    }
    return { bytes: out, extension: disk.kind === "dsk" ? "dsk" : "po" };
  }
  return { bytes: toWoz(disk), extension: "woz" };
}
