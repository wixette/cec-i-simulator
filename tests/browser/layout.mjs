// SPDX-License-Identifier: Apache-2.0
//
// The layout (P9): at every width the page fits the window without scrolling, the stage keeps
// its room, and a phone gets the same app: on a phone held upright, the 2D keyboard drawer
// opens at first, and the strip's names give way to their icons.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  for (const [w, ht, phone] of /** @type {[number, number, boolean][]} */ ([[1440, 900, false], [1024, 700, false], [390, 844, true], [844, 390, true]])) {
    await h.viewport(w, ht, phone);
    await h.open();
    await h.sleep(500);
    const fit = await h.js("document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1");
    const stage = await h.js("document.getElementById('stage-view').getBoundingClientRect().height");
    h.verify(`${w} x ${ht}: the page fits the window`, fit);
    // a phone on its side: the helper strip folded at first, the stage half the window
    h.verify(`${w} x ${ht}: the stage keeps its room`, stage >= Math.min(250, ht * 0.45), stage);
  }
  await h.viewport(390, 844, true);
  await h.open();
  h.verify("a phone upright: the keyboard drawer opens at first in 2D", await h.js("app.flat.drawerOpen"));
  h.verify("a phone: the strip shows icons alone", await h.js("getComputedStyle(document.querySelector('.strip-label')).display === 'none'"));
}
