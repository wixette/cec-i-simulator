// SPDX-License-Identifier: Apache-2.0
//
// The memory map the CPU tool draws (js/sim/memmap.js): its regions cover the 64 KB without a
// gap or an overlap, and light by their share of the traffic.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGIONS, regionOf, regionShares } from "../js/sim/memmap.js";
import { Machine } from "../js/sim/machine.js";
import { ROMS } from "./boot.js";

describe("the memory map", () => {
  it("the regions run from $0000 to $FFFF, one after another", () => {
    assert.equal(REGIONS[0].start, 0);
    assert.equal(REGIONS.at(-1)?.end, 0xffff);
    for (let i = 1; i < REGIONS.length; i++) assert.equal(REGIONS[i].start, REGIONS[i - 1].end + 1, REGIONS[i].id);
  });
  it("an address's region", () => {
    assert.equal(regionOf(0x0400).id, "text");
    assert.equal(regionOf(0x4e20).id, "hires2");
    assert.equal(regionOf(0xc0b0).id, "io");
    assert.equal(regionOf(0xfffc).id, "rom");
  });
  it("lit by their share of the traffic: writes to the text page light it", () => {
    const m = new Machine(ROMS);
    m.powered = true;
    m.takeTraffic();
    for (let a = 0x400; a < 0x800; a++) m.write(a, 0xa0);
    m.read(0xfffc);
    const shares = regionShares(m.takeTraffic());
    assert.ok((shares.get("text") ?? 0) > 0.9);
    assert.ok((shares.get("rom") ?? 0) > 0);
    assert.equal(shares.get("hires1"), 0);
  });
});
