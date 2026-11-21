// SPDX-License-Identifier: Apache-2.0
//
// The 3D model (model/cec-i.glb): every node the page uses is there, its keys are the
// keyboard's (model/params/keyboard.json) and each is in the keyboard ROM's matrix, the parts
// that move carry what the page needs to move them, the take-apart order is sound, nothing of
// it is lost in a rebuild, and it keeps to its size. After `pnpm build:model`, these say
// whether the rebuilt model still fits the page.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { NO_CODE } from "../js/sim/keyboard.js";
import { nodesByName, readGlb } from "./glb.js";
import { MATRIX } from "./boot.js";

const GLB = new URL("../model/cec-i.glb", import.meta.url);
const glb = readGlb(GLB);
const nodes = nodesByName(glb);
/** @type {{ keys: { id: string, node: string }[] }} */
const KEYBOARD = JSON.parse(readFileSync(new URL("../model/params/keyboard.json", import.meta.url), "utf8"));
const MACHINE = JSON.parse(readFileSync(new URL("../model/params/machine.json", import.meta.url), "utf8"));

describe("the model", () => {
  it("every node js/scene/ asks for by name is there", () => {
    const dir = new URL("../js/scene/", import.meta.url);
    const asked = readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .flatMap((f) => [...readFileSync(new URL(f, dir), "utf8").matchAll(/node\("([a-z0-9_.]+)"\)/g)].map((m) => m[1]));
    const listed = ["tv", "tv.screen", "tv.screen_rim", "tv.power", "tv.knob.brightness", "tv.knob.colour", "tv.lamp", "case.lid", "keyboard", "board.main", "case.base"];
    assert.ok(asked.length >= 8, `${asked.length} names found`);
    assert.deepEqual([...asked, ...listed].filter((n) => !nodes.has(n)), []);
  });

  it("the stage's views frame parts the model has", () => {
    const stage = readFileSync(new URL("../js/app/stage.js", import.meta.url), "utf8");
    const named = [...stage.matchAll(/nodes: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([a-z.]+)"/g)].map((x) => x[1]));
    assert.ok(named.length >= 7);
    assert.deepEqual(named.filter((n) => !nodes.has(n)), []);
  });

  it("69 keys, each a node with its key_id and travel; every key but the modifiers is in the matrix", () => {
    assert.equal(KEYBOARD.keys.length, 69);
    for (const k of KEYBOARD.keys) {
      const n = nodes.get(k.node);
      assert.ok(n, `${k.node} is in the .glb`);
      assert.equal(n.node.extras?.key_id, k.id, k.node);
      assert.ok(Number(n.node.extras?.travel) > 0, `${k.node} travels`);
      assert.ok(NO_CODE.has(k.id) || k.id in MATRIX, `${k.id} is in the matrix`);
    }
    assert.equal(nodes.get("key.capslock")?.node.extras?.latching, true);
  });

  it("what moves carries its motion: the units' paths, the switch's turn, the knobs, the flap", () => {
    for (const n of ["case.lid", "board.main"]) assert.ok(Array.isArray(nodes.get(n)?.node.extras?.path), `${n} has a path`);
    assert.ok(Number(nodes.get("switch.power")?.node.extras?.on_deg) > 0);
    assert.equal(nodes.get("tv.knob.brightness")?.node.extras?.knob, "brightness");
    assert.equal(nodes.get("tv.knob.colour")?.node.extras?.knob, "colour");
    assert.ok(Number(nodes.get("case.flap")?.node.extras?.max_deg) > 0);
    assert.ok(Array.isArray(nodes.get("cable.ribbon")?.node.extras?.ribbon_rest));
  });

  it("every labelled part has its label in English and in Chinese, and none is a private note", () => {
    let n = 0;
    for (const [name, { node }] of nodes) {
      const ex = node.extras ?? {};
      if (!ex.label_en) continue;
      n++;
      assert.ok(ex.label_zh, `${name} has a Chinese label`);
      assert.doesNotMatch(String(ex.label_en), /owner|review \d/i, name);
    }
    assert.ok(n > 150, `${n} labelled parts`);
  });

  it("the take-apart order: each unit after what it requires, and the model has each", () => {
    /** @type {{ unit: string, requires: string[] }[]} */
    const order = MACHINE.take_apart.order;
    assert.deepEqual(order.map((s) => s.unit), ["case.lid", "keyboard", "board.main"]);
    order.forEach((s, i) => {
      assert.ok(nodes.has(s.unit), s.unit);
      for (const r of s.requires) assert.ok(order.findIndex((x) => x.unit === r) < i, `${r} before ${s.unit}`);
    });
  });

  it("the case's colours as new and as found, for every finish material", () => {
    for (const m of ["case_plastic", "key_tan", "flap_grey", "foot_white"]) {
      assert.ok(Array.isArray(MACHINE.colours[m].v) && MACHINE.colours[m].v.length === 2, m);
      assert.ok(glb.materials?.some((x) => x.name === m), `${m} is a material of the model`);
    }
  });

  it("the 2D view's case and keys, as new and as found, as the 3D view renders them (flat_case, flat_key)", () => {
    for (const m of ["flat_case", "flat_key"]) {
      const v = MACHINE.colours[m].v;
      assert.ok(Array.isArray(v) && v.length === 2 && v.every((c) => /^#[0-9A-F]{6}$/i.test(c)), m);
      // as found yellower than as new: more red than blue
      const ch = (/** @type {string} */ h, /** @type {number} */ i) => parseInt(h.slice(i, i + 2), 16);
      assert.ok(ch(v[1], 1) - ch(v[1], 5) > ch(v[0], 1) - ch(v[0], 5), `${m}: as found is yellower`);
    }
  });

  it("the model stays under 8 MB", () => {
    assert.ok(statSync(GLB).size < 8 * 1024 * 1024, `${statSync(GLB).size} bytes`);
  });
});
