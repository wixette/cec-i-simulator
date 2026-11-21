// SPDX-License-Identifier: Apache-2.0
//
// The Start tab (docs/ui-design.md, U6): what the machine is, a first few minutes with it, its
// own keys on the visitor's keyboard, and how Chinese goes in. One reading column down the
// middle of the dock. Until the lessons come, it is the dock's first tab.
//
// A message may mark code with `backticks` and a key with [[brackets]].

import { t } from "../l10n/l10n.js";
import { LEGEND } from "../sim/host-keys.js";
import { el } from "../ui/components.js";

/** The user manual, transcribed (the cec-i-docs repository). */
const MANUAL = "https://github.com/wixette/cec-i-docs/tree/main/docs/01-user-manual";

/**
 * A message's text, its `code` and [[keys]] as elements.
 * @param {string} text
 * @returns {(Node | string)[]}
 */
export function rich(text) {
  return text.split(/(`[^`]+`|\[\[[^\]]+\]\])/).filter(Boolean).map((part) => {
    if (part.startsWith("`")) return el("code", { text: part.slice(1, -1) });
    if (part.startsWith("[[")) return el("kbd", { text: part.slice(2, -2) });
    return part;
  });
}

export class StartTool {
  /** @param {HTMLElement} host */
  constructor(host) {
    const p = (/** @type {string} */ key) => el("p", {}, rich(t(key)));
    const h = (/** @type {string} */ key) => el("h3", { text: t(key) });
    const list = (/** @type {"ol" | "ul"} */ tag, /** @type {string} */ prefix, /** @type {number} */ n) => el(tag, {}, Array.from({ length: n }, (_, i) => el("li", {}, rich(t(`${prefix}.${i + 1}`)))));
    const photo = new URL("../../images/photos/cec-i-front-left.jpg", import.meta.url);
    photo.search = new URL(import.meta.url).search;
    const keys = el("table", { class: "keymap" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: t("start.keys.machine") }), el("th", { text: t("start.keys.yours") }), el("th", { text: t("start.keys.or") })])]),
      el("tbody", {}, LEGEND.map(([machine, yours, alt]) => el("tr", {}, [el("td", {}, [el("kbd", { text: machine })]), el("td", {}, [el("kbd", { text: yours })]), el("td", {}, [el("kbd", { text: alt })])]))),
    ]);
    host.append(
      el("article", { class: "start" }, [
        h("start.what.head"),
        el("figure", {}, [el("img", { src: photo.href, alt: t("start.photo.alt"), loading: "lazy" }), el("figcaption", { text: t("start.photo") })]),
        p("start.what"),
        p("start.what.2"),
        h("start.first.head"),
        list("ol", "start.first", 5),
        h("start.keys.head"),
        p("start.keys.intro"),
        keys,
        p("start.keys.ctrl"),
        h("start.chinese.head"),
        list("ul", "start.chinese", 4),
        h("start.more.head"),
        el("p", {}, [...rich(t("start.more")), " ", el("a", { href: MANUAL, target: "_blank", rel: "noopener", text: t("start.more.link") })]),
      ]),
    );
  }
}
