// SPDX-License-Identifier: Apache-2.0
//
// The 2D view (U1, U10): the toggle, the keyboard drawer, a key clicked on it types on the
// machine, the TV's button and a knob, and the view remembered.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.pressText(".segmented.mode button", "2D");
  h.verify("2D | 3D goes to 2D", await h.until("app.stage.mode === '2d' && !document.getElementById('view2d').hidden", 5000));
  await h.press(".drawers .btn");
  h.verify("the Keyboard toggle opens the drawer", await h.until("app.flat.drawerOpen && !app.flat.computer.hidden", 2000));
  // a click on the drawn A key
  const key = await h.js(`(() => { const k = app.flat.keys.find((k) => k.id === "a"); const r = app.flat.kb.getBoundingClientRect();
    return { x: r.left + ((k.x + 184) * 2.6 / app.flat.KW) * r.width, y: r.top + ((152 - k.y) * 2.6 / app.flat.KH) * r.height }; })()`);
  await h.clickAt(key.x, key.y);
  h.verify("a click on the drawn A key types A", await h.until("cec.machine.screenText().some((l) => /^\\]A/.test(l))", 3000), await h.screen());
  await h.press(".flat-tv-button");
  h.verify("the drawn TV button switches the TV off", await h.until("!cec.tv.on", 2000));
  await h.press(".flat-tv-button");
  const k = await h.centre(".flat-knob");
  await h.drag(k, { x: k.x + 60, y: k.y - 60 });
  h.verify("a drag turns the brightness knob up", (await h.js("cec.tv.brightness")) > 0.6);
  await h.open({ keep: true });
  h.verify("2D and the drawer are remembered", (await h.js("app.stage.mode")) === "2d" && (await h.js("app.flat.drawerOpen")));
}
