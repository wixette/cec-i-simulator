// SPDX-License-Identifier: Apache-2.0
//
// The stage (docs/ui-design.md, U1-U4, U10): the machine in 3D or in 2D, and its band.
//
// - `[2D | 3D]` at the band's right. Going to 2D, the camera flies to the TV's screen and the
//   flat view cross-fades in; going back, it fades out and the camera flies back to where it
//   was. The 3D scene stops rendering under 2D. Going to 2D puts the machine back together.
// - In 3D the band also holds ⌂, zoom and the Views menu; Put it all back stands on the stage
//   while anything is out. Inside turns the lid and the keyboard to glass; Taken apart takes
//   the computer apart, and choosing another view puts it back.
// - In 2D the band holds the keyboard drawer's toggle (U10).
// - In both, Display: the set the computer is plugged into, and the case's finish (U8); its
//   menu is the top bar's (js/app/topbar.js), the button here, with what it changes.
// - A part's label shows after the pointer rests on it, beside the pointer.
// As the TRS-80 simulator's stage (https://github.com/wixette/trs-80-simulator, Apache-2.0, by
// the same author).

import { t } from "../l10n/l10n.js";
import { corners, frame } from "../scene/framing.js";
import { FOV } from "../scene/viewer.js";
import { el, icon, setTip, showMenu } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../scene/viewer.js").Viewer} Viewer */
/** @typedef {import("../scene/machine3d.js").Machine3D} Machine3D */
/** @typedef {import("../flat/flat.js").Flat} Flat */
/** @typedef {"front" | "angle" | "keyboard" | "screen" | "back" | "inside" | "apart"} ViewName */
/** @typedef {[number, number, number]} Vec */

/**
 * The camera's views: the direction each looks from (towards its parts), the parts it frames
 * (the model's nodes, model/README.md), the share of the stage they fill; and a pose, in
 * metres, for before the model is in.
 * @type {Record<ViewName, { dir: Vec, nodes: string[], fill: number, pos: Vec, target: Vec }>}
 */
export const VIEWS = {
  // the way in: straight on from the front, 32 degrees above, the TV and the computer framed
  // together, the whole screen over the computer, ready to type
  front: { dir: [0, 0.53, 0.85], nodes: ["tv", "case.base", "case.lid"], fill: 0.94, pos: [0, 0.5, 0.78], target: [0, 0.13, -0.1] },
  // the whole set-up three-quarter on, from the front left
  angle: { dir: [-0.55, 0.5, 0.75], nodes: ["tv", "case.base", "case.lid"], fill: 0.92, pos: [-0.6, 0.55, 0.8], target: [0, 0.12, -0.1] },
  // the keys from above and in front, as a typist looks down at them
  keyboard: { dir: [0, 0.82, 0.57], nodes: ["keyboard"], fill: 0.96, pos: [0, 0.36, 0.3], target: [0, 0.05, -0.01] },
  screen: { dir: [0, 0.08, 1], nodes: ["tv.screen"], fill: 0.94, pos: [0, 0.2, 0.45], target: [0, 0.17, -0.26] },
  // from behind, right and above, past the TV (glass while it stands in the way): the sockets
  back: { dir: [0.38, 0.42, -0.82], nodes: ["case.base", "case.lid"], fill: 0.88, pos: [0.3, 0.3, -0.6], target: [0, 0.04, 0] },
  // the lid and the keyboard as glass: the main board, the power supply, the speaker
  inside: { dir: [0, 0.82, 0.57], nodes: ["case.base"], fill: 0.9, pos: [0, 0.42, 0.3], target: [0, 0.02, 0] },
  // the computer's parts out, three-quarter on from the front left and above
  apart: { dir: [-0.42, 0.55, 0.72], nodes: ["case.base", "case.lid", "keyboard", "board.main"], fill: 0.92, pos: [-0.5, 0.55, 0.7], target: [-0.1, 0.06, 0.05] },
};
/** In the menu's order: the way in, then the screen, the view most often wanted, then the rest. */
const VIEW_ORDER = /** @type {ViewName[]} */ (["front", "screen", "keyboard", "angle", "back", "inside", "apart"]);
/** What a framed view keeps clear of the stage's edges, px. */
const GAP = 8;
/** How long a label waits under a resting pointer, ms. */
const LABEL_MS = 400;
/** Where the keyboard drawer's state is remembered. */
const DRAWER_STORE = "ceci.drawer";

