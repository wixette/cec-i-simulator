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
  for (const v of ["angle", "keyboard", "screen", "back", "inside", "front"]) {
    await h.js(`app.stage.goTo("${v}")`);
    await h.until("!app.viewer.isFlying()", 5000);
    h.verify(`the ${v} view`, (await h.js("app.stage.view")) === v);
  }
  await h.js(`app.stage.goTo("inside")`);
  h.verify("Inside: the lid and the keyboard are glass", await h.js("app.model().inside"));
  await h.choose(".menu-btn", "Taken apart");
  h.verify("Taken apart is refused while the computer is on, and says why", (await h.js("cec.whole")) && /off/i.test(await h.status()), await h.status());
  await h.pressText("#helper-strip button", "Computer");
  await h.choose(".menu-btn", "Taken apart");
  h.verify("with the computer off, Taken apart takes it all out", await h.until("[...cec.motion.values()].every((m) => m.f === 1)", 10000));
  h.verify("Put it all back stands on the stage", !(await h.js("document.querySelector('.put-back').hidden")));
  await h.pressText("#helper-strip button", "Computer");
  h.verify("the computer will not switch on while apart", !(await h.js("cec.machine.powered")) && /Put it all back/.test(await h.status()), await h.status());
  await h.press(".put-back");
  h.verify("Put it all back puts it back, and the view is the front", (await h.until("cec.whole", 8000)) && (await h.until("app.stage.view === 'front'", 3000)));
}
