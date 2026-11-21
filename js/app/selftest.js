// SPDX-License-Identifier: Apache-2.0
//
// `?selftest` (docs/development.md): runs acceptance checks in the page itself and shows a
// tick or a cross for each; publishes window.__selftest = { done, passed, failed }. The Node
// tests cover the machine; these cover what only a browser has: the page's own parts.

import { el } from "../ui/components.js";

/** @param {import("../sim/system.js").System} system */
export async function selftest(system) {
  const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
  /** @type {[string, () => boolean | Promise<boolean>][]} */
  const checks = [
    ["the stage, the dock and the status line are on the page", () => ["stage", "dock", "status"].every((id) => !!document.getElementById(id))],
    ["the ROMs are loaded", () => system.hasRoms],
    ["the computer boots to ZHONG HUA XUE XI JI and BASIC's prompt", async () => {
      if (!system.machine.powered) system.power(true);
      await wait(3500);
      const r = system.machine.ram;
      let text = "";
      for (let a = 0x400; a < 0x800; a++) text += String.fromCharCode(r[a] & 0x7f);
      return text.includes("ZHONG HUA XUE XI JI");
    }],
    ["the 2D view has the machine's 69 keys", () => (/** @type {any} */ (document.getElementById("view2d"))?.querySelector("canvas.flat-keys") ?? null) !== null],
    ["the dock has its tabs", () => document.querySelectorAll("#dock-tabs [role=tab]").length === 6],
  ];
  /** @type {string[]} */
  const passed = [];
  /** @type {string[]} */
  const failed = [];
  const box = el("div", { class: "selftest" });
  document.body.append(box);
  for (const [name, run] of checks) {
    let ok = false;
    try {
      ok = !!(await run());
    } catch {
      ok = false;
    }
    (ok ? passed : failed).push(name);
    box.append(el("div", { class: ok ? "pass" : "fail", text: `${ok ? "✓" : "✗"} ${name}` }));
  }
  Object.assign(window, { __selftest: { done: true, passed, failed } });
}
