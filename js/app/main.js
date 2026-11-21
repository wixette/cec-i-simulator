// SPDX-License-Identifier: Apache-2.0
//
// The page: loads the ROMs and the model's parameters, builds the set-up (js/sim/system.js),
// the stage in 3D and 2D, the dock and its tabs, the top bar, the helper strip and the status
// line, and runs them each frame. docs/ui-design.md says how they are laid out and why.

import { t, useLocale } from "../l10n/l10n.js";
import { LOCALE_STORE, pickLocale } from "../l10n/locales.js";
import { bakeKeys } from "../flat/bake-keys.js";
import { bakeRocker } from "../flat/bake-rocker.js";
import { Flat } from "../flat/flat.js";
import { Machine3D } from "../scene/machine3d.js";
import { Viewer } from "../scene/viewer.js";
import { hostKeyId } from "../sim/host-keys.js";
import { loadRoms, ROM_FILES } from "../sim/roms.js";
import { Speaker } from "../sim/sound.js";
import { System } from "../sim/system.js";
import { HEIGHT, WIDTH } from "../sim/video.js";
import { applyIcons, applyL10n, overlayOpen } from "../ui/components.js";
import { aboutBody } from "./about.js";
import { Dock } from "./dock.js";
import { readLink, writeLink } from "./link.js";
import { ReferencesTool } from "./references.js";
import { Stage } from "./stage.js";
import { StartTool } from "./start.js";
import { HelperStrip } from "./strip.js";
import { TopBar } from "./topbar.js";

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** A file of the site's own, with this module's version stamp. @param {string} path */
const asset = (path) => {
  const u = new URL(`../../${path}`, import.meta.url);
  u.search = new URL(import.meta.url).search;
  return u;
};
/** @param {string} path */
const json = async (path) => (await fetch(asset(path))).json();
/** Where the computer's and the TV's power are remembered. */
const POWER_STORE = "ceci.power";
/** Where the view (2D or 3D) is remembered. */
const VIEW_STORE = "ceci.view";

/** @param {string} key @returns {string | null} */
const load = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // site data blocked: nothing is remembered
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

// ---- the language (U11), before anything is written: the address's ?lang=, the visitor's choice, the browser's
const lang = pickLocale({ query: new URLSearchParams(location.search).get("lang"), saved: load(LOCALE_STORE), browser: navigator.languages ?? [navigator.language] });
await useLocale(lang);
document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
document.title = t("app.title");
applyIcons(document);
applyL10n(document);
// a button whose words a narrow window hides keeps them as its name
for (const b of document.querySelectorAll("#programs, .dock-tab")) {
  const words = b.querySelector(".label, span[data-l10n]")?.textContent;
  if (words) b.setAttribute("aria-label", words);
}

const [romResult, machineParams, keyboardParams, matrixParams] = await Promise.all([loadRoms(), json("model/params/machine.json"), json("model/params/keyboard.json"), json("model/params/keyboard_matrix.json")]);
// without the ROMs, blank chips: the page works, the computer will not switch on
const roms = romResult.roms ?? /** @type {import("../sim/machine.js").Roms} */ (Object.fromEntries(Object.entries(ROM_FILES).map(([c, f]) => [c, new Uint8Array(f.size)])));
const system = new System({ roms, matrix: matrixParams.keys, takeApart: machineParams.take_apart.order, hasRoms: !!romResult.roms });

