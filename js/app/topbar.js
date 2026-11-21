// SPDX-License-Identifier: Apache-2.0
//
// The top bar (docs/ui-design.md, U8): what you do to the machine on the left (Programs,
// Display), what you do with the app on the right (Sound, the language, About). Each is a menu
// or a dialog (P4, P10).
//
// - Programs: Type in (a dialog with a text box: anything pasted or written there is typed on
//   the machine's own keys, Chinese through its 区位 input, D8); Open a BASIC file (typed in the
//   same way, after NEW); Save the program (the BASIC program in memory as a text file, its
//   Chinese as Chinese). Files are read and written here, never uploaded.
// - Display: the set the computer is plugged into (a colour TV, a black-and-white TV, a green
//   monitor, D6), and the computer's case as new or as found; both remembered.

import { locale, t } from "../l10n/l10n.js";
import { LOCALE_NAMES, LOCALE_SHORT, LOCALE_STORE, LOCALES } from "../l10n/locales.js";
import { el, icon, setTip, showDialog, showMenu } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../sim/video.js").Display} Display */

/** Where the page's choices are remembered. */
const SOUND_STORE = "ceci.sound";
const DISPLAY_STORE = "ceci.display";
const FINISH_STORE = "ceci.finish";
/** The sets, in the menu's order. @type {Display[]} */
const DISPLAYS = ["colour", "bw", "green"];

/** Whether site data can be kept: if not, a language chosen goes in the address. */
const remembered = () => {
  try {
    localStorage.setItem("ceci.probe", "1");
    localStorage.removeItem("ceci.probe");
    return true;
  } catch {
    return false;
  }
};

/** @param {string} key @returns {string | null} */
const load = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
/** @param {string} key @param {string} value */
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered
  }
};

/** Hands the visitor a file. @param {string} text @param {string} name */
function download(text, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * A text file's bytes as text: UTF-8, else GB18030 (GBK and GB2312 files, common for Chinese
 * listings), else null.
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
export function decodeText(bytes) {
  for (const enc of ["utf-8", "gb18030"]) {
    try {
      return new TextDecoder(enc, { fatal: true }).decode(bytes).replace(/^﻿/, "");
    } catch {
      // the next
    }
  }
  return null;
}

export class TopBar {
  /**
   * @param {System} system
   * @param {{ about: () => Node[], references: () => void, sound: { muted: boolean, setMuted: (m: boolean) => void }, finish: (found: boolean) => void }} o
   */
  constructor(system, o) {
    this.system = system;
    this.o = o;
    /** The case as found (yellowed), or as new. */
    this.found = load(FINISH_STORE) === "found";
    const programs = /** @type {HTMLButtonElement} */ (document.getElementById("programs"));
    const display = /** @type {HTMLButtonElement} */ (document.getElementById("display"));
    const about = /** @type {HTMLButtonElement} */ (document.getElementById("about"));
    this.file = /** @type {HTMLInputElement} */ (el("input", { type: "file", accept: ".bas,.txt,text/plain", hidden: true }));
    document.body.append(this.file);
    this.file.addEventListener("change", () => this.openFile());
    programs.addEventListener("click", () => showMenu(programs, this.programItems()));
    display.addEventListener("click", () => showMenu(display, this.displayItems()));
    setTip(programs, t("bar.programs.tip"));
    setTip(display, t("bar.display.tip"));
    // About: References opens the tab, Close is the one action it is for
    about.addEventListener("click", () =>
      showDialog(t("about.title"), this.o.about(), [
        { label: t("about.references"), run: () => this.o.references() },
        { label: t("about.close"), primary: true },
      ]),
    );
    setTip(about, t("bar.about"));
    // the language (U11): each named as it names itself; a choice is remembered, and the page
    // opens again in it, as everything on it is written once, as it is built
    const lang = /** @type {HTMLButtonElement} */ (document.getElementById("lang"));
    /** @type {HTMLElement} */ (lang.querySelector(".lang-code")).textContent = LOCALE_SHORT[locale()];
    setTip(lang, t("bar.lang.tip"));
    lang.addEventListener("click", () =>
      showMenu(
        lang,
        LOCALES.map((l) => ({
          label: LOCALE_NAMES[l],
          checked: l === locale(),
          run: () => {
            if (l === locale()) return;
            store(LOCALE_STORE, l);
            const u = new URL(location.href);
            u.searchParams.delete("lang");
            if (!remembered()) u.searchParams.set("lang", l);
            // the address may be this very one, #fragment and all: then load it again
            if (u.href === location.href) location.reload();
            else location.replace(u);
          },
        })),
      ),
    );
    // Sound, for the whole page: on or off, remembered
    const sound = /** @type {HTMLButtonElement} */ (document.getElementById("sound"));
    const showSound = () => {
      const on = !this.o.sound.muted;
      sound.replaceChildren(icon(on ? "volume_up" : "volume_off"));
      sound.setAttribute("aria-pressed", String(on));
      setTip(sound, t(on ? "bar.sound.on" : "bar.sound.off"));
    };
    if (load(SOUND_STORE) === "off") this.o.sound.setMuted(true);
    sound.addEventListener("click", () => {
      const on = this.o.sound.muted;
      this.o.sound.setMuted(!on);
      store(SOUND_STORE, on ? "on" : "off");
      system.say({ key: on ? "sound.on" : "sound.off" });
      showSound();
    });
    showSound();
    // the display and the case as the visitor left them, quietly
    const saved = /** @type {Display | null} */ (load(DISPLAY_STORE));
    if (saved && DISPLAYS.includes(saved)) system.video.display = saved;
  }