export class Stage {
  /**
   * @param {System} system
   * @param {{ viewer: Viewer | null, flat: Flat, onModeChange: (mode: "2d" | "3d") => void }} parts
   */
  constructor(system, parts) {
    this.system = system;
    this.viewer = parts.viewer;
    /** @type {Machine3D | null} */
    this.model = null;
    this.flat = parts.flat;
    this.onModeChange = parts.onModeChange;
    /** @type {"2d" | "3d"} */
    this.mode = "3d";
    /** @type {ViewName} */
    this.view = "front";
    /** @private the camera before a flight to 2D, to come back to */
    this.before = /** @type {import("../scene/viewer.js").Pose | null} */ (null);
    /** @private a move between 2D and 3D under way */
    this.moving = false;
    this.el = /** @type {HTMLElement} */ (document.getElementById("stage"));
    /** The stage under its band: the views, and what stands over them. */
    this.area = /** @type {HTMLElement} */ (document.getElementById("stage-view"));
    /** The view the camera was put on and has kept since, refitted as the stage changes size; null once the visitor moves it. @type {ViewName | null} */
    this.fitted = "front";
    /** @private what was fitted when the camera flew to 2D, to come back to */
    this.fittedBefore = /** @type {ViewName | null} */ (null);
    this.view3d = /** @type {HTMLElement} */ (document.getElementById("view3d"));
    this.view2d = /** @type {HTMLElement} */ (document.getElementById("view2d"));
    const band = /** @type {HTMLElement} */ (document.getElementById("band"));
    // the 3D tools
    const home = el("button", { class: "btn icon-only home-btn", type: "button" }, [icon("home")]);
    setTip(home, t("stage.home"));
    home.addEventListener("click", () => this.home());
    const zoomOut = el("button", { class: "btn icon-only", type: "button" }, [icon("zoom_out")]);
    setTip(zoomOut, t("stage.zoomOut"));
    zoomOut.addEventListener("click", () => {
      this.fitted = null; // the camera is the visitor's now
      this.viewer?.zoom(1 / 0.8);
    });
    const zoomIn = el("button", { class: "btn icon-only", type: "button" }, [icon("zoom_in")]);
    setTip(zoomIn, t("stage.zoomIn"));
    zoomIn.addEventListener("click", () => {
      this.fitted = null;
      this.viewer?.zoom(0.8);
    });
    this.viewsBtn = el("button", { class: "btn small menu-btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" });
    this.viewsBtn.setAttribute("data-tip-describes", "");
    setTip(this.viewsBtn, t("stage.views.tip"));
    this.viewsBtn.addEventListener("click", () =>
      showMenu(
        this.viewsBtn,
        // Taken apart greyed while the computer runs, saying why (P6); chosen, it says how to see inside
        VIEW_ORDER.map((v) => ({ label: t(`view.${v}`), checked: this.view === v, disabled: v === "apart" && this.system.machine.powered ? t("view.apart.on") : undefined, run: () => this.goTo(v) })),
      ),
    );
    this.tools3d = el("div", { class: "band-group tools3d" }, [home, el("span", { class: "joined" }, [zoomOut, zoomIn]), this.viewsBtn]);
    // the toggle (U1)
    this.toggle = el("div", { class: "segmented mode", role: "radiogroup", "aria-label": t("stage.mode") });
    for (const m of /** @type {const} */ (["2d", "3d"])) {
      const b = el("button", { type: "button", role: "radio", "data-mode": m }, [icon(m === "2d" ? "web_asset" : "view_in_ar"), el("span", { text: m.toUpperCase() })]);
      b.setAttribute("data-tip-describes", "");
      setTip(b, t(`stage.${m}.tip`));
      b.addEventListener("click", () => this.setMode(m));
      this.toggle.append(b);
    }
    // the 2D view's drawer: the computer and its keyboard, under the TV (U10)
    this.drawerBtn = el("button", { class: "btn small tonal has-icon", type: "button", "aria-pressed": "false" }, [icon("keyboard"), el("span", { text: t("stage.drawer") })]);
    this.drawerBtn.setAttribute("data-tip-describes", "");
    setTip(this.drawerBtn, t("stage.drawer.tip"));
    this.drawerBtn.addEventListener("click", () => this.setDrawer(!this.flat.drawerOpen));
    this.drawers = el("div", { class: "band-group drawers" }, [this.drawerBtn]);
    // Display: what is seen, so beside the views (U8); the top bar gives it its menu
    const display = el("button", { id: "display", class: "btn small menu-btn has-icon display-btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" }, [icon("tv"), el("span", { text: t("bar.display") }), icon("keyboard_arrow_down")]);
    display.setAttribute("data-tip-describes", "");
    display.setAttribute("aria-label", t("bar.display"));
    band.append(el("span", { class: "spacer" }), el("div", { class: "band-group" }, [display]), this.drawers, this.tools3d, this.toggle);
    // Put it all back (U3)
    this.putBack = el("button", { class: "btn filled has-icon put-back", type: "button", hidden: true }, [icon("construction"), el("span", { text: t("stage.putBack") })]);
    this.putBack.addEventListener("click", () => this.system.putAllBack());
    this.area.append(this.putBack);
    this.loading = el("div", { class: "loading", hidden: true }, [el("div", { class: "loading-bar" }, [el("span")]), el("p", { text: t("stage.loading") })]);
    this.area.append(this.loading);
    this.label = el("div", { class: "part-label", role: "tooltip", hidden: true });
    this.area.append(this.label);
    // the drawer as the visitor left it; at first open: the keys to type at, beside the picture
    let drawer = true;
    try {
      const saved = localStorage.getItem(DRAWER_STORE);
      if (saved) drawer = saved === "open";
    } catch {
      // not remembered
    }
    this.flat.setDrawer(drawer);
    if (this.viewer) {
      const v = this.viewer;
      v.onUserMove.push(() => (this.fitted = null));
      // a stage resized during a flight or a move is framed again once the camera has landed
      let refit = false;
      v.onResize.push(() => {
        if (this.fitted && this.mode === "3d" && !this.moving && !v.isFlying()) v.jumpTo(this.framed(this.fitted));
        else refit = true;
      });
      v.onFrame.push(() => {
        if (!refit || this.moving || v.isFlying()) return;
        refit = false;
        if (this.fitted && this.mode === "3d") v.jumpTo(this.framed(this.fitted));
      });
    }
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this.labelTimer = undefined;
    /** @private what the band showed last */
    this.shownKey = "";
    system.onChange.push(() => this.refresh());
    this.refresh();
  }

