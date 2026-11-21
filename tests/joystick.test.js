// SPDX-License-Identifier: Apache-2.0
//
// The joystick on the visitor's keys (js/sim/joystick.js, design/v0.0.3.md, P2): a spring stick
// on paddles 0 and 1, two buttons, and the port as BASIC reads it.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CENTRE, Joystick, joystickKey, SWING_S, UNPLUGGED } from "../js/sim/joystick.js";
import { session } from "./boot.js";

describe("the joystick", () => {
  it("unplugged, the port reads as with nothing in it: the paddles 255, the buttons up", () => {
    const j = new Joystick();
    const m = { paddles: [0, 0, 0, 0], buttons: [true, true, false] };
    j.push("left", true);
    j.button(0, true);
    j.apply(m);
    assert.deepEqual(m.paddles.slice(0, 2), [UNPLUGGED, UNPLUGGED]);
    assert.deepEqual(m.buttons.slice(0, 2), [false, false]);
  });
  it("a spring stick: an arrow held pushes it to the edge in SWING_S, let go it comes back to the centre", () => {
    const j = new Joystick();
    j.plug(true);
    assert.deepEqual([j.x, j.y], [CENTRE, CENTRE]);
    j.push("right", true);
    j.step(SWING_S / 2);
    assert.ok(j.x > CENTRE && j.x < 255, "on its way");
    j.step(SWING_S);
    assert.equal(j.x, 255);
    j.push("right", false);
    j.push("up", true);
    j.step(SWING_S * 2);
    assert.deepEqual([j.x, j.y], [CENTRE, 0]);
  });
  it("both arrows of an axis: the centre; an arrow held by two keys stays held until both let go", () => {
    const j = new Joystick();
    j.plug(true);
    j.push("left", true);
    j.push("right", true);
    assert.equal(j.target.x, CENTRE);
    j.push("right", false);
    j.push("left", true);
    j.push("left", false);
    assert.equal(j.target.x, 0);
  });
  it("the buttons, and the visitor's keys: arrows the stick's, Space button 0, Ctrl button 1", () => {
    assert.deepEqual(joystickKey("ArrowDown"), { stick: "down" });
    assert.deepEqual(joystickKey("Space"), { button: 0 });
    assert.deepEqual(joystickKey("ControlRight"), { button: 1 });
    assert.equal(joystickKey("KeyA"), null);
  });
  it("BASIC reads it: PDL(0) at the right edge, PDL(1) centred, button 0 down at 49249", () => {
    const s = session();
    const j = new Joystick();
    j.plug(true);
    j.push("right", true);
    j.button(0, true);
    j.step(1);
    j.apply(s.m);
    s.type("PRINT PDL(0);\",\";PDL(1);\",\";PEEK(49249);\",\";PEEK(49250)\n", 1);
    const line = s.text().find((l) => /^\d+,\d+,\d+,\d+/.test(l.trim())) ?? "";
    const [x, y, b0, b1] = line.trim().split(",").map(Number);
    assert.ok(x >= 250, `PDL(0) ${x}`);
    assert.ok(Math.abs(y - CENTRE) <= 8, `PDL(1) ${y}`);
    assert.ok(b0 >= 128 && b1 < 128, `${b0}, ${b1}`);
  });
});
