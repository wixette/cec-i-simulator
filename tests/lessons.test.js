// SPDX-License-Identifier: Apache-2.0
//
// The lessons (js/lessons/lessons.js, design/v0.0.4.md): each run end to end on a headless
// machine, as a student would, a step at a time: Type it, the student's own part, then the
// step's check, which must tick. And their words and photographs are all there.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import enTable from "../js/l10n/en.js";
import zhTable from "../js/l10n/zh.js";
import { LESSONS } from "../js/lessons/lessons.js";
import { SAMPLES } from "../js/sim/samples.js";
import { System } from "../js/sim/system.js";
import { MATRIX, ROMS } from "./boot.js";

/** The two languages' messages. */
const en = /** @type {Record<string, string>} */ (enTable);
const zh = /** @type {Record<string, string>} */ (zhTable);

const ORDER = [
  { unit: "case.lid", requires: [] },
  { unit: "keyboard", requires: ["case.lid"] },
  { unit: "board.main", requires: ["keyboard"] },
];

describe("the lessons", () => {
  it("six, short: four to six steps each, every one ending with a program to play, every step able to tick", () => {
    assert.equal(LESSONS.length, 6);
    for (const l of LESSONS) {
      assert.ok(l.steps.length >= 4 && l.steps.length <= 6, l.id);
      assert.ok(l.steps.at(-1)?.program, `${l.id} ends with a program`);
      for (const st of l.steps) {
        assert.ok(st.done || st.show, `${l.id}.${st.id} can tick`);
        if (st.program) assert.ok(st.done, `${l.id}.${st.id}: its program ticks it`);
      }
    }
  });
  it("every word in both languages, every program and photograph there", () => {
    for (const l of LESSONS) {
      for (const k of [`lesson.${l.id}.title`, `lesson.${l.id}.lead`]) assert.ok(en[k] && zh[k], k);
      for (const st of l.steps) {
        const keys = [`lesson.${l.id}.${st.id}.title`, `lesson.${l.id}.${st.id}.text`, ...(st.more ? [`lesson.${l.id}.${st.id}.more`] : [])];
        for (const k of keys) assert.ok(en[k] && zh[k], k);
        if (st.program) assert.ok(SAMPLES.some((x) => x.id === st.program), st.program);
        if (st.photo) assert.ok(existsSync(new URL(`../images/photos/${st.photo}`, import.meta.url)) && existsSync(new URL(`../images/photos/web/${st.photo}`, import.meta.url)), `${st.photo} and its web copy`);
      }
    }
  });
  for (const lesson of LESSONS) {
    it(`${lesson.id}: each step done as a student would do it ticks`, () => {
      const s = new System({ roms: ROMS, matrix: MATRIX, takeApart: ORDER });
      s.frameBudgetMs = Infinity;
      s.say = () => {};
      let now = 0;
      const run = (/** @type {number} */ sec) => {
        for (let i = 0; i < sec * 50; i++) s.frame(0.02, (now += 20));
      };
      s.power(true);
      run(3);
      for (const st of lesson.steps) {
        if (st.fresh) s.typeFresh();
        if (st.type !== undefined) s.type(st.type);
        if (st.text !== undefined) s.typeIn(st.text);
        // a step's program, opened and typed in as Open does
        if (st.program && st.type === undefined && st.text === undefined) s.typeProgram(/** @type {import("../js/sim/samples.js").Sample} */ (SAMPLES.find((x) => x.id === st.program)), "");
        for (let g = 0; s.typist.busy && g < 3000; g++) run(0.1);
        run(1);
        if (st.act) {
          st.act(s);
          run(1);
          for (let g = 0; s.typist.busy && g < 3000; g++) run(0.1);
        }
        if (!st.done) continue;
        for (let g = 0; g < 50 && !st.done(s); g++) run(0.2);
        assert.ok(st.done(s), `${lesson.id}.${st.id} ticks`);
      }
    });
  }
});
