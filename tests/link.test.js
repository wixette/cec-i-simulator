// SPDX-License-Identifier: Apache-2.0
//
// The link format (js/app/link.js; docs/ui-design.md, P8).

import assert from "node:assert/strict";
import { test } from "node:test";
import { linkHash, readLink, writeLink } from "../js/app/link.js";

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
