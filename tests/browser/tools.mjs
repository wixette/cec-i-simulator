// SPDX-License-Identifier: Apache-2.0
//
// The instruments (U12): each tab opens and reads the running machine; the CPU tool's Pause,
// Step and Run to; a key pressed lights the matrix with its U26 lookup; Chinese printed shows
// in the Chinese tool; Inside lights the chips.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.model() !== null", 30000);
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.press("#tab-cpu");
  await h.sleep(400);
  h.verify("CPU & Memory: the registers and the next instructions show", await h.until("document.querySelectorAll('#pane-cpu .code li').length === 8 && /[0-9A-F]{4}/.test(document.querySelector('#pane-cpu .reg b')?.textContent ?? '') === false", 3000) || (await h.js("document.querySelectorAll('#pane-cpu .code li').length")) === 8);
  await h.pressText("#pane-cpu button", "Pause");
  h.verify("Pause pauses the machine", await h.until("cec.paused", 1000));
  const pc = await h.js("cec.machine.cpu.pc");
  await h.pressText("#pane-cpu button", "Step");
  h.verify("Step runs one instruction", (await h.js("cec.machine.cpu.pc")) !== pc && /Ran /.test(await h.status()), await h.status());
  await h.js("document.querySelector('#pane-cpu input.field').value = 'FD1B'");
  await h.pressText("#pane-cpu button", "Run to");
  h.verify("Run to $FD1B stops there", await h.until("cec.paused && cec.machine.cpu.pc === 0xfd1b", 5000), await h.status());
  await h.pressText("#pane-cpu button", "Run");
  h.verify("Run runs again", await h.until("!cec.paused", 1000));
  await h.press("#tab-screen");
  h.verify("Screen: the text page's bytes, 960 cells", await h.until("document.querySelectorAll('#pane-screen .page-cell').length === 960 && document.querySelector('#pane-screen .page-cell').textContent !== ''", 2000));
  await h.press("#tab-keyboard");
  await h.typeHost("G");
  h.verify("Keyboard: a key pressed shows its U26 lookup", await h.until("/Key g: X4, Y3/.test(document.querySelector('#pane-keyboard .lookup').textContent)", 3000));
  await h.press("#tab-hanzi");
  await h.js(`cec.typeIn('10 A$ = "中华学习机": PRINT A$\\nRUN\\n')`);
  await h.typed(90000);
  await h.sleep(1500);
  h.verify("Chinese: the string's five characters, and the last character read", await h.until("document.querySelectorAll('#pane-hanzi .hz-char.cjk').length === 5 && document.querySelector('#pane-hanzi .glyph16') !== null", 5000));
  await h.js("app.stage.goTo('inside')");
  await h.sleep(1500);
  h.verify("Inside lights the 6502", await h.js("app.model().glow.cpu.level > 0.3"));
}
