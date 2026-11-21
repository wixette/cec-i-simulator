// SPDX-License-Identifier: Apache-2.0
//
// Chinese text (js/sim/chinese.js): GB2312's 区位 codes, the internal code in a BASIC string
// (as a real machine shows it), and how a text is typed on the machine's keys.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { byteNumber, codeByte, decodeBytes, fromQuwei, internalCode, planTyping, quwei } from "../js/sim/chinese.js";

describe("GB2312", () => {
  it("区位 codes: 啊 1601, 中 5448, 华 2710, the full-width comma 0312", () => {
    assert.deepEqual(["啊", "中", "华", "，"].map(quwei), [1601, 5448, 2710, 312]);
    assert.equal(fromQuwei(5448), "中");
  });
  it("has 7,445 characters, and none outside it", () => {
    let n = 0;
    for (let r = 1; r <= 94; r++) for (let p = 1; p <= 94; p++) if (fromQuwei(r * 100 + p)) n++;
    assert.equal(n, 7445);
    assert.equal(quwei("𠀀"), null);
    assert.equal(quwei("︵"), null, "GB18030's additions to GB2312's empty places are not GB2312's");
    assert.equal(quwei("A"), null);
  });
});

describe("the internal code", () => {
  it("n + 28, skipping \", , and :", () => {
    assert.deepEqual([1, 5, 6, 15, 16, 28, 29, 94].map(codeByte), [29, 33, 35, 45, 46, 59, 60, 125]);
    for (let n = 1; n <= 94; n++) {
      assert.ok(![34, 44, 58].includes(codeByte(n)));
      assert.equal(byteNumber(codeByte(n)), n);
    }
  });
  it("中华学习机 as a real machine stores it", () => {
    assert.deepEqual([..."中华学习机"].flatMap((c) => internalCode(c) ?? []), [127, 85, 79, 127, 57, 39, 127, 80, 36, 127, 78, 46, 127, 57, 121]);
  });
  it("bytes back to text: Chinese where 127 leads two code bytes, ASCII otherwise", () => {
    assert.equal(decodeBytes([65, 127, 85, 79, 66]), "A中B");
    assert.equal(decodeBytes([127, 65]), "\u007fA", "a 127 without two code bytes stays");
  });
});

describe("typing a text", () => {
  it("ASCII as it is; Chinese runs as F3, four digits each, F1", () => {
    assert.deepEqual(planTyping('10 A$="中华"\n'), { keys: '10 A$="{f3}54482710{f1}"\n', chinese: true, refused: [] });
    assert.deepEqual(planTyping("PRINT 1\r\n"), { keys: "PRINT 1\n", chinese: false, refused: [] });
  });
  it("braces are typed as keys, not read as the typist's own names", () => {
    assert.equal(planTyping("{f3}").keys, "{lbrace}f3}");
  });
  it("refuses what the machine cannot type, each character once", () => {
    assert.deepEqual(planTyping("€😀€é").refused, ["€", "😀"], "é is in GB2312's pinyin row");
  });
});
