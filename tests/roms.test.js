// SPDX-License-Identifier: Apache-2.0
//
// The ROM set (design/decisions.md, D2): each file as roms/NOTICE names it, by its size and
// its SHA-256, and js/sim/roms.js loading it, and telling a missing or different file.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { loadRoms, ROM_FILES } from "../js/sim/roms.js";

const notice = readFileSync(new URL("../roms/NOTICE", import.meta.url), "utf8");
/** @param {string} file */
const bytes = (file) => new Uint8Array(readFileSync(new URL(`../roms/${file}`, import.meta.url)));

describe("the ROM set", () => {
  for (const [chip, { file, size, sha256 }] of Object.entries(ROM_FILES)) {
    it(`${chip}: ${file}, ${size} bytes, its SHA-256 as roms/NOTICE gives it`, () => {
      const b = bytes(file);
      assert.equal(b.length, size);
      assert.equal(createHash("sha256").update(b).digest("hex"), sha256);
      assert.match(notice, new RegExp(`${file.replace(/\./g, "\\.")} +${sha256}`));
    });
  }

  it("loads the set, and says which file is missing or different", async () => {
    const ok = await loadRoms(async (f) => bytes(f));
    assert.equal(ok.status, "ok");
    assert.ok(ok.roms);
    const missing = await loadRoms(async (f) => (f.startsWith("u13") ? null : bytes(f)));
    assert.deepEqual([missing.status, missing.files], ["missing", [ROM_FILES.u13.file]]);
    const other = await loadRoms(async (f) => {
      const b = bytes(f);
      if (f.startsWith("u26")) b[0] ^= 1;
      return b;
    });
    assert.deepEqual([other.status, other.files], ["other", [ROM_FILES.u26.file]]);
    assert.ok(other.roms, "a different file of the right size still runs");
  });
});
