// SPDX-License-Identifier: Apache-2.0
//
// The TV's knobs (js/scene/knobs.js): as set up, the picture as the machine sends it; colour
// down to 0 is black and white; brightness raises the black level.

import assert from "node:assert/strict";
import { test } from "node:test";
import { knobTable } from "../js/scene/knobs.js";

test("as set up (brightness 0.5, colour 0.75), a colour passes unchanged", () => {
  assert.deepEqual(knobTable(0.5, 0.75)(221, 34, 221).map(Math.round), [221, 34, 221]);
});
test("colour at 0 gives the colour's own grey", () => {
  const [r, g, b] = knobTable(0.5, 0)(221, 34, 221).map(Math.round);
  assert.ok(r === g && g === b);
});
test("brightness up lifts black; down darkens; values stay 0..255", () => {
  assert.ok(knobTable(1, 0.75)(0, 0, 0)[0] > 0);
  assert.ok(knobTable(0, 0.75)(200, 200, 200)[0] < 200);
  for (const v of knobTable(1, 1)(255, 255, 255)) assert.ok(v <= 255);
});

test("the glass: a black-and-white TV's is a neutral grey, a colour TV's grey-green (D6)", async () => {
  const { GLASS } = await import("../js/scene/knobs.js");
  for (const c of [GLASS.bw.off, GLASS.bw.lit]) assert.ok(c[0] === c[1] && c[1] === c[2], `${c}`);
  assert.ok(GLASS.colour.lit[1] > GLASS.colour.lit[0], "green over red");
  for (const d of /** @type {const} */ (["colour", "bw", "green"])) assert.ok(GLASS[d].lit[0] < GLASS[d].off[0], `${d}: lit reads darker`);
});
