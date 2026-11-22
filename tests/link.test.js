// SPDX-License-Identifier: Apache-2.0
//
// The link format (js/app/link.js; docs/ui-design.md, P8).

import assert from "node:assert/strict";
import { test } from "node:test";
import { linkHash, readLink, writeLink } from "../js/app/link.js";
import { matchLocale, pickLocale } from "../js/l10n/locales.js";

test("#view=2d and #view=3d are read; anything else is not a view", () => {
  assert.deepEqual(readLink("#view=2d"), { view: "2d" });
  assert.deepEqual(readLink("#view=3d"), { view: "3d" });
  assert.deepEqual(readLink("#view=4d"), {});
  assert.deepEqual(readLink(""), {});
  assert.equal(linkHash({ view: "2d" }), "#view=2d");
  assert.equal(linkHash({}), "");
});

test("written to the address bar without a new history entry, and only when it changes; no view, no hash", () => {
  /** @type {string[]} */
  const replaced = [];
  const g = /** @type {any} */ (globalThis);
  g.location = { hash: "", pathname: "/cec-i-simulator/", search: "?lang=en" };
  g.history = { replaceState: (/** @type {unknown} */ _s, /** @type {string} */ _t, /** @type {string} */ url) => replaced.push(url) };
  try {
    writeLink({ view: "2d" });
    g.location.hash = "#view=2d";
    writeLink({ view: "2d" });
    writeLink({});
    assert.deepEqual(replaced, ["#view=2d", "/cec-i-simulator/?lang=en"]);
  } finally {
    delete g.location;
    delete g.history;
  }
});

test("frozen at 1.0.0 (docs/stability.md): links of 1.0 read as they did, and a field not known is ignored", () => {
  // the links 1.0 writes, and ones a later version may write with more fields
  assert.deepEqual(readLink("#view=3d"), { view: "3d" });
  assert.deepEqual(readLink("#view=2d&later=1"), { view: "2d" });
  assert.deepEqual(readLink("#later=1&view=2d"), { view: "2d" });
  assert.deepEqual(readLink("#VIEW=2d"), {}, "the field's name as written, lower case");
  // ?lang=: each of the ten by its own tag, and the tags that map to one
  for (const l of ["zh", "en", "zh-TW", "ja", "ko", "es", "fr", "de", "it", "pt-BR"]) assert.equal(pickLocale({ query: l }), l);
  assert.equal(matchLocale("zh-CN"), "zh");
  assert.equal(matchLocale("en-GB"), "en");
  assert.equal(pickLocale({ query: "xx", saved: null, browser: [] }), "zh", "a language not here: else 简体中文");
});
