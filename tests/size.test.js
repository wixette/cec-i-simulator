// SPDX-License-Identifier: Apache-2.0
//
// What a first visit fetches, held to a budget (design/v1.0.0.md, task 9): the 3D model, the
// ROMs, three.js, the font and the icons, the page's own code and CSS, English and one more
// language, and the two photographs the first lesson shows. Measured as the files are on disk;
// GitHub Pages compresses the code and the CSS on the way (three.js to about a third), not the
// model, the ROMs or the photographs. A test that fails here asks whether the page needs what
// was added, before the budget is raised.

import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LESSONS } from "../js/lessons/lessons.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const KB = 1024;
const MB = 1024 * KB;

/** A file's size. @param {string} path from the repository's root */
const size = (path) => statSync(join(ROOT, path)).size;
/** Every file under a folder with one of these endings. @param {string} dir @param {RegExp} re @returns {string[]} */
const walk = (dir, re) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`, re) : re.test(e.name) ? [`${dir}/${e.name}`] : []));
const sum = (/** @type {string[]} */ files) => files.reduce((a, f) => a + size(f), 0);

const model = size("model/cec-i.glb");
const roms = sum(walk("roms", /\.bin$/));
const three = sum(walk("vendor/three", /\.js$/));
const fontAndIcons = sum([...walk("vendor/roboto-flex", /\.woff2$/), ...walk("vendor/material-symbols", /\.js$/)]);
// the page's own code: every module but the languages, then English and the largest other one
const code = sum(walk("js", /\.js$/).filter((f) => !f.startsWith("js/l10n/")));
const langs = walk("js/l10n", /^(?!l10n|locales).*\.js$/);
const langSize = (/** @type {string} */ loc) => size(`js/l10n/${loc}.js`) + size(`js/l10n/lessons.${loc}.js`);
const otherLangs = [...new Set(langs.map((f) => f.replace(/^js\/l10n\/(lessons\.)?/, "").replace(/\.js$/, "")))].filter((l) => l !== "en");
const language = langSize("en") + Math.max(...otherLangs.map(langSize));
const css = sum(walk("css", /\.css$/)) + size("index.html");
const firstPhotos = sum(LESSONS[0].steps.filter((s) => s.photo).map((s) => `images/photos/web/${s.photo}`));

describe("what a first visit fetches", () => {
  it("the 3D model under 5.5 MB; the ROMs as they are (336 KB)", () => {
    assert.ok(model < 5.5 * MB, `${(model / MB).toFixed(2)} MB`);
    assert.ok(roms <= 340 * KB, `${roms / KB} KB`);
  });
  it("the page's own code under 600 KB, and two languages under 200 KB", () => {
    assert.ok(code < 600 * KB, `${(code / KB).toFixed(0)} KB`);
    assert.ok(language < 200 * KB, `${(language / KB).toFixed(0)} KB`);
  });
  it("each web copy of a photograph under 250 KB, the first lesson's two under 400 KB", () => {
    for (const f of walk("images/photos/web", /\.jpg$/)) assert.ok(size(f) < 250 * KB, `${f}: ${(size(f) / KB).toFixed(0)} KB`);
    assert.ok(firstPhotos < 400 * KB, `${(firstPhotos / KB).toFixed(0)} KB`);
  });
  it("all of it under 9 MB as stored (about 7 MB over the wire, the code compressed)", () => {
    const total = model + roms + three + fontAndIcons + code + language + css + firstPhotos;
    assert.ok(total < 9 * MB, `${(total / MB).toFixed(2)} MB: model ${(model / MB).toFixed(2)}, three ${(three / MB).toFixed(2)}, code ${(code / KB).toFixed(0)} KB, photos ${(firstPhotos / KB).toFixed(0)} KB`);
  });
});
