// SPDX-License-Identifier: Apache-2.0
//
// The 2D view (U1, U10): the toggle, the keyboard drawer (open at first), a key clicked on it types on the
// machine, the TV's button and a knob, and the view remembered.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.pressText(".segmented.mode button", "2D");
  h.verify("2D | 3D goes to 2D", await h.until("app.stage.mode === '2d' && !document.getElementById('view2d').hidden", 5000));
  h.verify("the keyboard's drawer is open at first", await h.until("app.flat.drawerOpen && !app.flat.computer.hidden", 2000));
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
  // on a green monitor the colour knob turns, and the picture stays the same (D6)
  await h.choose("#display", "A green monitor");
  await h.sleep(300);
  const pixel = "(() => { const c = app.flat.screen.getContext('2d').getImageData(600, 450, 1, 1).data; return [...c].join(); })()";
  const before = await h.js(pixel);
  const knobs = await h.js("[...document.querySelectorAll('.flat-knob')].map((k) => { const b = k.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })");
  await h.drag(knobs[1], { x: knobs[1].x - 80, y: knobs[1].y + 80 });
  await h.sleep(300);
  h.verify("on a green monitor, the colour knob turns but the picture stays, and says why", (await h.js("cec.tv.colour")) < 0.5 && (await h.js(pixel)) === before && /no colour/.test(await h.status()), [before, await h.js(pixel), await h.status()]);
  await h.choose("#display", "A colour TV");
  // the finish chosen with the drawer closed opens it: the change is seen
  await h.press(".drawers .btn");
  await h.until("!app.flat.drawerOpen", 1000);
  await h.choose("#display", "As found");
  h.verify("As found with the drawer closed opens it", await h.until("app.flat.drawerOpen", 1000));
  await h.open({ keep: true });
  h.verify("2D and the drawer are remembered", (await h.js("app.stage.mode")) === "2d" && (await h.js("app.flat.drawerOpen")));
}
