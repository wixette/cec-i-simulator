// SPDX-License-Identifier: Apache-2.0
//
// The ROM set (design/decisions.md, D2): the six chips of a working CEC-I, version 1.1, in
// roms/, each checked against the SHA-256 that roms/NOTICE gives. Fetched relative to this
// module, with its version stamp.

/** @typedef {import("./machine.js").Roms} Roms */
/** @typedef {keyof Roms} Chip */

/** Each chip's file, size and SHA-256 (roms/NOTICE). */
export const ROM_FILES = /** @type {Record<Chip, { file: string, size: number, sha256: string }>} */ ({
  u7: { file: "u7.cec-i-v1.1.bin", size: 32768, sha256: "779d7c665dddf39dc5586f9455695730b53b105c5192a3841238ada7a25f66d3" },
  u35: { file: "u35.tmm24256ap.bin", size: 32768, sha256: "418c44073818595b472cf7c3956e6d1c8bfbdf7edc4eb7a50b5c1761d842d459" },
  u33: { file: "u33.mx231024-0059.bin", size: 131072, sha256: "1e7161ebb3959d8e75909183992f3383b45ef5a9f967a8eadb91b545c2ab334f" },
  u34: { file: "u34.mx231024-0060.bin", size: 131072, sha256: "886a5fd7ec0f05f5a099591c2a77a4b358317d66205831b0264c7fa92e87c709" },
  u13: { file: "u13.9433c-0202.rcl-zh-32.bin", size: 4096, sha256: "ed5bdd4afa509134e85f1d020685af7ff50e279226eb869a17825b471cc1634c" },
  u26: { file: "u26.9433c-0201.rcl-zh-16.bin", size: 2048, sha256: "9501daf657954acaa7c1a6f881b3b80bc590bfea64f3068ed71ec52a552c01aa" },
});

/** @param {Uint8Array} bytes @returns {Promise<string>} */
export async function sha256(bytes) {
  const d = await crypto.subtle.digest("SHA-256", /** @type {BufferSource} */ (bytes));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @typedef {object} RomResult
 * @property {Roms | null} roms the set, or null if a chip is missing
 * @property {"ok" | "missing" | "other"} status ok: the set as roms/NOTICE gives it; other: a
 *   file of the right size with another hash (it runs, with a warning); missing: a file is not there
 * @property {string[]} files the files missing or different
 */

/**
 * Fetches the six chips.
 * @param {(file: string) => Promise<Uint8Array | null>} [fetchFile] for the tests
 * @returns {Promise<RomResult>}
 */
export async function loadRoms(fetchFile = fetchRom) {
  const chips = /** @type {Chip[]} */ (Object.keys(ROM_FILES));
  const got = await Promise.all(chips.map((c) => fetchFile(ROM_FILES[c].file)));
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const other = [];
  for (const [i, c] of chips.entries()) {
    const b = got[i];
    if (!b || b.length !== ROM_FILES[c].size) missing.push(ROM_FILES[c].file);
    else if ((await sha256(b)) !== ROM_FILES[c].sha256) other.push(ROM_FILES[c].file);
  }
  if (missing.length) return { roms: null, status: "missing", files: missing };
  const roms = /** @type {Roms} */ (Object.fromEntries(chips.map((c, i) => [c, got[i]])));
  return { roms, status: other.length ? "other" : "ok", files: other };
}

/** @param {string} file @returns {Promise<Uint8Array | null>} */
async function fetchRom(file) {
  const url = new URL(`../../roms/${file}`, import.meta.url);
  url.search = new URL(import.meta.url).search;
  try {
    const res = await fetch(url);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
