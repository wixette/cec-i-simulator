// SPDX-License-Identifier: Apache-2.0
//
// The visitor's keyboard as the CEC-I's (js/sim/host-keys.js, design/decisions.md, D7): every
// key of the machine can be reached, and each mapping leads to a key the machine has.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { hostKeyId } from "../js/sim/host-keys.js";
import { MATRIX } from "./boot.js";

/** @param {string} code @param {{ alt?: boolean, meta?: boolean }} [o] */
const id = (code, o = {}) => hostKeyId({ code, altKey: !!o.alt, metaKey: !!o.meta });
const KEYS = JSON.parse(readFileSync(new URL("../model/params/keyboard.json", import.meta.url), "utf8")).keys.map((/** @type {{ id: string }} */ k) => k.id);

describe("the visitor's keyboard", () => {
  it("letters, digits and signs where they are", () => {
    assert.deepEqual([id("KeyA"), id("Digit7"), id("Semicolon"), id("Backquote"), id("Enter")], ["a", "7", "semicolon", "grave", "return"]);
  });
  it("the CEC's own keys on spare keys, and the same with Alt", () => {
    assert.deepEqual([id("PageUp"), id("PageDown"), id("End"), id("F12"), id("F6"), id("F3"), id("Backspace")], ["zhongwen", "xiwen", "test", "reset", "quit", "f3", "left"]);
    assert.deepEqual([id("KeyZ", { alt: true }), id("KeyX", { alt: true }), id("KeyT", { alt: true }), id("KeyR", { alt: true }), id("KeyQ", { alt: true }), id("Digit2", { alt: true })], ["zhongwen", "xiwen", "test", "reset", "quit", "f2"]);
  });
  it("⌘ combinations, and Alt with other keys, are the browser's", () => {
    assert.equal(id("KeyC", { meta: true }), null);
    assert.equal(id("KeyA", { alt: true }), null);
    assert.equal(id("F11"), null);
  });
  it("every key of the machine can be reached, and every mapping is a key of the machine", () => {
    const codes = ["Escape", "Backquote", "Minus", "Equal", "Backslash", "Tab", "BracketLeft", "BracketRight", "Enter", "ControlLeft", "Semicolon", "Quote", "ShiftLeft", "ShiftRight", "Comma", "Period", "Slash", "CapsLock", "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "F1", "F2", "F3", "F4", "F5", "F6", "PageUp", "PageDown", "End", "F12"];
    for (let i = 0; i < 26; i++) codes.push(`Key${String.fromCharCode(65 + i)}`);
    for (let i = 0; i < 10; i++) codes.push(`Digit${i}`);
    const reached = new Set(codes.map((c) => id(c)));
    for (const k of KEYS) assert.ok(reached.has(k), `${k} cannot be reached`);
    for (const r of reached) assert.ok(r && KEYS.includes(r), `${r} is not a key of the machine`);
    for (const k of KEYS) if (!["reset", "ctrl", "lshift", "rshift", "capslock"].includes(k)) assert.ok(k in MATRIX, `${k} is in the matrix`);
  });
});