  /** The case's finish, as remembered: for the 3D model once it loads, and the 2D view. */
  applyFinish() {
    this.o.finish(this.found);
  }

  /** @private @returns {import("../ui/components.js").MenuItem[]} */
  programItems() {
    const s = this.system;
    const off = s.machine.powered ? undefined : t("bar.switchOnFirst");
    const program = s.listing();
    return [
      { label: t("programs.typein"), icon: "content_paste", disabled: off, run: () => this.typeInDialog() },
      { label: t("programs.open"), icon: "upload_file", disabled: off, run: () => (s.machine.powered ? this.file.click() : s.say({ key: "type.off" })) },
      { label: t("programs.save"), icon: "download", divider: true, disabled: off ?? (program ? undefined : t("programs.save.none")), run: () => this.save() },
    ];
  }

  /** @private @returns {import("../ui/components.js").MenuItem[]} */
  displayItems() {
    const s = this.system;
    /** @type {import("../ui/components.js").MenuItem[]} */
    const items = DISPLAYS.map((d, i) => ({
      label: t(`menu.display.${d}`),
      checked: s.video.display === d,
      divider: i === 0 ? t("menu.display.set") : undefined,
      run: () => {
        s.setDisplay(d);
        store(DISPLAY_STORE, d);
      },
    }));
    for (const [i, found] of [false, true].entries()) {
      items.push({
        label: t(found ? "menu.finish.found" : "menu.finish.new"),
        checked: this.found === found,
        divider: i === 0 ? t("menu.finish") : undefined,
        run: () => {
          this.found = found;
          store(FINISH_STORE, found ? "found" : "new");
          this.applyFinish();
          s.say({ key: found ? "finish.found" : "finish.new" });
        },
      });
    }
    return items;
  }

  /**
   * Type in: a text box; what is written or pasted in it is typed on the machine's keys.
   * Also opened by pasting onto the page (main.js), with the pasted text in it.
   * @param {string} [text]
   */
  typeInDialog(text = "") {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "type.off" });
    const box = /** @type {HTMLTextAreaElement} */ (el("textarea", { class: "typein-box", spellcheck: "false", autocapitalize: "off", autocomplete: "off", placeholder: t("typein.placeholder"), "aria-label": t("typein.title") }));
    box.value = text;
    const body = [el("p", { class: "dialog-text", text: t("typein.intro") }), box, el("p", { class: "dialog-text dim", text: t("typein.chinese") })];
    showDialog(t("typein.title"), body, [{ label: t("typein.cancel") }, { label: t("typein.go"), primary: true, icon: "keyboard", run: () => s.typeIn(box.value) }], { wide: true });
    // the text box, not the button, has the focus: the visitor writes first
    setTimeout(() => box.focus(), 0);
  }

  /** @private Open a BASIC file: a visitor's own listing, typed in after NEW. */
  async openFile() {
    const f = this.file.files?.[0];
    if (!f) return;
    this.file.value = "";
    const s = this.system;
    const text = decodeText(new Uint8Array(await f.arrayBuffer()));
    if (text === null) return void s.say({ key: "open.notText", params: { name: f.name } });
    s.typeIn(text.endsWith("\n") ? text : `${text}\n`, { program: true });
  }

  /** @private Save the program: the BASIC program in memory, as a text file. */
  save() {
    const s = this.system;
    const text = s.listing();
    if (!text) return void s.say({ key: "save.none" });
    download(text, "program.bas");
    s.say({ key: "save.done", params: { lines: text.split("\n").length - 1 } });
  }
}
