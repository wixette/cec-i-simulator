// SPDX-License-Identifier: Apache-2.0
//
// The photographs (docs/conventions.md, "References"): every picture in the repository is
// either a photograph, listed and credited in images/photos/CREDITS.md, or a screenshot of the
// page (screenshots/); and no JPEG carries metadata (no EXIF, XMP, IPTC, comment or embedded
// thumbnail: where and with what it was taken).

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter((f) => /\.(jpe?g|png|webp|heic|tiff?)$/i.test(f));
const credits = readFileSync(new URL("../images/photos/CREDITS.md", import.meta.url), "utf8");

/** The JPEG's segments' markers, up to the image data. @param {Buffer} b */
function markers(b) {
  /** @type {number[]} */
  const out = [];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1];
    out.push(m);
    if (m === 0xda) break; // start of scan: the picture itself
    i += 2 + b.readUInt16BE(i + 2);
  }
  return out;
}

describe("the photographs", () => {
  it("every photograph is in images/photos/ and credited", () => {
    for (const f of files.filter((x) => !x.startsWith("screenshots/"))) {
      assert.ok(f.startsWith("images/photos/"), `${f}: photographs go in images/photos/`);
      assert.ok(credits.includes(`(${f.slice("images/photos/".length)})`), `${f} is credited`);
    }
    assert.ok(files.length >= 1);
  });

  for (const f of files.filter((x) => /\.jpe?g$/i.test(x))) {
    it(`${f} carries no metadata`, () => {
      const b = readFileSync(new URL(`../${f}`, import.meta.url));
      assert.deepEqual([b[0], b[1]], [0xff, 0xd8], "a JPEG");
      // APP0 (JFIF) is allowed; APP1 (EXIF, XMP), APP2-APP15 (ICC, IPTC…) and comments are not
      const bad = markers(b).filter((m) => (m >= 0xe1 && m <= 0xef) || m === 0xfe);
      assert.deepEqual(bad.map((m) => m.toString(16)), []);
    });
  }
});
