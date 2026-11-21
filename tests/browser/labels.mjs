// SPDX-License-Identifier: Apache-2.0
//
// The labels of the parts under a resting mouse (U2): a key's shows; between the keys, the
// keyboard's plate and the lid's surround keep quiet, so that they are not in the way of the
// keys; the lid away from the keys still says what it is, after a longer rest.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.model() !== null", 30000);
  await h.js("app.stage.goTo('keyboard')");
  await h.until("!app.viewer.isFlying()", 5000);
  await h.sleep(500);
  /** Where a point of the model is on the page. @param {string} expr world point */
  const at = (/** @type {string} */ expr) =>
    h.js(`(() => { const v = app.viewer; const p = ${expr}; p.project(v.camera); const r = v.canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; })()`);
  const world = (/** @type {string} */ name) => `app.model().node("${name}").getWorldPosition(app.model().node("${name}").position.clone())`;
  /** The label shown after the mouse rests at a point, or "". @param {{ x: number, y: number }} p */
  const rest = async (p) => {
    await h.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x + 3, y: p.y + 2 });
    await h.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
    await h.sleep(1400);
    return h.js("(() => { const l = document.querySelector('.part-label'); return l && !l.hidden ? l.querySelector('strong').textContent : ''; })()");
  };
  const g = await at(world("key.g"));
  const hh = await at(world("key.h"));
  const gap = { x: (g.x + hh.x) / 2, y: (g.y + hh.y) / 2 };
  h.verify("between G and H: no label", (await rest(gap)) === "", await rest(gap));
  h.verify("on G: its label", /G/.test(await rest(g)));
  // a point on the lid well away from the keys: up the page from G, the first that is
  const lid = await h.js(`(() => { const m = app.model(); for (let y = ${g.y}; y > 0; y -= 6) { const hit = m.hit(${g.x}, y); if (hit && m.under(hit.object, "case.lid") && !m.amongKeys(${g.x}, y, hit)) return { x: ${g.x}, y }; } return null; })()`);
  const far = await rest(lid);
  h.verify("the lid away from the keys still says what it is", far !== "", JSON.stringify({ lid, far }));
}
