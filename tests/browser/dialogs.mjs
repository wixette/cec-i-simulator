// SPDX-License-Identifier: Apache-2.0
//
// The menus and dialogs (P10, U8, U9): About opens with the version and closes on Escape;
// References opens the tab; Display chooses the set, remembered; the dock folds and opens.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./harness.mjs";

const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.press("#about");
  h.verify("About opens with the version", await h.until(`(document.querySelector("dialog[open] .version")?.textContent ?? "").includes(${JSON.stringify(VERSION)})`, 3000));
  await h.key("Escape");
  h.verify("Escape closes it", await h.until("!document.querySelector('dialog[open]')", 1000));
  await h.press("#about");
  await h.pressText("dialog[open] .dialog-actions button", "References");
  h.verify("About's References opens the References tab", await h.until("app.dock.current === 'refs'", 1000));
  await h.choose("#display", "A green monitor");
  h.verify("Display ▸ A green monitor: the picture in green", (await h.js("cec.video.display")) === "green");
  await h.open({ keep: true });
  h.verify("the set is remembered", (await h.js("cec.video.display")) === "green");
  h.verify("the case is as new at first", await h.js("app.model()?.finishMats.every(([m, nu]) => m.color.equals(nu))"));
  await h.choose("#display", "As found");
  h.verify("As found is said", /yellowed/.test(await h.status()), await h.status());
  await h.choose("#display", "As new");
  h.verify("As new is said", /off-white/.test(await h.status()), await h.status());
  await h.press("#dock-fold");
  h.verify("the dock folds", await h.js("app.dock.folded"));
  await h.press("#tab-refs");
  h.verify("a tab opens it again", !(await h.js("app.dock.folded")));
}
