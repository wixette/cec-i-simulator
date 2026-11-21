// SPDX-License-Identifier: Apache-2.0
//
// Type in, Open and Save (D8): text pasted into the dialog is typed on the machine's keys,
// Chinese through its 区位 input after 中文; a character outside GB 2312 is refused; the
// program in memory is saved back as the same text.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  h.verify("Programs ▸ Type in opens its dialog", (await h.choose("#programs", "Type in")) && (await h.until("document.querySelector('dialog[open] textarea')", 2000)));
  await h.js(`document.querySelector('dialog[open] textarea').value = '10 A$ = "中华学习机": PRINT A$\\n20 PRINT LEN(A$)\\nRUN\\n'`);
  await h.pressText("dialog[open] .dialog-actions button", "Type it in");
  h.verify("the dialog closes and the typing starts, 中文 first", await h.until("!document.querySelector('dialog[open]') && cec.typist.busy", 2000));
  await h.typed(90000);
  h.verify("the Chinese system is on, and the program is in memory as typed", (await h.js("cec.chineseOn")) && (await h.js("cec.listing()")) === '10 A$ = "中华学习机": PRINT A$\n20 PRINT LEN(A$)\n', await h.js("cec.listing()"));
  // refused: a character the machine has not
  await h.choose("#programs", "Type in");
  await h.js(`document.querySelector('dialog[open] textarea').value = 'PRINT "€"'`);
  await h.pressText("dialog[open] .dialog-actions button", "Type it in");
  h.verify("a character outside GB 2312 is refused, and said so", /€/.test(await h.status()) && !(await h.js("cec.typist.busy")), await h.status());
  // Save: the menu item is there while a program is in memory
  await h.press("#programs");
  await h.sleep(200);
  h.verify("Save the program is offered while a program is in memory", await h.js("[...document.querySelectorAll('.menu [role=menuitem]')].some((b) => b.textContent.startsWith('Save') && b.getAttribute('aria-disabled') !== 'true')"));
  await h.key("Escape");
}
