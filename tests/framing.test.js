// SPDX-License-Identifier: Apache-2.0
//
// Where the camera goes to show a view (js/scene/framing.js; docs/ui-design.md, U2): the
// subject fills the asked share of whichever side of the free canvas runs out first, centred
// in it, seen from the view's direction.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corners, frame, silhouette } from "../js/scene/framing.js";

/** A box 0.4 m wide, 0.3 m tall and 0.2 m deep, standing on the origin. */
const BOX = corners([{ min: [-0.2, 0, -0.1], max: [0.2, 0.3, 0.1] }]);
const FOV = 30;

describe("framing a view", () => {
  it("straight on, in a wide canvas: the box's height fills 90% of the canvas's, centred", () => {
    const cam = frame(BOX, [0, 0, 1], FOV, 1600, 600, { top: 0, right: 0, bottom: 0, left: 0 });
    const s = silhouette(BOX, cam, FOV, 1600, 600);
    assert.ok(Math.abs((s.bottom - s.top) / 600 - 0.9) < 0.01, `${(s.bottom - s.top) / 600}`);
    assert.ok(Math.abs((s.left + s.right) / 2 - 800) < 1, "centred across");
    assert.ok(Math.abs((s.top + s.bottom) / 2 - 300) < 1, "centred down");
  });
  it("in a tall canvas the width runs out first, and fills the share asked", () => {
    const cam = frame(BOX, [0, 0, 1], FOV, 400, 900, { top: 0, right: 0, bottom: 0, left: 0 }, 0.8);
    const s = silhouette(BOX, cam, FOV, 400, 900);
    assert.ok(Math.abs((s.right - s.left) / 400 - 0.8) < 0.01, `${(s.right - s.left) / 400}`);
    assert.ok(s.bottom - s.top < 900 * 0.8, "the height has room to spare");
  });
  it("kept clear of the insets (a band above, a strip below): centred in what is left", () => {
    const insets = { top: 100, right: 0, bottom: 200, left: 0 };
    const cam = frame(BOX, [0, 0, 1], FOV, 1600, 900, insets);
    const s = silhouette(BOX, cam, FOV, 1600, 900);
    assert.ok(s.top >= insets.top - 1 && s.bottom <= 900 - insets.bottom + 1, `${s.top}..${s.bottom}`);
    assert.ok(Math.abs((s.top + s.bottom) / 2 - (100 + (900 - 300) / 2)) < 1, "centred in the free height");
  });
  it("from an angle, the corners as the camera sees them still fit", () => {
    const cam = frame(BOX, [-0.55, 0.5, 0.75], FOV, 1200, 700, { top: 0, right: 0, bottom: 0, left: 0 });
    const s = silhouette(BOX, cam, FOV, 1200, 700);
    assert.ok(s.left >= -1 && s.right <= 1201 && s.top >= -1 && s.bottom <= 701, JSON.stringify(s));
    assert.ok(Math.max((s.right - s.left) / 1200, (s.bottom - s.top) / 700) > 0.89, "the limiting side is filled");
  });
});
