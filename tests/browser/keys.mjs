// SPDX-License-Identifier: Apache-2.0
//
// The visitor's keyboard as the machine's (U5, D7): the CEC's own keys on spare keys and with
// Alt, Ctrl-F12 as Ctrl-Reset, Caps Lock, and the keys a click on the 3D view leaves to the
// machine.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.model() !== null", 30000);
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.keyCode("PageUp");
  h.verify("Page Up is 中文: the Chinese system starts", await h.until("cec.chineseOn", 8000));
  await h.keyCode("PageDown");
  h.verify("Page Down is 西文: back to Western BASIC", await h.until("!cec.chineseOn && cec.machine.text", 8000));
  await h.keyCode("KeyZ", 1);
  h.verify("Alt-Z is 中文 too", await h.until("cec.chineseOn", 8000));
  await h.keyCode("KeyX", 1);
  await h.until("!cec.chineseOn", 8000);
  h.verify("no key is left held after Alt-Z and Alt-X", await h.until("cec.keysDown().size === 0", 2000), await h.js("[...cec.keysDown()]"));
  await h.typeHost('10 PRINT "KEPT"\n10 GOTO 10\nRUN\n');
  await h.sleep(800);
  await h.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Control", code: "ControlLeft", modifiers: 2 });
  await h.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "F12", code: "F12", modifiers: 2 });
  await h.sleep(300);
  h.verify("Ctrl-F12 holds the RESET line", await h.js("cec.machine.resetLow"));
  await h.send("Input.dispatchKeyEvent", { type: "keyUp", key: "F12", code: "F12", modifiers: 2 });
  await h.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft" });
  h.verify("and let go, the reset runs: back at the prompt, the program kept", await h.until("!cec.machine.resetLow && /^\\]/.test(cec.machine.screenText().filter((l) => l.trim()).at(-1)) && cec.listing().includes('GOTO')", 5000), await h.screen());
  // Ctrl with a letter is the machine's, Ctrl-V included (D7): its code, 22, in the keyboard's latch
  await h.js("cec.machine.strobe = false");
  await h.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Control", code: "ControlLeft", modifiers: 2 });
  await h.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "v", code: "KeyV", modifiers: 2 });
  const latch = await h.js("cec.machine.kbd");
  await h.send("Input.dispatchKeyEvent", { type: "keyUp", key: "v", code: "KeyV", modifiers: 2 });
  await h.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft" });
  h.verify("Ctrl-V reaches the machine as its own Ctrl-V (22)", latch === 22, latch);
  await h.keyCode("Enter");
  const caps = await h.js("cec.keyboard.caps");
  await h.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "CapsLock", code: "CapsLock", modifiers: 0 });
  await h.send("Input.dispatchKeyEvent", { type: "keyUp", key: "CapsLock", code: "CapsLock", modifiers: 0 });
  await h.sleep(200);
  h.verify("Caps Lock toggles the machine's", (await h.js("cec.keyboard.caps")) === !caps);
  // a click on the 3D view leaves the keys to the machine: on its background, near a corner,
  // not on a part (its centre can be a key, TEST among them, as the camera frames it)
  const r = await h.js("(() => { const b = document.querySelector('#view3d canvas').getBoundingClientRect(); return { x: b.left + 24, y: b.top + 24 }; })()");
  await h.clickAt(r.x, r.y);
  await h.typeHost("PRINT 7*6\n");
  h.verify("after a click on the 3D view, the keys still type on the machine", await h.until("cec.machine.screenText().some((l) => l.trim() === '42')", 8000), await h.screen());
}
