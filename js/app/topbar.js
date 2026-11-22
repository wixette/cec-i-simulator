// SPDX-License-Identifier: Apache-2.0
//
// The top bar (docs/ui-design.md, U8): what you do to the machine on the left (Programs), what
// you do with the app on the right (Sound, the language, About), and the Display menu, whose
// button stands in the stage's band with the views. Each is a menu or a dialog (P4, P10).
//
// - Programs: Type in (a dialog with a text box: anything pasted or written there is typed on
//   the machine's own keys, Chinese through its 区位 input, D8); Open a file (a BASIC listing
//   typed in the same way after NEW, or LOGO procedures typed into LOGO's editor); Save the
//   program (the BASIC program in memory as a text file with a name, its Chinese as Chinese);
//   Disk (design/v0.0.5.md: a disk image inserted in the drive, a blank one, saved, ejected).
//   A file dropped on the page is opened or inserted as its kind says. Files are read and
//   written here, never uploaded.
// - Display: the set the computer is plugged into (a colour TV, a black-and-white TV, a green
//   monitor, D6), and the computer's case as new or as found; both remembered.

import { locale, t } from "../l10n/l10n.js";
import { LOCALE_NAMES, LOCALE_SHORT, LOCALE_STORE, LOCALES } from "../l10n/locales.js";
import { blankDisk, readDisk, writeDisk } from "../sim/disk-image.js";
import { listing, SAMPLES, SECTIONS } from "../sim/samples.js";
import { el, icon, setTip, showDialog, showMenu } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../sim/video.js").Display} Display */

/** Where the page's choices are remembered. */
const SOUND_STORE = "ceci.sound";
const DISPLAY_STORE = "ceci.display";
const FINISH_STORE = "ceci.finish";
/** The sets, in the menu's order. @type {Display[]} */
const DISPLAYS = ["colour", "bw", "green"];
/** Each of our programs' sections' icon in Programs. @type {Record<import("../sim/samples.js").Section, import("../ui/components.js").IconName>} */
const SECTION_ICONS = { learn: "school", chinese: "translate", games: "sports_esports", utilities: "construction", music: "music_note", logo: "draw" };

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

/** Disk images, by their names' endings. */
const DISK_FILES = /\.(dsk|do|po|nib|woz)$/i;

