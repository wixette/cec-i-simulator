// SPDX-License-Identifier: Apache-2.0
//
// The program in memory as text (js/sim/basic.js): CEC-BASIC's keywords from its own ROM, and
// a listing typed in, saved and typed in again giving the same program.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineText, listProgram, tokenNames, TOKEN_COUNT } from "../js/sim/basic.js";
import { planTyping } from "../js/sim/chinese.js";
import { ROMS, session } from "./boot.js";

const names = tokenNames(ROMS.u7);

describe("CEC-BASIC's keywords", () => {
  it(`${TOKEN_COUNT}: Applesoft's, then MUSIC, PLAY, LG and GAME`, () => {
    assert.equal(names.length, TOKEN_COUNT);
    assert.deepEqual(names.slice(0, 3), ["END", "FOR", "NEXT"]);
    assert.equal(names[0xba - 0x80], "PRINT");
    assert.deepEqual(names.slice(-4), ["MUSIC", "PLAY", "LG", "GAME"]);
  });
  it("a line as LIST shows it: a space round each keyword, none added after REM or DATA", () => {
    assert.equal(lineText([0x81, 0x49, 0xd0, 0x31, 0xc1, 0x31, 0x30], names), "FOR I = 1 TO 10");
    assert.equal(lineText([0xb2, 0x48, 0x49], names), "REMHI");
    assert.equal(lineText([0xba, 0x22, 127, 85, 79, 0x22], names), 'PRINT "中"');
  });
});

describe("saving the program in memory", () => {
  const program = '10 REM 你好，世界\n20 A$ = "中华学习机": PRINT A$\n30 DATA 1,2, 汉字\n40 FOR I = 1 TO 10: PRINT I;: NEXT\n50 REMHELLO\n60 MUSIC 192,110\n';

  it("typed in (Chinese by 区位), listed back as the same text", () => {
    const s = session();
    s.type(`{zhongwen}{wait:2}${planTyping(program).keys}`, 2);
    assert.equal(listProgram(s.m, names), program);
  });

  it("no program: nothing", () => {
    const s = session();
    assert.equal(listProgram(s.m, names), "");
  });

  it("typed in again from its own listing, the same bytes in memory", () => {
    const s = session();
    s.type("10 FORI=1TO3:PRINTI*2:NEXT\n", 1);
    const first = listProgram(s.m, names);
    // the program's lines, up to the link of 0 that ends them
    const bytes = () => {
      const r = s.m.ram;
      let at = r[0x67] | (r[0x68] << 8);
      const start = at;
      while (r[at] | r[at + 1]) at = r[at] | (r[at + 1] << 8);
      return [...r.subarray(start, at + 2)];
    };
    const before = bytes();
    s.type(`NEW\n${first}`, 1);
    assert.deepEqual(bytes(), before);
    assert.equal(listProgram(s.m, names), first);
  });
});
