// SPDX-License-Identifier: Apache-2.0
//
// The languages (U11): ?lang=zh opens the page in 简体中文, with no English of the page's own
// left (the machine's words excepted); every one of the ten opens with its own title, its tag
// on the page, and no message key showing in place of a message; the language menu lists all
// ten, switches and remembers.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.send("Page.navigate", { url: `${h.base}?debug&lang=zh` });
  await h.until("typeof cec === 'object'", 20000);
  await h.sleep(1500);
  h.verify("?lang=zh: the page is in Chinese", (await h.js("document.documentElement.lang")) === "zh-Hans" && /中华学习机/.test(await h.js("document.title")));
  const english = await h.js(`[...document.querySelectorAll("#topbar, #band, #helper-strip, .dock-bar, #status")].map((e) => e.innerText).join(" ").replace(/CEC-I|CPU|Ctrl-Reset|Page (Up|Down)|Enter|Return|2D|3D|简/g, "").match(/[A-Za-z]{3,}/g)`);
  h.verify("no English left in the page's own controls", !english, english);
  // all ten: each its title and tag, and no key where a message should be
  const tags = { zh: "zh-Hans", en: "en", "zh-TW": "zh-Hant", ja: "ja", ko: "ko", es: "es", fr: "fr", de: "de", it: "it", "pt-BR": "pt-BR" };
  /** @type {string[]} */
  const bad = [];
  const titles = new Set();
  for (const [loc, tag] of Object.entries(tags)) {
    await h.send("Page.navigate", { url: `${h.base}?debug&lang=${loc}` });
    await h.until(`typeof cec === 'object' && document.documentElement.lang === ${JSON.stringify(tag)}`, 20000);
    await h.sleep(600);
    titles.add(await h.js("document.title"));
    const keys = await h.js(`document.body.innerText.match(/\\b(?:bar|stage|view|strip|dock|lessons?|refs|status|disk|cpu|screen|kbd|hz|sample|label)\\.[a-zA-Z.]+\\b/g)`);
    if (keys) bad.push(`${loc}: ${keys.slice(0, 3).join(", ")}`);
  }
  h.verify("all ten languages open, each with its own title and tag, and no message key in place of a message", bad.length === 0 && titles.size === 10, bad.length ? bad : [...titles]);
  await h.open();
  await h.press("#lang");
  await h.sleep(200);
  h.verify("the language menu lists all ten, each as it names itself", (await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent.trim()).join('|')")).split("|").length === 10, await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent.trim())"));
  await h.key("Escape");
  await h.choose("#lang", "简体中文");
  await h.until("document.documentElement.lang === 'zh-Hans'", 10000);
  await h.until("typeof cec === 'object'", 20000);
  h.verify("the language menu opens the page again in Chinese, and remembers it", (await h.js("localStorage.getItem('ceci.lang')")) === "zh");
}