// ---- the status line (P7) ----------------------------------------------------------------------
// One line's height in the page, whatever it says: a longer message rises over the foot of the
// dock, whose panes gain as much room below their end (--status-rise), so the stage never
// changes size because of a message. A refusal is amber, a fault red.
const statusBar = $("status");
const statusText = $("status-text");
/** Messages that refuse something, and say why (P6). */
const WARN = new Set(["power.apart", "reset.off", "apart.poweredOn", "type.off", "type.refused", "save.none", "open.notText", "status.otherRoms", "view.apart.on"]);
/** Messages about a fault. */
const ERROR = new Set(["stage.no3d", "status.noRoms", "power.noRoms"]);
/** @param {string} key */
const levelOf = (key) => (ERROR.has(key) ? "error" : WARN.has(key) ? "warn" : "");
const fitStatus = () => {
  const rise = Math.max(0, statusText.offsetHeight - statusBar.clientHeight);
  document.documentElement.style.setProperty("--status-rise", `${rise}px`);
};
/** @param {string} text @param {"" | "warn" | "error"} [level] */
const say = (text, level = "") => {
  statusText.textContent = text;
  statusBar.dataset.level = level;
  fitStatus();
};
addEventListener("resize", fitStatus);
// a unit taken out is named for the visitor ("the main board"), not by its id (board.main)
system.say = (m) => {
  const params = { ...(m.params ?? {}) };
  if (typeof params.unit === "string") params.unit = t(`unit.${params.unit}`);
  say(t(m.key, params), levelOf(m.key));
};

// ---- the sound ------------------------------------------------------------------------------------
const speaker = new Speaker();

// ---- the stage: 2D always, 3D where WebGL is ---------------------------------------------------
const flat = new Flat(
  $("view2d"),
  keyboardParams.keys,
  {
    down: (id, e) => {
      speaker.unlock();
      system.holds.sync(e);
      if (system.keyDown(id, "pointer")) system.say({ key: "key.held", params: { key: id === "test" ? "Test" : id === "ctrl" ? "Ctrl" : "Shift" } });
    },
    up: (id) => setTimeout(() => system.keyUp(id, "pointer"), 60),
    power: () => {
      speaker.unlock();
      system.power(!system.machine.powered);
    },
    tv: () => system.tvPower(!system.tv.on),
    knob: (which, v) => system.setKnob(which, v),
    knobReset: (which) => system.resetKnob(which),
  },
  { power: t("strip.computer.tip"), tvPower: t("strip.tv.tip"), brightness: t("knob.brightness", { value: "" }).replace(/[:：].*$/, ""), colour: t("knob.colour", { value: "" }).replace(/[:：].*$/, "") },
);
flat.setOpenings(machineParams);

const webgl = (() => {
  try {
    const cv = document.createElement("canvas");
    return !!(cv.getContext("webgl2") || cv.getContext("webgl"));
  } catch {
    return false;
  }
})();
/** @type {Viewer | null} */
let viewer = null;
/** @type {Machine3D | null} */
let model = null;
if (webgl) viewer = new Viewer($("view3d"));

const stage = new Stage(system, {
  viewer,
  flat,
  onModeChange: (mode) => {
    store(VIEW_STORE, mode);
    writeLink({ view: mode });
    if (mode === "2d") say(t(system.machine.powered ? "status.legend2d" : "status.welcomeOff"));
  },
});
if (viewer) viewer.jumpTo(stage.framed("front"));

// ---- the dock and its tabs (P3, U6) --------------------------------------------------------------
// the stage's least height: on a phone, more than half the screen, as the band and the helper
// strip take some of it and the drawings need the rest
const dock = new Dock(() => (matchMedia("(max-width: 700px)").matches ? Math.round(window.innerHeight * 0.55) : window.innerHeight <= 520 ? Math.round(window.innerHeight * 0.65) : 300));
dock.onResize = fitStatus;
new StartTool($("pane-start"));
new ReferencesTool($("pane-refs"));
dock.start();

// ---- the helper strip (U4) and the top bar (U8) -----------------------------------------------------
const strip = new HelperStrip($("helper-strip"), system);
/** The case as found or as new, in 3D and in 2D. @param {boolean} found */
const setFinish = (found) => {
  const c = machineParams.colours;
  const i = found ? 1 : 0;
  model?.setFinish(found);
  // the 2D view in the colours the 3D view shows under its lights (flat_case, flat_key)
  flat.setColours({ case: c.flat_case.v[i], key: c.flat_key.v[i], sticker: found ? stickerTint(c.case_plastic.v) : "#FFFFFF" });
  if (model) flat.setKeyArt(bakeKeys(model.keyboard, c.flat_key.v[i]));
};
const topBar = new TopBar(system, { about: () => aboutBody(asset("package.json")), references: () => dock.show("refs"), sound: speaker, finish: setFinish, showComputer: () => stage.showComputer() });
topBar.applyFinish();

