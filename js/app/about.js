// SPDX-License-Identifier: Apache-2.0
//
// About (docs/ui-design.md, U9), short: the logo and the version (read from package.json, the
// one place it is kept), what the simulator is, where its source is, its licences a line each,
// and that it is not the makers'. What it simplifies, its credits and further reading are in
// the References tab (js/app/references.js), which About's References button opens.

import { t } from "../l10n/l10n.js";
import { el } from "../ui/components.js";

export const REPO = "https://github.com/wixette/cec-i-simulator";

/** @param {string} href @param {string} text */
const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });

/** @param {URL} pkg package.json @returns {Node[]} */
export function aboutBody(pkg) {
  const version = el("span", { class: "version" });
  fetch(pkg)
    .then((r) => r.json())
    .then((p) => (version.textContent = t("about.version", { version: p.version })))
    .catch(() => {});
  /** What, then whose: a line each. @param {string} what @param {(Node | string)[]} whose */
  const row = (what, whose) => [el("dt", { text: t(what) }), el("dd", {}, whose)];
  return [
    el("div", { class: "about-band" }, [el("img", { src: new URL("../../images/logo.svg", import.meta.url).href, alt: "" }), el("div", {}, [el("strong", { text: t("app.name") }), el("br"), version])]),
    el("p", { class: "dialog-text", text: t("about.what") }),
    el("ul", { class: "about-links" }, [el("li", {}, [link(REPO, t("about.source"))]), el("li", {}, [link(`${REPO}/issues`, t("about.issues"))])]),
    el("h3", { text: t("about.licences") }),
    el("dl", { class: "about-licences" }, [
      ...row("about.lic.code", [link(`${REPO}/blob/main/LICENSE`, "Apache-2.0")]),
      ...row("about.lic.content", ["CC BY-SA 4.0"]),
      ...row("about.lic.roms", [t("about.lic.roms.whose"), " · ", link(`${REPO}/blob/main/roms/NOTICE`, "roms/NOTICE")]),
      ...row("about.lic.three", ["three.js · MIT"]),
      ...row("about.lic.fonts", ["Roboto Flex, Noto Sans SC, Noto Serif SC, Arimo · OFL 1.1"]),
      ...row("about.lic.icons", ["Material Symbols © Google · Apache-2.0"]),
    ]),
    el("p", { class: "dialog-text dim about-trademark", text: t("about.trademark") }),
  ];
}
