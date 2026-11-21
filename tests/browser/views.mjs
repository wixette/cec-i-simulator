// SPDX-License-Identifier: Apache-2.0
//
// The 3D views (U2, U3): each view flies there; Taken apart is refused while the computer is
// on, and takes it apart once it is off; the computer will not start while apart; Put it all
// back; Inside turns the lid and the keyboard to glass.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.model() !== null", 30000);
  await h.press(".menu-btn:not(.display-btn)");
  await h.sleep(200);
  h.verify("the Views menu: Front, then Screen", (await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].slice(0, 2).map((b) => b.textContent).join(',')")) === "Front,Screen");
  await h.key("Escape");
  for (const v of ["angle", "keyboard", "screen", "back", "inside", "front"]) {
    await h.js(`app.stage.goTo("${v}")`);
    await h.until("!app.viewer.isFlying()", 5000);
    h.verify(`the ${v} view`, (await h.js("app.stage.view")) === v);
  }
  // a double-click on the TV's body or the computer's case brings it close
  const point = (/** @type {string} */ name, /** @type {number[]} */ off) =>
    h.js(`(() => { const v = app.viewer; const o = app.model().node("${name}"); const p = o.getWorldPosition(o.position.clone()).add(new (o.position.constructor)(${off.join(",")})); p.project(v.camera); const r = v.canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; })()`);
  await h.js(`app.stage.goTo("front")`);
  await h.until("!app.viewer.isFlying()", 5000);
  await h.sleep(300);
  const tvTop = await h.js(`(() => { const m = app.model(); const v = app.viewer; const r = v.canvas.getBoundingClientRect(); const s = ${JSON.stringify(await point("tv.screen", [0, 0, 0]))};
    for (let y = s.y; y > r.top; y -= 4) { const hit = m.hit(s.x, y); if (hit && m.under(hit.object, "tv") && !m.under(hit.object, "tv.screen") && !m.under(hit.object, "tv.screen_rim")) return { x: s.x, y: y - 6 }; } return null; })()`);
  await h.clickAt(tvTop.x, tvTop.y, 2);
  h.verify("a double-click on the TV's body: the Screen view", await h.until("app.stage.view === 'screen'", 3000), JSON.stringify(tvTop));
  await h.js(`app.stage.goTo("front")`);
  await h.until("!app.viewer.isFlying()", 5000);
  await h.sleep(300);
  const caseFront = await h.js(`(() => { const m = app.model(); const v = app.viewer; const r = v.canvas.getBoundingClientRect(); const k = ${JSON.stringify(await point("key.space", [0, 0, 0]))};
    for (let y = k.y; y < r.bottom; y += 3) { const hit = m.hit(k.x, y); if (hit && hit.object.name && m.up(hit.object, (x) => x.name.startsWith("case")) && !m.amongKeys(k.x, y, hit)) return { x: k.x, y: y + 4 }; } return null; })()`);
  await h.clickAt(caseFront.x, caseFront.y, 2);
  h.verify("a double-click on the computer's case: the Keyboard view", await h.until("app.stage.view === 'keyboard'", 3000), JSON.stringify(caseFront));
  // Display ▸ Reset the knobs
  await h.js("cec.setKnob('brightness', 0.2)");
  await h.choose(".display-btn", "Reset the knobs");
  h.verify("Display's Reset the knobs puts them back", await h.js("cec.knobsAtStart"), await h.status());
  await h.js(`app.stage.goTo("inside")`);
  h.verify("Inside: the lid and the keyboard are glass", await h.js("app.model().inside"));
  await h.choose(".menu-btn:not(.display-btn)", "Taken apart");
  h.verify("Taken apart is refused while the computer is on, and says why", (await h.js("cec.whole")) && /off/i.test(await h.status()), await h.status());
  await h.pressText("#helper-strip button", "Computer");
  await h.choose(".menu-btn:not(.display-btn)", "Taken apart");
  h.verify("with the computer off, Taken apart takes it all out", await h.until("[...cec.motion.values()].every((m) => m.f === 1)", 10000));
  h.verify("Put it all back stands on the stage", !(await h.js("document.querySelector('.put-back').hidden")));
  await h.pressText("#helper-strip button", "Computer");
  h.verify("the computer will not switch on while apart", !(await h.js("cec.machine.powered")) && /Put it all back/.test(await h.status()), await h.status());
  await h.press(".put-back");
  h.verify("Put it all back puts it back, and the view is the front", (await h.until("cec.whole", 8000)) && (await h.until("app.stage.view === 'front'", 3000)));
}
