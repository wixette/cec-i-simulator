// SPDX-License-Identifier: Apache-2.0
//
// Our programs (design/v0.0.3.md, P1): Programs lists them by section; a program's dialog says
// what it does and the mode it runs in, shows its listing, and Type it in gets the machine there
// and types it, from whatever it was doing; it runs.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.js("cec.type('10 GOTO 10\\nRUN\\n')");
  await h.typed(10000);
  await h.choose("#programs", "Learn ▸ Guess my number");
  h.verify("the program's dialog: what it does, its mode, its listing", await h.until("[...document.querySelectorAll('dialog[open] .dialog-text')].some((p) => /Western BASIC/.test(p.textContent)) && /RND\\(1\\)/.test(document.querySelector('dialog[open] .program-listing')?.textContent ?? '')", 2000));
  await h.pressText("dialog[open] .dialog-actions button", "Type it in");
  h.verify("Type it in: said, and typed from the program that was running", /Typing Guess my number in/.test(await h.status()), await h.status());
  await h.typed(60000);
  h.verify("it runs: the computer asks for a guess", await h.until("cec.machine.screenText().some((l) => /^YOUR GUESS\\?/.test(l))", 10000), await h.screen());
  await h.choose("#programs", "Games");
  h.verify("each section lists its programs", await h.until("[...document.querySelectorAll('.menu [role^=\"menuitem\"]')].some((b) => /Mine hunt/.test(b.textContent))", 2000));
  await h.key("Escape");
}