  /** The 3D model, once it has loaded. @param {Machine3D} m */
  bindModel(m) {
    this.model = m;
    m.on.hover = (h, x, y) => this.hover(h, x, y);
    m.on.info = (label) => this.system.say({ key: "part.said", params: { label } });
    m.on.screenDoubleClick = () => this.setMode("2d");
    m.on.heldModifier = (id) => this.system.say({ key: "key.held", params: { key: id === "test" ? "Test" : id === "ctrl" ? "Ctrl" : "Shift" } });
    m.setInside(this.view === "inside");
    if (this.fitted && this.mode === "3d" && this.viewer) this.viewer.jumpTo(this.framed(this.fitted));
  }

  /**
   * Where the camera goes for a view: its parts framed on the stage as it is now, seen from the
   * view's direction; before the model is in, the view's own pose.
   * @param {ViewName} v
   * @returns {import("../scene/viewer.js").Pose}
   */
  framed(v) {
    const viewer = /** @type {Viewer} */ (this.viewer);
    const view = VIEWS[v];
    if (!this.model) return viewer.fit({ pos: view.pos, target: view.target });
    const { width, height } = viewer.size();
    // the parts where they are going: taken apart, put back
    const boxes = this.model.boxSettled(view.nodes);
    return frame(corners(boxes), view.dir, FOV, width, height, { top: GAP, right: GAP, bottom: GAP, left: GAP }, view.fill);
  }

