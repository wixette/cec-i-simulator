// SPDX-License-Identifier: Apache-2.0
//
// The CEC-I's address space as the CPU & Memory tool draws it: each region of the 64 KB the
// 6502 addresses, the chips behind it, and which of the machine's traffic counts light it
// (js/sim/machine.js, Traffic: RAM page by page, the ROMs by chip). Main memory as BASIC uses
// it; the aux side (the font window, the tables, the Chinese system) shares addresses with it,
// switched in by the soft switches, and lights the region it is switched into. Pure data, no DOM.

/** @typedef {import("./machine.js").Traffic} Traffic */

/**
 * @typedef {object} Region
 * @property {string} id the message key's last part (region.<id>)
 * @property {number} start @property {number} end inclusive
 * @property {string[]} chips the chips behind it, by designator
 * @property {(Exclude<keyof Traffic, "pages">)[]} chipTraffic the chips' counts that light it too, besides its RAM pages
 */

/** @type {readonly Region[]} */
export const REGIONS = [
  { id: "zp", start: 0x0000, end: 0x03ff, chips: ["U5", "U6"], chipTraffic: [] },
  { id: "text", start: 0x0400, end: 0x07ff, chips: ["U5", "U6"], chipTraffic: [] },
  { id: "ram", start: 0x0800, end: 0x1fff, chips: ["U5", "U6"], chipTraffic: [] },
  { id: "hires1", start: 0x2000, end: 0x3fff, chips: ["U5", "U6"], chipTraffic: [] },
  { id: "hires2", start: 0x4000, end: 0x5fff, chips: ["U5", "U6", "U33", "U34"], chipTraffic: ["font"] },
  { id: "ram2", start: 0x6000, end: 0x7fff, chips: ["U5", "U6"], chipTraffic: [] },
  { id: "tables", start: 0x8000, end: 0xbfff, chips: ["U5", "U6", "U35"], chipTraffic: ["u35"] },
  { id: "io", start: 0xc000, end: 0xc0ff, chips: ["U15", "U4", "U32", "U25"], chipTraffic: ["io", "latch"] },
  { id: "firmware", start: 0xc100, end: 0xcfff, chips: ["U7", "U35"], chipTraffic: [] },
  { id: "rom", start: 0xd000, end: 0xffff, chips: ["U7", "U35", "U5", "U6"], chipTraffic: ["u7", "lc"] },
];

/**
 * Which region holds an address.
 * @param {number} a
 * @returns {Region}
 */
export function regionOf(a) {
  return REGIONS.find((r) => a >= r.start && a <= r.end) ?? REGIONS[0];
}

/**
 * Each region's share of a frame's traffic, 0..1 (the square root, so that a little shows).
 * @param {Traffic} t
 * @returns {Map<string, number>}
 */
export function regionShares(t) {
  /** @param {Region} r */
  const count = (r) => {
    let n = r.chipTraffic.reduce((s, k) => s + t[k], 0);
    // main RAM behind the region, page by page (the I/O page and the ROMs have none)
    for (let p = r.start >> 8; p <= Math.min(r.end, 0xbfff) >> 8 && p < t.pages.length; p++) n += t.pages[p];
    return n;
  };
  const by = new Map(REGIONS.map((r) => [r.id, count(r)]));
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  return new Map([...by].map(([id, n]) => [id, total ? Math.sqrt(n / total) : 0]));
}
