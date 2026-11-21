// SPDX-License-Identifier: Apache-2.0
//
// The References tab (docs/ui-design.md, U6), in one column down the middle of the dock,
// looked up rather than read in order: further reading first, what the simulator is built on,
// its source; then what it simplifies, folded, for the few who want it. About's References
// button opens it.

import { t } from "../l10n/l10n.js";
import { el } from "../ui/components.js";
import { REPO } from "./about.js";

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
    host.append(
      el("article", { class: "references" }, [
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