  /** The state shown on the band's buttons: called each frame, and does the work only on a change. */
  refresh() {
    const s = this.system;
    // Taken apart, then put back together (Put it all back, or 2D): the view is the front again
    if (this.view === "apart" && [...s.motion.values()].every((m) => m.target === 0)) {
      this.view = "front";
      if (this.fitted === "apart") this.fitted = "front";
      if (this.fittedBefore === "apart") this.fittedBefore = "front";
      if (this.mode === "3d" && !this.moving && this.viewer) this.viewer.flyTo(this.framed("front"));
    }
    const drawer = this.flat.drawerOpen;
    const key = `${s.whole}${this.mode}${this.view}${drawer}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.drawerBtn.setAttribute("aria-pressed", String(drawer));
    this.putBack.hidden = this.mode !== "3d" || s.whole;
    this.viewsBtn.replaceChildren(el("span", { text: t(`view.${this.view}`) }), icon("keyboard_arrow_down"));
    for (const b of this.toggle.children) b.setAttribute("aria-checked", String(/** @type {HTMLElement} */ (b).dataset.mode === this.mode));
    this.el.dataset.mode = this.mode;
  }

  /** The 2D view's keyboard drawer, open or closed, remembered. @param {boolean} open */
  setDrawer(open) {
    this.flat.setDrawer(open);
    try {
      localStorage.setItem(DRAWER_STORE, open ? "open" : "closed");
    } catch {
      // not remembered
    }
    this.refresh();
  }

  /**
   * Brings the computer into sight, for a change to it (the case's finish): in 2D, the
   * keyboard's drawer opened; in 3D, the front view if the screen's hides it.
   */
  showComputer() {
    if (this.mode === "2d") {
      if (!this.flat.drawerOpen) this.setDrawer(true);
    } else if (this.view === "screen") this.goTo("front");
  }

  /** Shows the load's progress, 0..1, or hides it (null). @param {number | null} f */
  progress(f) {
    this.loading.hidden = f === null;
    if (f !== null) /** @type {HTMLElement} */ (this.loading.querySelector("span")).style.width = `${Math.round(f * 100)}%`;
  }

  /** ⌂: the front view, every part back. */
  home() {
    if (!this.system.whole) this.system.putAllBack();
    this.goTo("front");
  }

  /** A view: the camera flies there. @param {ViewName} v */
  goTo(v) {
    if (!this.viewer) return;
    // a running machine stays closed: Taken apart is refused, and says how to see inside
    if (v === "apart" && !this.system.takeAllApart()) return;
    if (this.mode === "2d") {
      // still flying to 2D: land that first, then come back
      if (this.moving) this.viewer.endFlight();
      this.setMode("3d");
    }
    if (this.view === "apart" && v !== "apart" && !this.system.whole) this.system.putAllBack();
    this.view = v;
    // on the way back from 2D, the flight that lands the camera goes to this view, not the last
    this.fittedBefore = v;
    this.model?.setInside(v === "inside");
    if (v === "inside") this.system.say({ key: "view.inside.said" });
    this.fitted = v;
    this.viewer.flyTo(this.framed(v));
    this.refresh();
  }

  /**
   * 2D or 3D (U1).
   * @param {"2d" | "3d"} mode
   * @param {{ instant?: boolean }} [o]
   */
  setMode(mode, o = {}) {
    if (mode === this.mode || this.moving) return;
    const viewer = this.viewer;
    if (mode === "2d") {
      if (this.system.putBackNow()) this.system.say({ key: "apart.putBackFor2d" });
      this.mode = "2d";
      this.refresh();
      this.onModeChange("2d");
      const show = () => {
        this.view2d.hidden = false;
        requestAnimationFrame(() => this.view2d.classList.add("shown"));
        if (viewer) viewer.active = false;
        this.moving = false;
      };
      if (viewer && !o.instant) {
        this.moving = true;
        this.before = viewer.pose();
        this.fittedBefore = this.fitted;
        viewer.flyTo(this.framed("screen"), show);
      } else show();
      return;
    }
    if (!viewer) {
      this.system.say({ key: "stage.no3d" });
      return;
    }
    this.mode = "3d";
    viewer.active = true;
    this.view2d.classList.remove("shown");
    this.moving = true;
    setTimeout(() => {
      this.view2d.hidden = true;
      // a view the page chose is framed again, as the stage may have changed size meanwhile
      this.fitted = this.fittedBefore ?? (this.before ? null : this.view);
      viewer.flyTo(this.fitted ? this.framed(this.fitted) : /** @type {import("../scene/viewer.js").Pose} */ (this.before), () => (this.moving = false));
    }, o.instant || viewer.reducedMotion.matches ? 0 : 220);
    this.refresh();
    this.onModeChange("3d");
  }

  /** The label of a part under the resting pointer. @param {import("../scene/machine3d.js").Hover | null} h @param {number} x @param {number} y */
  hover(h, x, y) {
    clearTimeout(this.labelTimer);
    if (!h) {
      this.label.hidden = true;
      return;
    }
    this.labelTimer = setTimeout(() => {
      const r = this.area.getBoundingClientRect();
      const s = this.system;
      const why = h.action === "takeOut" ? t("label.takeOut") : h.action === "putBack" ? t("label.putBack") : h.action === "none" && h.unit && s.machine.powered ? t("label.offFirst") : "";
      const [name, ...role] = h.label.split(/[:：]\s*/);
      this.label.replaceChildren(el("strong", { text: name }), ...(role.length ? [el("span", { text: role.join(": ") })] : []), ...(why ? [el("em", { text: why })] : []));
      this.label.hidden = false;
      const lx = Math.min(r.width - this.label.offsetWidth - 8, x - r.left + 14);
      const ly = y - r.top + 18 + this.label.offsetHeight > r.height ? y - r.top - this.label.offsetHeight - 10 : y - r.top + 18;
      this.label.style.left = `${Math.max(8, lx)}px`;
      this.label.style.top = `${Math.max(8, ly)}px`;
    }, LABEL_MS);
  }
}
