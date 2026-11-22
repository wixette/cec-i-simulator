// SPDX-License-Identifier: Apache-2.0
//
// The page without a mouse, and what a mouse must not do (design/v1.0.0.md, task 7; review
// C1): the dock's tabs by the arrows, Home and End; its handle by the arrows, and dragged; a
// submenu on a phone taking its menu's place, with a row going back; every strip button and
// compact lesson tab keeping its name when a narrow window hides its words; in a dialog, the
// words selectable but never its buttons; nothing of the page dragged off; and in each tab, at
// both sizes, every control named, every picture described, and every text at WCAG AA contrast
// (4.5:1, 3:1 for large text).

// the page read in place: unnamed controls, pictures with no alt, the 3D picture's name, and
// text below AA contrast against the background it stands on
const AUDIT = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'))?.textContent || e.textContent || e.getAttribute('title') || '').trim();
  const unnamed = [...document.querySelectorAll('button, [role=tab], [role^=menuitem], a, input, select, textarea, [role=slider], [role=switch]')].filter(vis).filter((e) => !name(e) && !(e.labels && e.labels.length)).map((e) => e.outerHTML.slice(0, 120));
  const noAlt = [...document.querySelectorAll('img')].filter((e) => !e.hasAttribute('alt')).map((e) => e.src);
  const canvases = [...document.querySelectorAll('canvas')].filter(vis).map((c) => ({ id: c.id || c.parentElement.id, label: c.getAttribute('aria-label') || c.parentElement.getAttribute('aria-label'), role: c.getAttribute('role') || c.parentElement.getAttribute('role') }));
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.9)) return c; } return [20, 20, 20]; };
  const low = [];
  const seen = new Set();
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || e.closest('canvas, svg')) continue;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(e); const fg = rgb(s.color); const bg = bgOf(e);
    const a = fg.length > 3 ? fg[3] : 1; const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    const L1 = lum(mix), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
    const need = big ? 3 : 4.5;
    if (ratio < need) { const key = e.className + '|' + s.color + '|' + bg; if (!seen.has(key)) { seen.add(key); low.push({ cls: (e.className && e.className.baseVal === undefined ? e.className : e.tagName) + '', text: e.textContent.trim().slice(0, 30), ratio: +ratio.toFixed(2), color: s.color, bg: 'rgb(' + bg.join(',') + ')', size: s.fontSize }); } }
  }
  return { unnamed, noAlt, canvases, low };
})()`;

/**
 * Every tab audited, at the size the page is at.
 * @param {import("./harness.mjs").Harness} h
 * @param {string} size
 */
async function audit(h, size) {
  await h.until("app.model() !== null || !app.viewer", 30000);
  const found = [];
  for (const tab of ["lessons", "cpu", "screen", "hanzi", "keyboard", "refs"]) {
    await h.js(`app.dock.show("${tab}")`);
    await h.sleep(400);
    const r = await h.js(AUDIT);
    if (r.unnamed.length || r.noAlt.length || r.low.length) found.push({ tab, ...r, canvases: undefined });
    if (tab === "lessons") h.verify(`${size}: the 3D picture is named, as a picture`, r.canvases.every((/** @type {{ id: string, label: string, role: string }} */ c) => c.id !== "view3d" || (c.label && c.role === "img")), r.canvases);
  }
  h.verify(`${size}: in every tab, every control named, every picture described, every text at AA contrast`, found.length === 0, found);
}

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await audit(h, "desktop");
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
  await audit(h, "phone");
}
