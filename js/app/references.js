// SPDX-License-Identifier: Apache-2.0
//
// The References tab (docs/ui-design.md, U6), in one column down the middle of the dock,
// looked up rather than read in order: the machine's keys on the visitor's, how Chinese goes
// in; further reading, what the simulator is built on, its source; then what it simplifies,
// folded, for the few who want it. About's References button opens it.
//
// A message may mark code with `backticks` and a key with [[brackets]].

import { t } from "../l10n/l10n.js";
import { LEGEND } from "../sim/host-keys.js";
import { el } from "../ui/components.js";
import { REPO } from "./about.js";

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

/** @param {string} href @param {string} text */
const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });

/** Further reading: each a message, and where it is. */
const READING = /** @type {[string, string][]} */ ([
  ["refs.read.docs", "https://github.com/wixette/cec-i-docs"],
  ["refs.read.manual", "https://github.com/wixette/cec-i-docs/tree/main/docs/01-user-manual"],
  ["refs.read.hardware", "https://github.com/wixette/cec-i-docs/tree/main/docs/04-hardware-reference"],
  ["refs.read.wpzh", "https://zh.wikipedia.org/wiki/中华学习机"],
  ["refs.read.gb2312", "https://en.wikipedia.org/wiki/GB_2312"],
  ["refs.read.apple2e", "https://en.wikipedia.org/wiki/Apple_IIe"],
]);

/** What it is built on: each a message, and where it is. */
const CREDITS = /** @type {[string, string][]} */ ([
  ["refs.credit.docs", "https://github.com/wixette/cec-i-docs"],
  ["refs.credit.mame", "https://github.com/mamedev/mame"],
  ["refs.credit.harte", "https://github.com/SingleStepTests/65x02"],
  ["refs.credit.three", "https://threejs.org/"],
  ["refs.credit.noto", "https://github.com/notofonts/noto-cjk"],
]);

export class ReferencesTool {
  /** @param {HTMLElement} host */
  constructor(host) {
    const list = (/** @type {[string, string][]} */ items) => el("ul", { class: "link-list" }, items.map(([key, href]) => el("li", {}, [link(href, t(key))])));
    const keys = el("table", { class: "keymap" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: t("refs.keys.machine") }), el("th", { text: t("refs.keys.yours") }), el("th", { text: t("refs.keys.or") })])]),
      el("tbody", {}, LEGEND.map(([machine, yours, alt]) => el("tr", {}, [el("td", {}, [el("kbd", { text: machine })]), el("td", {}, [el("kbd", { text: yours })]), el("td", {}, [el("kbd", { text: alt })])]))),
    ]);
    const chinese = el("ul", {}, Array.from({ length: 3 }, (_, i) => el("li", {}, rich(t(`refs.chinese.${i + 1}`)))));
    host.append(
      el("article", { class: "references" }, [
        el("h3", { text: t("refs.keys") }),
        el("p", {}, rich(t("refs.keys.intro"))),
        keys,
        el("p", {}, rich(t("refs.keys.ctrl"))),
        el("h3", { text: t("refs.chinese") }),
        chinese,
        el("h3", { text: t("refs.reading") }),
        list(READING),
        el("h3", { text: t("refs.credits") }),
        list(CREDITS),
        el("h3", { text: t("refs.source") }),
        el("ul", { class: "link-list" }, [el("li", {}, [link(REPO, t("about.source"))]), el("li", {}, [link(`${REPO}/tree/main/research`, t("refs.research"))])]),
        // the few who want it: how the simulator differs from the machine, folded
        el("details", { class: "more refs-more" }, [el("summary", { text: t("refs.simplifies") }), el("ul", { class: "plain-list" }, t("refs.simplifies.list").split(" · ").map((s) => el("li", { text: s })))]),
      ]),
    );
  }
}