/** Hands the visitor a file. @param {string | Uint8Array} data @param {string} name */
function download(data, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([/** @type {BlobPart} */ (data)], { type: typeof data === "string" ? "text/plain;charset=utf-8" : "application/octet-stream" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * A program's name for its file: its first REM line's words, else PROGRAM; what a file's name
 * cannot hold taken out.
 * @param {string} text the listing
 */
export function programName(text) {
  const rem = /^\d+\s*REM\s*(.+)$/m.exec(text)?.[1] ?? "";
  const name = rem.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return name || "PROGRAM";
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
   * @param {{ about: () => Node[], references: () => void, sound: { muted: boolean, setMuted: (m: boolean) => void }, finish: (found: boolean) => void, showComputer: () => void }} o
   */
  constructor(system, o) {
    this.system = system;
    this.o = o;
    /** The case as new (the default), or as found (yellowed, as the machine looks today: left for the visitor to find in Display). */
    this.found = load(FINISH_STORE) === "found";
    const programs = /** @type {HTMLButtonElement} */ (document.getElementById("programs"));
    const display = /** @type {HTMLButtonElement} */ (document.getElementById("display"));
    const about = /** @type {HTMLButtonElement} */ (document.getElementById("about"));
    this.file = /** @type {HTMLInputElement} */ (el("input", { type: "file", accept: ".bas,.txt,.logo,text/plain", hidden: true }));
    this.diskFile = /** @type {HTMLInputElement} */ (el("input", { type: "file", accept: ".dsk,.do,.po,.nib,.woz", hidden: true }));
    document.body.append(this.file, this.diskFile);
    this.file.addEventListener("change", () => {
      const f = this.file.files?.[0];
      this.file.value = "";
      if (f) void this.openFile(f);
    });
    this.diskFile.addEventListener("change", () => {
      const f = this.diskFile.files?.[0];
      this.diskFile.value = "";
      if (f) void this.insertFile(f);
    });
    // a file dropped on the page: a disk image inserted, anything else opened
    document.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    });
    document.addEventListener("drop", (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      if (DISK_FILES.test(f.name)) void this.insertFile(f);
      else if (system.machine.powered) void this.openFile(f);
      else system.say({ key: "type.off" });
    });
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
    /** @type {import("../ui/components.js").MenuItem[]} */
    const ours = [];
    // a submenu for each section of our programs, then the visitor's own text and files
    for (const sec of SECTIONS) {
      const list = SAMPLES.filter((sm) => sm.section === sec).map((sm) => ({ label: t(`sample.${sm.id}.title`), run: () => this.program(sm) }));
      if (list.length) ours.push({ label: t(`programs.${sec}`), icon: SECTION_ICONS[sec], items: list });
    }
    return [
      ...ours,
      { label: t("programs.typein"), icon: "content_paste", divider: ours.length ? true : undefined, disabled: off, run: () => this.typeInDialog() },
      { label: t("programs.open"), icon: "upload_file", disabled: off, run: () => (s.machine.powered ? this.file.click() : s.say({ key: "type.off" })) },
      { label: t("programs.save"), icon: "download", disabled: off ?? (program || s.logoRunning ? undefined : true), run: () => this.save() },
      { label: t("programs.disk"), icon: "save", divider: true, items: this.diskItems() },
    ];
  }

  /** The disk drive's menu (Programs ▸ Disk, and the drive's button on the strip). @returns {import("../ui/components.js").MenuItem[]} */
  diskItems() {
    const s = this.system;
    // with no disk, greyed: plain enough to need no reason beside it (choosing one says it)
    const none = s.disk ? undefined : /** @type {true} */ (true);
    return [
      { label: t("disk.insert"), icon: "upload_file", run: () => this.diskFile.click() },
      { label: t("disk.blank"), icon: "note_add", run: () => this.insert(blankDisk(t("disk.blankName"))) },
      { label: t("disk.save"), icon: "download", divider: true, disabled: none, run: () => this.saveDisk() },
      { label: t("disk.eject"), icon: "eject", disabled: none, run: () => (s.disk ? s.insertDisk(null) : s.say({ key: "disk.none" })) },
    ];
  }

  /** Shows the drive's menu by a button (the strip's). @param {HTMLElement} anchor */
  showDiskMenu(anchor) {
    showMenu(anchor, this.diskItems());
  }

  /** @private A disk image from a file, into the drive. @param {File} f */
  async insertFile(f) {
    try {
      this.insert(readDisk(new Uint8Array(await f.arrayBuffer()), f.name));
    } catch {
      // the file is not one: said in the page's words, whatever went wrong reading it
      this.system.say({ key: "disk.bad", params: { name: f.name } });
    }
  }

  /**
   * @private A disk into the drive; with the computer on, a choice: start from it (switched
   * off and on, as the manual starts a disk), or leave the machine as it is.
   * @param {import("../sim/disk-image.js").Disk} disk
   */
  insert(disk) {
    const s = this.system;
    s.insertDisk(disk);
    if (!s.machine.powered) return;
    showDialog(t("disk.title"), [el("p", { class: "dialog-text", text: t("disk.inserted", { name: disk.name }) }), el("p", { class: "dialog-text dim", text: t("disk.limits") })], [
      { label: t("disk.leave") },
      { label: t("disk.startIt"), primary: true, icon: "power_settings_new", run: () => s.startFromDisk() },
    ]);
  }

  /** @private The disk in the drive, as a file: what was loaded, with what was written. */
  saveDisk() {
    const s = this.system;
    const disk = s.disk;
    if (!disk) return void s.say({ key: "disk.none" });
    const { bytes, extension } = writeDisk(disk);
    const name = `${disk.name.replace(/\.(dsk|do|po|nib|woz)$/i, "")}.${extension}`;
    download(bytes, name);
    s.say({ key: "disk.saved", params: { name } });
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
    items.push({
      label: t("menu.knobs.reset"),
      icon: "restart_alt",
      divider: true,
      run: () => s.resetKnobs(),
    });
    for (const [i, found] of [false, true].entries()) {
      items.push({
        label: t(found ? "menu.finish.found" : "menu.finish.new"),
        checked: this.found === found,
        divider: i === 0 ? t("menu.finish") : undefined,
        run: () => {
          this.found = found;
          store(FINISH_STORE, found ? "found" : "new");
          this.applyFinish();
          // the change is the computer's: in sight, so that it is seen
          this.o.showComputer();
          s.say({ key: found ? "finish.found" : "finish.new" });
        },
      });
    }
    return items;
  }

  /**
   * Opens one of our programs' dialogs, as Programs does (a lesson's step).
   * @param {string} id
   * @param {() => void} [typing] what to do as its typing starts (a lesson turns to the screen)
   */
  openProgram(id, typing) {
    const sm = SAMPLES.find((x) => x.id === id);
    if (sm) this.program(sm, typing);
  }

  /**
   * One of our programs (design/v0.0.3.md, P1): what it does, the mode it runs in, its listing,
   * and Type it in, which gets the machine to that mode and types it on the keys.
   * @private @param {import("../sim/samples.js").Sample} sm @param {() => void} [typing]
   */
  program(sm, typing) {
    const s = this.system;
    const title = t(`sample.${sm.id}.title`);
    const body = [
      el("p", { class: "dialog-text", text: t(`sample.${sm.id}.about`) }),
      el("p", { class: "dialog-text dim", text: t(`program.mode.${sm.mode}`) }),
      el("pre", { class: "program-listing", text: listing(sm) }),
    ];
    const off = s.machine.powered ? undefined : t("bar.switchOnFirst");
    showDialog(title, body, [{ label: t("typein.cancel") }, { label: t("program.type"), primary: true, icon: "keyboard", disabled: off, run: () => void (s.typeProgram(sm, title) && typing?.()) }], { wide: true });
  }

  /**
   * Type in: a text box; what is written or pasted in it is typed on the machine's keys.
   */
  typeInDialog() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "type.off" });
    const box = /** @type {HTMLTextAreaElement} */ (el("textarea", { class: "typein-box", spellcheck: "false", autocapitalize: "off", autocomplete: "off", placeholder: t("typein.placeholder"), "aria-label": t("typein.title") }));
    const body = [el("p", { class: "dialog-text", text: t("typein.intro") }), box, el("p", { class: "dialog-text dim", text: t("typein.chinese") })];
    showDialog(t("typein.title"), body, [{ label: t("typein.cancel") }, { label: t("typein.go"), primary: true, icon: "keyboard", run: () => s.typeIn(box.value) }], { wide: true });
    // the text box, not the button, has the focus: the visitor writes first
    setTimeout(() => box.focus(), 0);
  }

  /**
   * @private Open a file: a visitor's own BASIC listing, typed in after NEW; or LOGO
   * procedures (a .logo file), typed into LOGO's editor as our LOGO programs are.
   * @param {File} f
   */
  async openFile(f) {
    const s = this.system;
    const text = decodeText(new Uint8Array(await f.arrayBuffer()));
    if (text === null) return void s.say({ key: "open.notText", params: { name: f.name } });
    if (/\.logo$/i.test(f.name)) return void s.typeProgram({ id: "", section: "logo", mode: "logo", text: text.trimEnd() }, f.name);
    s.typeIn(text.endsWith("\n") ? text : `${text}\n`, { program: true });
  }

  /**
   * @private Save the program, named as the visitor says: the BASIC program in memory as a
   * .bas file; while LOGO runs, its procedures as a .logo file (LOGO's own PO ALL, read as it
   * prints them).
   */
  save() {
    const s = this.system;
    if (s.logoRunning) {
      s.say({ key: "save.logo" });
      s.logoProcedures((text) => (text ? this.saveAs(`${text}\n`, /^TO\s+(\S+)/m.exec(text)?.[1] ?? "LOGO", "logo") : s.say({ key: "save.noLogo" })));
      return;
    }
    const text = s.listing();
    if (!text) return void s.say({ key: "save.none" });
    this.saveAs(text, programName(text), "bas");
  }

  /** @private The name asked for, then the file. @param {string} text @param {string} suggested @param {string} ext */
  saveAs(text, suggested, ext) {
    const s = this.system;
    const box = /** @type {HTMLInputElement} */ (el("input", { class: "name-box", type: "text", value: suggested, "aria-label": t("save.name"), spellcheck: "false" }));
    const go = () => {
      const name = box.value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim().replace(new RegExp(`\\.${ext}$`, "i"), "") || "PROGRAM";
      download(text, `${name}.${ext}`);
      s.say({ key: "save.done", params: { name: `${name}.${ext}`, lines: text.split("\n").length - 1 } });
    };
    const d = showDialog(t("save.title"), [el("label", { class: "dialog-text", text: t("save.name") }), box], [{ label: t("typein.cancel") }, { label: t("save.go"), primary: true, icon: "download", run: go }]);
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      d.close();
      go();
    });
    setTimeout(() => box.select(), 0);
  }
}
