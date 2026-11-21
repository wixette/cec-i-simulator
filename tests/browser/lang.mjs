// SPDX-License-Identifier: Apache-2.0
//
// The languages (U11): ?lang=zh opens the page in 简体中文, with no English of the page's own
// left (the machine's words excepted); the language menu switches and remembers.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.send("Page.navigate", { url: `${h.base}?debug&lang=zh` });
  await h.until("typeof cec === 'object'", 20000);
  await h.sleep(1500);
  h.verify("?lang=zh: the page is in Chinese", (await h.js("document.documentElement.lang")) === "zh-Hans" && /中华学习机/.test(await h.js("document.title")));
  const english = await h.js(`[...document.querySelectorAll("#topbar, #band, #helper-strip, .dock-bar, #status")].map((e) => e.innerText).join(" ").replace(/CEC-I|CPU|Ctrl-Reset|Page (Up|Down)|Enter|Return|2D|3D|简/g, "").match(/[A-Za-z]{3,}/g)`);
  h.verify("no English left in the page's own controls", !english, english);
  await h.open();
  await h.choose("#lang", "简体中文");
  await h.until("document.documentElement.lang === 'zh-Hans'", 10000);
  await h.until("typeof cec === 'object'", 20000);
  h.verify("the language menu opens the page again in Chinese, and remembers it", (await h.js("localStorage.getItem('ceci.lang')")) === "zh");
}
