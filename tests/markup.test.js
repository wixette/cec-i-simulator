// SPDX-License-Identifier: Apache-2.0
//
// The marks a message may carry (js/app/markup.js): `code`, **bold** and [[keys]].

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markup, parts } from "../js/app/markup.js";

describe("a message's marks", () => {
  it("a lesson's text: escaped first, so the machine's < and & show as typed; then `code` and **bold**", () => {
    assert.equal(markup("Type `PRINT 2<3` and **Enter**"), "Type <code>PRINT 2&lt;3</code> and <strong>Enter</strong>");
    assert.equal(markup("A & B <i>"), "A &amp; B &lt;i&gt;");
  });
  it("References' text in parts: plain, `code`, [[keys]], in order", () => {
    assert.deepEqual(parts("Press [[Ctrl]]-[[F12]] for `]`."), [
      { kind: "text", text: "Press " },
      { kind: "key", text: "Ctrl" },
      { kind: "text", text: "-" },
      { kind: "key", text: "F12" },
      { kind: "text", text: " for " },
      { kind: "code", text: "]" },
      { kind: "text", text: "." },
    ]);
    assert.deepEqual(parts("plain"), [{ kind: "text", text: "plain" }]);
  });
});
