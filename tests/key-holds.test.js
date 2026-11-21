// SPDX-License-Identifier: Apache-2.0
//
// Who holds each key (js/sim/key-holds.js): the visitor's keyboard, the pointer, and the
// pointer's held modifiers, so that Ctrl-Reset and Ctrl-Reset-TEST can be clicked and no key
// is left stuck down.

import assert from "node:assert/strict";
import { test } from "node:test";
import { KeyHolds, RESET_HOLD_MS } from "../js/sim/key-holds.js";

function rig() {
  /** @type {string[]} */
  const log = [];
  let t = 0;
  const h = new KeyHolds((id, down) => log.push(`${id}${down ? "+" : "-"}`), { now: () => t, later: (f, ms) => ((t += ms), f()) });
  return { h, log };
}
const UP = { ctrlKey: false, shiftKey: false };

test("Ctrl clicked stays down until the next key is let go: Ctrl-Reset", () => {
  const { h, log } = rig();
  h.pointerDown("ctrl");
  h.pointerUp("ctrl");
  assert.ok(h.held("ctrl"));
  h.pointerDown("reset");
  assert.ok(h.held("reset"));
  h.pointerUp("reset");
  assert.deepEqual(log, ["ctrl+", "reset+", "reset-", "ctrl-"]);
  assert.ok(!h.held("ctrl") && !h.held("reset"));
});

test("Ctrl, TEST, RESET clicked: Ctrl-Reset-TEST", () => {
  const { h, log } = rig();
  for (const id of ["ctrl", "test", "reset"]) h.pointerDown(id), h.pointerUp(id);
  assert.deepEqual(log, ["ctrl+", "test+", "reset+", "reset-", "ctrl-", "test-"]);
});

test("a held modifier clicked again lets go", () => {
  const { h, log } = rig();
  h.pointerDown("lshift");
  h.pointerDown("lshift");
  assert.deepEqual(log, ["lshift+", "lshift-"]);
});

test("a lost keyup of Ctrl (a Mac's Ctrl-click menu) is released by the next event", () => {
  const { h, log } = rig();
  h.hostDown("ctrl");
  h.sync({ ctrlKey: true, shiftKey: false });
  assert.ok(h.held("ctrl"));
  h.sync(UP);
  assert.deepEqual(log, ["ctrl+", "ctrl-"]);
});

test("the keyboard's Ctrl with a click: the key goes down and up, Ctrl stays as the keyboard holds it", () => {
  const { h, log } = rig();
  h.hostDown("ctrl");
  h.pointerDown("a");
  h.pointerUp("a");
  assert.deepEqual(log, ["ctrl+", "a+", "a-"]);
  h.hostUp("ctrl");
  assert.equal(log.at(-1), "ctrl-");
});

test("losing the focus lets go of the keyboard's keys", () => {
  const { h, log } = rig();
  h.hostDown("ctrl");
  h.hostDown("x");
  h.blur();
  assert.deepEqual(log, ["ctrl+", "x+", "ctrl-", "x-"]);
});

test(`a quick click on RESET is held at least ${RESET_HOLD_MS} ms`, () => {
  /** @type {Array<[() => void, number]>} */
  const queued = [];
  /** @type {string[]} */
  const log = [];
  const h = new KeyHolds((id, down) => log.push(`${id}${down ? "+" : "-"}`), { now: () => 0, later: (f, ms) => void queued.push([f, ms]) });
  h.pointerDown("reset");
  h.pointerUp("reset");
  assert.deepEqual(log, ["reset+"]);
  assert.equal(queued.length, 1);
  assert.ok(queued[0][1] >= RESET_HOLD_MS);
});
