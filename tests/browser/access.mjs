// SPDX-License-Identifier: Apache-2.0
//
// The page without a mouse, and what a mouse must not do (design/v1.0.0.md, task 7; review
// C1): the dock's tabs by the arrows, Home and End; its handle by the arrows, and dragged; a
// submenu on a phone taking its menu's place, with a row going back; every strip button and
// compact lesson tab keeping its name when a narrow window hides its words; in a dialog, the
// words selectable but never its buttons; nothing of the page dragged off.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  // the dock's tabs: the arrows move and choose, Home and End go to the ends
  await h.js("document.getElementById('tab-cpu').focus()");
  await h.keyCode("ArrowRight");
  h.verify("the dock's tabs: → goes to the next tab and shows it", (await h.js("app.dock.current")) === "screen" && (await h.js("document.activeElement.id")) === "tab-screen");
  await h.keyCode("End");
  const last = await h.js("app.dock.current");
  await h.keyCode("Home");
  h.verify("… End and Home go to the last and the first", last === "refs" && (await h.js("app.dock.current")) === "cpu", last);
  // the handle: the arrows, and a drag
  const before = await h.js("app.dock.height");
  await h.js("document.getElementById('dock-handle').focus()");
  await h.keyCode("ArrowUp");
  const up = await h.js("app.dock.height");
  h.verify("the dock's handle: ↑ makes the dock taller", up > before, [before, up]);
  const c = await h.centre("#dock-handle");
  await h.drag(c, { x: c.x, y: c.y + 80 });
  h.verify("… and dragged down, shorter", (await h.js("app.dock.height")) < up - 40, await h.js("app.dock.height"));
  // a dialog: its words can be selected, its buttons never
  await h.press("#about");
  await h.until("document.querySelector('dialog[open]') !== null", 2000);
  const sel = await h.js(`(() => { const d = document.querySelector('dialog[open]'); const s = (e) => e && getComputedStyle(e).userSelect;
    return { text: s(d.querySelector('.dialog-body p, .dialog-body li')), button: s(d.querySelector('.dialog-actions button')), icon: s(d.querySelector('.dialog-actions .icon, .dialog-head .icon')) }; })()`);
  h.verify("in a dialog, its words can be selected, but not its buttons or their icons", sel?.text === "text" && sel?.button === "none" && sel?.icon === "none", sel);
  // a selection dragged across the whole dialog takes its words only
  const picked = await h.js(`(() => { const d = document.querySelector('dialog[open]'); const r = document.createRange(); r.selectNodeContents(d);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); const t = s.toString(); s.removeAllRanges(); return t; })()`);
  const buttonWords = await h.js("[...document.querySelectorAll('dialog[open] .dialog-actions button')].map((b) => b.innerText.trim())");
  h.verify("… so a selection across it holds no button's words", typeof picked === "string" && buttonWords.every((/** @type {string} */ w) => !picked.includes(w)), { picked: picked?.slice(-80), buttonWords });
  await h.key("Escape");
  // nothing of the page is dragged off
  const dragged = await h.js(`(() => { const e = new DragEvent('dragstart', { bubbles: true, cancelable: true }); document.querySelector('#about svg').dispatchEvent(e); return e.defaultPrevented; })()`);
  h.verify("an icon is not dragged off", dragged === true);
  // a phone: a submenu takes its menu's place, under a row going back
  await h.viewport(390, 844, true);
  await h.open({ keep: true });
  await h.press("#programs");
  await h.sleep(200);
  await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].find((b) => b.getAttribute('aria-haspopup') === 'menu').click()");
  await h.sleep(250);
  h.verify("on a phone, a submenu takes its menu's place, under a row going back", await h.js("!!document.querySelector('.menu .menu-back') && !document.querySelector('.menu.submenu')"));
  await h.js("document.querySelector('.menu .menu-back').click()");
  await h.sleep(200);
  h.verify("… and the row goes back to the menu", await h.js("!document.querySelector('.menu .menu-back') && [...document.querySelectorAll('.menu [role^=menuitem]')].some((b) => b.getAttribute('aria-haspopup') === 'menu')"));
  await h.key("Escape");
  // names kept when the words are hidden (C1)
  const names = await h.js(`[...document.querySelectorAll('.strip-body button')].map((b) => ({ name: b.getAttribute('aria-label'), shown: b.querySelector('.strip-label')?.offsetParent !== null }))`);
  h.verify("on a phone, every strip button keeps its name, its words hidden", names.length >= 4 && names.every((/** @type {{ name: string, shown: boolean }} */ n) => n.name && !n.shown), names);
  const tabs = await h.js("[...document.querySelectorAll('.lesson-tab')].map((b) => b.getAttribute('aria-label'))");
  h.verify("… and every lesson tab its title, though only its number shows", tabs.length === 6 && tabs.every((/** @type {string} */ n) => /^\d .{3,}/.test(n)), tabs);
}