// ---- the 3D model, loaded in the background ---------------------------------------------------------
if (viewer) {
  stage.progress(0);
  Machine3D.load(viewer, system, asset("model/cec-i.glb"), machineParams, lang, (f) => stage.progress(f))
    .then((m) => {
      model = m;
      stage.bindModel(m);
      topBar.applyFinish();
      // the 2D view's keys and power switch, drawn from the model's own (js/flat/bake-*.js)
      flat.setRockerArt(bakeRocker(m.rocker));
      stage.progress(null);
    })
    .catch((err) => {
      stage.progress(null);
      say(`${t("stage.no3d")} (${err instanceof Error ? err.message : err})`, "error");
    });
}

// ---- the visitor's keyboard (U5) ------------------------------------------------------------------
/** Whether a key event belongs to the page rather than the machine. @param {KeyboardEvent} e */
function forThePage(e) {
  if (overlayOpen()) return true;
  // a control that acted on the key already (the dock's handle, a tab list's arrows)
  if (e.defaultPrevented) return true;
  // ⌘ is the browser's; Ctrl, with every key, is the machine's
  if (e.metaKey) return true;
  const a = /** @type {HTMLElement | null} */ (document.activeElement);
  if (a && a !== document.body) {
    if (a.matches("input, textarea, select, [contenteditable]")) return true;
    // a focused control keeps the keys it acts on
    if (a.matches("button, [role=tab], [role=radio], summary, a, #dock-handle") && ["Enter", " ", "Tab"].includes(e.key)) return true;
    // the 3D view, which only Tab can focus: its arrows, + and - move the camera, Home goes home
    if (viewer && a === viewer.canvas && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "Home"].includes(e.key)) return true;
  }
  return e.key === "Tab" && !e.ctrlKey;
}
/** The host's Caps Lock last seen: the machine's toggles each time the host's changes. @type {boolean | null} */
let hostCaps = null;
/** @param {KeyboardEvent} e */
function capsLock(e) {
  const now = e.getModifierState("CapsLock");
  // Windows sends down and up for each press, a Mac down to lock and up to unlock: either
  // way the state changes once a press
  if (hostCaps !== null && now === hostCaps) return;
  hostCaps = now;
  system.keyDown("capslock", "key");
  system.keyUp("capslock", "key");
}
/** The machine's key each of the visitor's keys put down, by KeyboardEvent.code: its keyup lets that one go, with Alt or without. @type {Map<string, string>} */
const hostDown = new Map();
addEventListener("keydown", (e) => {
  speaker.unlock();
  if (forThePage(e)) {
    if (viewer && document.activeElement === viewer.canvas && e.key === "Home") stage.home();
    return;
  }
  system.holds.sync(e);
  const id = hostKeyId(e);
  if (!id) return;
  e.preventDefault();
  if (e.repeat) return; // the machine repeats a held key itself
  if (id === "capslock") return void capsLock(e);
  hostDown.set(e.code, id);
  system.keyDown(id, "key");
});
addEventListener("keyup", (e) => {
  system.holds.sync(e);
  if (e.code === "CapsLock") return void capsLock(e);
  const id = hostDown.get(e.code);
  if (!id) return;
  hostDown.delete(e.code);
  system.keyUp(id, "key");
});
addEventListener("blur", () => {
  hostDown.clear();
  system.releaseKeys();
});
if (viewer) {
  // The 3D view's focus has two states, as the TRS-80 simulator's (U2): reached by Tab, it
  // shows its ring and its arrows, + and - move the camera; otherwise it has no focus and
  // every key is the machine's. A press on the view never focuses it, and lets go of whatever
  // had the focus: pressing the machine is typing at the machine.
  const canvas = viewer.canvas;
  canvas.addEventListener("mousedown", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", () => {
    speaker.unlock();
    const a = /** @type {HTMLElement | null} */ (document.activeElement);
    if (a && a !== document.body) a.blur();
  });
}
// a control pressed with the pointer lets go of the focus, so that the next keys are the machine's
document.addEventListener("click", (e) => {
  const b = /** @type {HTMLElement} */ (e.target).closest?.("button, [role=tab]");
  if (b && e.detail > 0 && !b.closest("dialog, .menu")) /** @type {HTMLElement} */ (b).blur();
});
addEventListener("pointerdown", () => speaker.unlock(), { capture: true });

