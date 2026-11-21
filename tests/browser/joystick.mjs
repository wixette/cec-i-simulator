// SPDX-License-Identifier: Apache-2.0
//
// The joystick (design/v0.0.3.md, P2): plugged in from the helper strip; the arrows move the
// stick and are the machine's no more; Space presses button 0 and still types; unplugged, the
// arrows are the machine's again. On a phone, the pad over the stage plays it.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  h.verify("unplugged at first: the port reads 255", (await h.js("cec.machine.paddles[0]")) === 255);
  await h.pressText("#helper-strip button", "Joystick");
  h.verify("the strip's Joystick plugs it in, centred, and says how to play it", (await h.js("cec.joystick.on && cec.machine.paddles[0] === 128")) && /arrows move its stick/.test(await h.status()), await h.status());
  const arrow = (/** @type {string} */ type, /** @type {string} */ code) => h.send("Input.dispatchKeyEvent", { type, key: code, code, windowsVirtualKeyCode: 39 });
  await arrow("rawKeyDown", "ArrowRight");
  h.verify("holding → pushes the stick right", await h.until("cec.machine.paddles[0] === 255", 2000));
  h.verify("… and the machine does not see the arrow", !(await h.js("cec.keysDown().has('right')")));
  await arrow("keyUp", "ArrowRight");
  h.verify("let go, it springs back to the centre", await h.until("cec.machine.paddles[0] === 128", 2000));
  await h.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 });
  h.verify("Space holds button 0 down", await h.until("cec.machine.buttons[0]", 1000));
  await h.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  h.verify("… and still types a space", await h.until("cec.machine.screenText().some((l) => l.startsWith('] '))", 2000), await h.screen());
  await h.pressText("#helper-strip button", "Joystick");
  h.verify("unplugged again: 255, and the arrows are the machine's", (await h.js("!cec.joystick.on && cec.machine.paddles[0] === 255")));
  await h.viewport(390, 844, true);
  await h.open();
  await h.until("typeof cec === 'object'", 20000);
  h.verify("on a phone, no pad while unplugged", await h.js("document.querySelector('.joypad').hidden"));
  await h.js("cec.setJoystick(true)");
  h.verify("plugged in, the pad shows over the stage", await h.until("!document.querySelector('.joypad').hidden", 1000));
  const right = await h.js("(() => { const b = document.querySelector('.joypad-key.right').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()");
  await h.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: right.x, y: right.y, id: 1 }] });
  h.verify("a thumb on ▶ pushes the stick right", await h.until("cec.machine.paddles[0] === 255", 2000));
  await h.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  h.verify("lifted, it springs back", await h.until("cec.machine.paddles[0] === 128", 2000));
}
