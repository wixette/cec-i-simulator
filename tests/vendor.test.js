// SPDX-License-Identifier: Apache-2.0
//
// The page runs only what is in the repository (tools/vendor.mjs). These tests keep it
// honest, offline: vendor/ equals node_modules for the npm packages, and the icon module is
// what tools/vendor.mjs makes. tests/stamp.test.js checks the import map; tests/roms.test.js
// the ROMs.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ICONS_MODULE, iconsModule, sourcePath, VENDORED, vendorPath } from "../tools/vendor.mjs";

describe("vendor/ matches the versions in package.json", () => {
  for (const [pkg, files] of Object.entries(VENDORED)) {
    for (const file of files) {
      it(`${pkg}/${file}`, () => {
        assert.ok(existsSync(vendorPath(pkg, file)), `${vendorPath(pkg, file)} is missing: run pnpm vendor`);
        assert.ok(readFileSync(vendorPath(pkg, file)).equals(readFileSync(sourcePath(pkg, file))), `${vendorPath(pkg, file)} differs from node_modules: run pnpm vendor`);
      });
    }
  }

  it("vendor/material-symbols/icons.js holds the icons listed in tools/vendor.mjs", () => {
    assert.equal(readFileSync(ICONS_MODULE, "utf8"), iconsModule(), "run pnpm vendor");
  });

  it("every icon the page names is vendored", () => {
    const icons = new Set(Object.keys(JSON.parse(`{${readFileSync(ICONS_MODULE, "utf8").split("({")[1].split("})")[0].trim().replace(/,$/, "")}}`)));
    const pages = ["index.html", "js/app/main.js", "js/app/stage.js", "js/app/strip.js", "js/app/topbar.js", "js/app/dock.js"].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
    const named = new Set([...pages.matchAll(/(?:data-icon="|icon\(")([a-z_]+)"/g), ...pages.matchAll(/icon: "([a-z_]+)"/g)].map((m) => m[1]));
    for (const n of named) assert.ok(icons.has(n), `${n} is not vendored`);
  });
});