// ---- the ROMs, and the power at the start (U5) -----------------------------------------------------
if (romResult.status !== "ok") say(t(romResult.status === "missing" ? "status.noRoms" : "status.otherRoms", { files: romResult.files.join(", ") }), romResult.status === "missing" ? "error" : "warn");
if (romResult.roms) {
  // the machine starts as the visitor left it: at first, the computer and the TV on, so that a
  // first visit opens on a live machine
  /** @type {{ computer?: boolean, tv?: boolean } | null} */
  let saved = null;
  try {
    saved = JSON.parse(load(POWER_STORE) ?? "null");
  } catch {
    saved = null;
  }
  const on = { computer: saved?.computer ?? true, tv: saved?.tv ?? true };
  const quiet = system.say;
  system.say = () => {};
  if (on.tv) system.tvPower(true);
  if (on.computer) system.power(true);
  system.say = quiet;
  if (romResult.status === "ok") say(t(on.computer && on.tv ? "status.welcome" : "status.welcomeOff"));
}
// the power, as the visitor leaves it
let powerShown = "";
system.onChange.push(() => {
  if (!romResult.roms) return;
  const now = JSON.stringify({ computer: system.machine.powered, tv: system.tv.on });
  if (now === powerShown) return;
  powerShown = now;
  store(POWER_STORE, now);
});

// ---- the view to start in (U1): the link's, else the remembered one, else 3D --------------------------
let start = readLink(location.hash).view ?? /** @type {"2d" | "3d" | undefined} */ (load(VIEW_STORE) ?? undefined);
if (!viewer) start = "2d";
if (start === "2d") stage.setMode("2d", { instant: true });
if (start !== "2d" && romResult.status === "ok" && matchMedia("(max-width: 700px)").matches) say(t("status.phone2d"));
if (!viewer) say(t("stage.no3d"), "error");

// ---- each frame ------------------------------------------------------------------------------------
let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const t0 = system.machine.cycles;
  system.frame(document.hidden ? 0 : dt, now);
  speaker.frame(system.machine, t0, !system.racing);
  const tvShows = system.tv.on;
  if (tvShows) system.video.draw(system.machine);
  const pic = { on: tvShows, signal: system.machine.powered, pixels: system.video.pixels, width: WIDTH, height: HEIGHT, border: system.video.border, brightness: system.tv.brightness, colour: system.colourKnob, display: system.video.display };
  // the tube is drawn while the 3D view is, the flight to 2D included
  if (model && viewer?.active) model.showPicture(pic);
  if (stage.mode === "2d") {
    flat.setState({ power: system.machine.powered, tv: system.tv.on, brightness: system.tv.brightness, colour: system.tv.colour });
    flat.show({ on: system.machine.powered, pixels: system.video.pixels, border: [...system.video.border], display: system.video.display, colour: system.colourKnob });
    flat.setKeys(system.keysDown(), new Set(system.keyboard.caps ? ["capslock"] : []));
  }
  stage.refresh();
  strip.refresh();
}
requestAnimationFrame(frame);

/** The case's yellowing as a tint for the 2D view's stickers, in sRGB (a canvas multiplies in sRGB). @param {[string, string]} pair the case's colour as new and as found */
function stickerTint(pair) {
  const [a, b] = pair.map((h) => parseInt(h.slice(1), 16));
  const ch = (/** @type {number} */ x, /** @type {number} */ s) => (x >> s) & 255;
  return `#${[16, 8, 0].map((s) => Math.min(255, Math.round((255 * ch(b, s)) / ch(a, s))).toString(16).padStart(2, "0")).join("")}`;
}

if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { cec: system, app: { stage, dock, flat, viewer, model: () => model } });
if (new URLSearchParams(location.search).has("selftest")) import("./selftest.js").then((m) => m.selftest(system));
