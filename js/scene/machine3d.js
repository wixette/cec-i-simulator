// SPDX-License-Identifier: Apache-2.0
//
// The CEC-I and its TV in 3D, bound to the set-up's state (js/sim/system.js): the model's
// nodes (model/README.md, the node contract) move and light as the machine does, and clicks
// on them work the machine through the same calls as every other view (docs/ui-design.md, P2).
//
// - Keys go down while anyone holds them (the visitor's keyboard, a click, the typist); Caps
//   Lock sits lower while latched. A click holds a key; Ctrl, Shift and TEST clicked stay
//   down for the next key (js/sim/key-holds.js).
// - The power switch rocks and the lamp lights; the TV's button, lamp and knobs work where they
//   are (a drag or the wheel turns a knob, a double-click puts it back).
// - The slot's flap swings open on a click.
// - Taking it apart: a click on the lid, the keyboard or the main board with the computer off
//   (U3); the units move as the system says (System.motion): the lid up and aside, the
//   keyboard turned over forward on its cable, the board lifted.
// - Inside: the lid and the keyboard as glass; the TV turns to glass whenever it stands
//   between the camera and the computer.
// - As new or as found: the case, the keys and the stickers yellow together.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ghost } from "./ghost.js";
import { KeyboardMotion } from "./keyboard-motion.js";
import { Ribbon } from "./ribbon.js";
import { TvScreen } from "./tv.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("./viewer.js").Viewer} Viewer */
/** @typedef {import("../sim/system.js").Knob} Knob */

/** A node by its name in the model (GLTFLoader drops the dots from names). @param {string} name */
const nodeName = (name) => THREE.PropertyBinding.sanitizeNodeName(name);

/** The units that come out (model/params/machine.json, take_apart). */
const UNITS = ["case.lid", "keyboard", "board.main"];
/** The TV's parts, turned to glass while it stands in the way. */
const TV_PARTS = ["tv", "tv.screen", "tv.screen_rim", "tv.power", "tv.knob.brightness", "tv.knob.colour", "tv.lamp"];
/** A lit lamp's colour and glow. */
const LAMP_RED = 0xff1a14;
const LAMP_GLOW = 1.1;
/** How long the TV's button stays in after a press, s. */
const BUTTON_S = 0.18;
/** How near a key the plate and the lid count as among the keys, m: about half a key's pitch. */
const KEY_NEAR_M = 0.009;
/** How long the slot's flap takes to swing, s. */
const FLAP_S = 0.35;
/**
 * The chips Inside lights as they work (docs/ui-design.md, U12), and their colours: one colour
 * a kind of chip, as the TRS-80 simulator's (the processor amber, RAM violet, ROM green).
 */
const GLOW = /** @type {const} */ ({
  cpu: { parts: ["part.u1"], colour: "#ff8a3d" },
  ram: { parts: ["part.u5", "part.u6"], colour: "#d16cff" },
  u7: { parts: ["part.u7"], colour: "#55d18a" },
  u35: { parts: ["part.u35"], colour: "#3ddcb8" },
  font: { parts: ["part.u33", "part.u34"], colour: "#ffd24a" },
  latch: { parts: ["part.u32"], colour: "#ff5a46" },
  chargen: { parts: ["part.u13"], colour: "#4a7dff" },
});

/**
 * @typedef {object} Hover what the pointer is over, for the stage's label
 * @property {string} node the model's node name, e.g. "part.u33", "key.a"
 * @property {string} label its label in the page's language, "Name: what it does"
 * @property {"press" | "toggle" | "turn" | "takeOut" | "putBack" | "none"} action what a click does
 * @property {boolean} unit whether it is part of a unit that comes out
 */

/**
 * @typedef {object} Events
 * @property {(h: Hover | null, x: number, y: number) => void} [hover]
 * @property {(label: string) => void} [info] a click on a part that does nothing else: its label, to say
 * @property {() => void} [screenDoubleClick] a double-click on the TV's screen: the 2D view
 * @property {(part: "tv" | "computer") => void} [partDoubleClick] a double-click on the TV's
 *   body or the computer's case: that one brought close (the Screen view, the Keyboard view)
 * @property {(id: string) => void} [heldModifier] Ctrl, Shift or TEST clicked: held for the next key
 */

/**
 * @typedef {object} Key a keycap in the model
 * @property {THREE.Object3D} obj @property {THREE.Vector3} base @property {THREE.Vector3} axis
 * @property {number} travel m @property {string} id @property {number} down 0..1, eased
 * @property {number} drop the share of the travel Caps Lock sits down while latched
 */

export class Machine3D {
  /**
   * Loads the model and binds it.
   * @param {Viewer} viewer
   * @param {System} system
   * @param {URL} model the .glb
   * @param {any} params model/params/machine.json
   * @param {"en" | "zh"} lang the labels' language
   * @param {(f: number) => void} [progress] 0..1 while it loads
   */
  static async load(viewer, system, model, params, lang, progress) {
    const gltf = await new GLTFLoader().loadAsync(model.href, (e) => e.total && progress?.(e.loaded / e.total));
    return new Machine3D(viewer, system, gltf.scene, params, lang);
  }

  /**
   * @param {Viewer} viewer
   * @param {System} system
   * @param {THREE.Object3D} root
   * @param {any} params
   * @param {"en" | "zh"} lang
   */
  constructor(viewer, system, root, params, lang) {
    this.viewer = viewer;
    this.system = system;
    this.root = root;
    this.params = params;
    this.lang = lang;
    /** @type {Events} */
    this.on = {};
    root.traverse((o) => {
      if (!(/** @type {THREE.Mesh} */ (o).isMesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    viewer.scene.add(root);

    /** @type {Key[]} */
    this.keys = [];
    root.traverse((o) => {
      if (o.userData.key_id === undefined) return;
      const a = /** @type {number[]} */ (o.userData.axis ?? [0, -1, 0]);
      const travel = o.userData.travel ?? 3.5;
      this.keys.push({ obj: o, base: o.position.clone(), axis: new THREE.Vector3(...a).normalize(), travel: travel / 1000, id: o.userData.key_id, down: 0, drop: (o.userData.latched_drop ?? 0) / travel });
    });
    /** The keyboard node, for the 2D view's keys (js/flat/bake-keys.js). */
    this.keyboard = this.node("keyboard");
    /** The power switch, for the 2D view's (js/flat/bake-rocker.js). */
    this.rocker = this.node("switch.power");
    /** @private */
    this.rockerRest = this.rocker.quaternion.clone();
    /** @private */
    this.lampMats = this.ownMaterials(this.node("led.power"), (m) => m.name === "led_red");
    /** @private */
    this.tvLampMats = this.ownMaterials(this.node("tv.lamp"), () => true);
    this.tv = new TvScreen(this.node("tv.screen"));
    /** @private */
    this.tvButton = this.node("tv.power");
    /** @private */
    this.tvButtonRest = this.tvButton.position.clone();
    /** @private seconds the TV's button still shows in */
    this.tvPress = 0;
    /** @private the TV's power last shown */
    this.tvShown = system.tv.on;
    /** @private @type {Record<Knob, { obj: THREE.Object3D, rest: THREE.Quaternion }>} */
    this.knobs = {
      brightness: { obj: this.node("tv.knob.brightness"), rest: new THREE.Quaternion() },
      colour: { obj: this.node("tv.knob.colour"), rest: new THREE.Quaternion() },
    };
    for (const k of Object.values(this.knobs)) k.rest.copy(k.obj.quaternion);
    /** @private */
    this.flap = this.node("case.flap");
    /** @private */
    this.flapRest = this.flap.quaternion.clone();
    /** @private */
    this.flapAxis = new THREE.Vector3(...(this.flap.userData.axis ?? [-1, 0, 0])).normalize();
    /** @private 0 closed .. 1 open, and where it is going */
    this.flapF = 0;
    this.flapTarget = 0;

    // the units that come out
    /** @private */
    this.lid = this.node("case.lid");
    /** @private */
    this.board = this.node("board.main");
    /** @private */
    this.rest = new Map([this.lid, this.board].map((o) => [o, o.position.clone()]));
    /** @private */
    this.kbMotion = new KeyboardMotion(this.keyboard, params.case.depth.v);
    /** @private */
    this.ribbon = new Ribbon(root, this.node("cable.ribbon"), this.node("keyboard.cable_plug"));
    /** @private the top node of each unit, to its name @type {Map<THREE.Object3D, string>} */
    this.unitOf = new Map(UNITS.map((u) => [this.node(u), u]));

    // as new, or as found: each finish material's two colours, and the stickers' yellowing
    /** @private @type {[THREE.MeshStandardMaterial, THREE.Color, THREE.Color][]} */
    this.finishMats = [];
    /** @private @type {[THREE.MeshStandardMaterial, THREE.Color][]} */
    this.stickerMats = [];
    /** @type {Set<THREE.Material>} */
    const seen = new Set();
    root.traverse((o) => {
      const mat = /** @type {THREE.Mesh} */ (o).material;
      for (const m of mat ? (Array.isArray(mat) ? mat : [mat]) : []) {
        if (seen.has(m)) continue;
        seen.add(m);
        const sm = /** @type {THREE.MeshStandardMaterial} */ (m);
        const pair = params.colours[sm.name]?.v;
        if (Array.isArray(pair)) this.finishMats.push([sm, new THREE.Color(pair[0]), new THREE.Color(pair[1])]);
        else if (sm.name.startsWith("sticker_")) this.stickerMats.push([sm, sm.color.clone()]);
      }
    });
    const caseNew = new THREE.Color(params.colours.case_plastic.v[0]);
    const caseFound = new THREE.Color(params.colours.case_plastic.v[1]);
    /** @private the case's yellowing, channel by channel: the stickers age with the plastic they sit on */
    this.yellowing = new THREE.Color(caseFound.r / caseNew.r, caseFound.g / caseNew.g, caseFound.b / caseNew.b);

    // the TV turned to glass while it stands between the camera and the computer
    /** @private */
    this.tvParts = TV_PARTS.map((n) => this.node(n));
    // the TV takes no shadows: the key light comes low from the front, and the computer in front
    // of the set cast its shadow on the cabinet's foot; raising the light instead would light
    // the case's top harder again
    for (const o of this.tvParts) o.traverse((x) => (x.receiveShadow = false));
    /** @private */
    this.tvBox = new THREE.Box3();
    for (const o of this.tvParts) this.tvBox.expandByObject(o);
    /** @private */
    this.computerCentre = new THREE.Box3().setFromObject(this.node("case.base")).getCenter(new THREE.Vector3());
    /** @private */
    this.tvGhosted = false;
    /** Whether the lid and the keyboard are glass (the Inside view). */
    this.inside = false;

    // the chips Inside lights: each one's materials its own, with an emissive colour at 0
    /** @private @type {Record<keyof typeof GLOW, { mats: THREE.MeshStandardMaterial[], level: number }>} */
    this.glow = /** @type {any} */ (Object.fromEntries(
      Object.entries(GLOW).map(([k, g]) => [k, { mats: g.parts.flatMap((n) => this.glowMaterials(this.node(n), g.colour)), level: 0 }]),
    ));

    this.bindPointer();
    viewer.onFrame.push((dt) => this.tick(dt));
  }

  /** A node by its name in the model. @param {string} name */
  node(name) {
    const o = this.root.getObjectByName(nodeName(name));
    if (!o) throw new Error(`the model has no ${name}`);
    return o;
  }

  /**
   * A part's box in the world, where it is now, for framing a view (js/scene/framing.js).
   * @param {string} name
   * @returns {{ min: [number, number, number], max: [number, number, number] }}
   */
  box(name) {
    this.root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(this.node(name));
    return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
  }

  /**
   * Parts' boxes as box() gives them, but where they are going: each unit at the end of its
   * move (a view frames the machine as it will be, not as it is mid-move).
   * @param {string[]} names
   */
  boxSettled(names) {
    this.placeUnits((u) => this.system.motion.get(u)?.target ?? 0);
    const boxes = names.map((n) => this.box(n));
    this.placeUnits((u) => this.system.motion.get(u)?.f ?? 0);
    return boxes;
  }

  /**
   * @private Every material under a node, each mesh's own copy, so that it can light alone.
   * @param {THREE.Object3D} node
   * @param {(m: THREE.Material) => boolean} which
   * @returns {THREE.MeshStandardMaterial[]}
   */
  ownMaterials(node, which) {
    /** @type {THREE.MeshStandardMaterial[]} */
    const out = [];
    node.traverse((o) => {
      const mesh = /** @type {THREE.Mesh} */ (o);
      if (!mesh.isMesh || Array.isArray(mesh.material) || !which(mesh.material)) return;
      const own = /** @type {THREE.MeshStandardMaterial} */ (mesh.material.clone());
      mesh.material = own;
      out.push(own);
    });
    return out;
  }

  /**
   * @private Every material under a node, cloned, with an emissive colour at 0.
   * @param {THREE.Object3D} node
   * @param {string} colour
   * @returns {THREE.MeshStandardMaterial[]}
   */
  glowMaterials(node, colour) {
    /** @type {THREE.MeshStandardMaterial[]} */
    const out = [];
    node.traverse((o) => {
      const mesh = /** @type {THREE.Mesh} */ (o);
      if (!mesh.isMesh) return;
      const list = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((x) => {
        const c = /** @type {THREE.MeshStandardMaterial} */ (x.clone());
        c.emissive = new THREE.Color(colour);
        c.emissiveIntensity = 0;
        out.push(c);
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? list : list[0];
    });
    return out;
  }

  /**
   * @private The chips lit by their share of the frame's memory traffic, eased: the RAM, U7,
   * U35 and the font ROMs; the latch flashing as it is written; the character ROM while text is
   * shown; the 6502 while it runs. Only Inside shows them: the lid hides them otherwise.
   * @param {number} dt
   */
  tickGlow(dt) {
    const s = this.system;
    const m = s.machine;
    const t = s.traffic;
    const run = m.powered && !s.paused;
    let ramN = t.lc;
    for (const n of t.pages) ramN += n;
    const total = ramN + t.u7 + t.u35 + t.font;
    const ease = Math.min(1, dt * 8);
    /** @param {keyof typeof GLOW} k @param {number} target */
    const set = (k, target) => {
      const g = this.glow[k];
      g.level += (target - g.level) * ease;
      for (const x of g.mats) x.emissiveIntensity = g.level;
    };
    /** @param {number} n */
    const share = (n) => (run && total && n ? 0.25 + 0.65 * Math.sqrt(n / total) : 0);
    set("cpu", run ? 0.6 : 0);
    set("ram", share(ramN));
    set("u7", share(t.u7));
    set("u35", share(t.u35));
    set("font", share(t.font));
    // the latch: a flash for each write, fading
    const latch = this.glow.latch;
    latch.level = run && t.latch ? 1 : Math.max(0, latch.level - dt * 3);
    for (const x of latch.mats) x.emissiveIntensity = latch.level;
    set("chargen", m.powered && (m.text || m.mixed) ? 0.5 : 0);
  }

  // ---- each frame -------------------------------------------------------------------------------

  /** @private @param {number} dt */
  tick(dt) {
    const s = this.system;
    const down = s.keysDown();
    for (const k of this.keys) {
      const target = down.has(k.id) ? 1 : k.id === "capslock" && s.keyboard.caps ? k.drop : 0;
      k.down += Math.sign(target - k.down) * Math.min(Math.abs(target - k.down), dt / 0.05);
      k.obj.position.copy(k.base).addScaledVector(k.axis, k.down * k.travel);
    }
    const on = s.machine.powered;
    for (const m of this.lampMats) {
      m.emissive.set(on ? LAMP_RED : 0x000000);
      m.emissiveIntensity = on ? LAMP_GLOW : 0;
    }
    const a = this.rocker.userData.axis ?? [0, 1, 0];
    this.rocker.quaternion.copy(this.rockerRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(a[0], a[1], a[2]), on ? THREE.MathUtils.degToRad(this.rocker.userData.on_deg ?? 24) : 0));
    // the TV: its lamp, its button pressed a moment when its power changes, its knobs
    const tvOn = s.tv.on;
    if (tvOn !== this.tvShown) {
      this.tvShown = tvOn;
      this.tvPress = BUTTON_S;
    }
    for (const m of this.tvLampMats) {
      m.emissive.set(tvOn ? LAMP_RED : 0x000000);
      m.emissiveIntensity = tvOn ? LAMP_GLOW : 0;
    }
    this.tvPress = Math.max(0, this.tvPress - dt);
    // the button goes in: -z in glTF's frame, where +z is towards the front
    this.tvButton.position.copy(this.tvButtonRest).add(new THREE.Vector3(0, 0, this.tvPress > 0 ? -0.002 : 0));
    for (const w of /** @type {Knob[]} */ (["brightness", "colour"])) {
      const k = this.knobs[w];
      // facing the viewer (+z), clockwise is a negative turn about z; 270 degrees end to end
      k.obj.quaternion.copy(k.rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(s.tv[w] - 0.5) * Math.PI * 1.5));
    }
    if (this.flapF !== this.flapTarget) {
      this.flapF += Math.sign(this.flapTarget - this.flapF) * Math.min(Math.abs(this.flapTarget - this.flapF), dt / FLAP_S);
      this.flap.quaternion.copy(this.flapRest).multiply(new THREE.Quaternion().setFromAxisAngle(this.flapAxis, THREE.MathUtils.degToRad(this.flapF * (this.flap.userData.max_deg ?? 80))));
    }
    this.placeUnits((u) => s.motion.get(u)?.f ?? 0);
    this.ribbon.update(s.motion.get("keyboard")?.f ?? 0);
    this.ghostTvInTheWay();
    if (this.inside) this.tickGlow(dt);
  }

  /** Shows the machine's picture on the TV. @param {import("./tv.js").Picture} p */
  showPicture(p) {
    this.tv.show(p);
  }

  /** @private Each unit out by its share, 0 in .. 1 out (the lid and the board along their paths). @param {(unit: string) => number} fOf */
  placeUnits(fOf) {
    for (const o of [this.lid, this.board]) {
      const f = fOf(o === this.lid ? "case.lid" : "board.main");
      o.position.copy(/** @type {THREE.Vector3} */ (this.rest.get(o))).add(along(o.userData.path ?? [], f * f * (3 - 2 * f)));
    }
    this.kbMotion.pose(fOf("keyboard"));
  }

  /** @private The TV as glass while it stands between the camera and the computer. */
  ghostTvInTheWay() {
    const cam = this.viewer.camera.position;
    const far = cam.distanceTo(this.computerCentre);
    const ray = new THREE.Ray(cam.clone(), this.computerCentre.clone().sub(cam).normalize());
    const hit = new THREE.Vector3();
    const inWay = this.tvBox.containsPoint(cam) || (ray.intersectBox(this.tvBox, hit) !== null && hit.distanceTo(cam) < far);
    if (inWay === this.tvGhosted) return;
    this.tvGhosted = inWay;
    ghost(this.tvParts, inWay, 0.08);
  }

  /** The Inside view: the lid and the keyboard as glass, or solid. @param {boolean} on */
  setInside(on) {
    if (on === this.inside) return;
    this.inside = on;
    ghost([this.lid, this.keyboard], on);
    // out of Inside, the chips dark again
    if (!on) for (const g of Object.values(this.glow)) for (const x of g.mats) x.emissiveIntensity = g.level = 0;
  }

  /** As found (the plastic yellowed) or as new. @param {boolean} found */
  setFinish(found) {
    for (const [m, nu, old] of this.finishMats) m.color.copy(found ? old : nu);
    for (const [m, c] of this.stickerMats) m.color.copy(c).multiply(found ? this.yellowing : new THREE.Color(1, 1, 1));
  }

  // ---- the pointer ------------------------------------------------------------------------------

  /** @private The first visible, solid part under a point. @param {{ clientX: number, clientY: number }} e */
  pick(e) {
    return this.hit(e.clientX, e.clientY)?.object ?? null;
  }

  /**
   * @private The first drawn part under a point of the page, and how far away it is.
   * @param {number} x @param {number} y
   * @param {THREE.Object3D} [within] only this node's parts
   */
  hit(x, y, within = this.root) {
    const r = this.viewer.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.viewer.camera);
    return ray.intersectObject(within, true).find((h) => shown(h.object) && !h.object.userData.ghost) ?? null;
  }

  /**
   * @private Whether a point of the page lies between the keys: on the keyboard's plate or the
   * lid's surround, with a key within KEY_NEAR_M of it. There the pointer is aiming at the keys,
   * and the plate's or the lid's label is in the way.
   * @param {number} x @param {number} y
   * @param {THREE.Intersection} h what is under it
   */
  amongKeys(x, y, h) {
    if (this.up(h.object, (o) => o.userData.key_id !== undefined)) return false;
    if (!this.under(h.object, "keyboard") && !this.under(h.object, "case.lid")) return false;
    const cam = /** @type {THREE.PerspectiveCamera} */ (this.viewer.camera);
    const height = this.viewer.canvas.getBoundingClientRect().height;
    const px = (KEY_NEAR_M * height) / (2 * h.distance * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const near = this.hit(x + px * Math.cos(a), y + px * Math.sin(a), this.keyboard);
      if (near && this.up(near.object, (o) => o.userData.key_id !== undefined)) return true;
    }
    return false;
  }

  /** @private The nearest ancestor (or itself) that passes a test. @param {THREE.Object3D | null} o @param {(o: THREE.Object3D) => boolean} test */
  up(o, test) {
    while (o && !test(o)) o = o.parent;
    return o;
  }

  /** @private Whether o is the named node or inside it. @param {THREE.Object3D | null} o @param {string} name */
  under(o, name) {
    return !!this.up(o, (x) => x.name === nodeName(name));
  }

  /** @private The unit a part belongs to, if it comes out. @param {THREE.Object3D | null} o */
  unitAt(o) {
    const top = this.up(o, (x) => this.unitOf.has(x));
    return top ? /** @type {string} */ (this.unitOf.get(top)) : null;
  }

  /** @private What a part is, and what a click on it does. @param {THREE.Object3D | null} o @returns {Hover | null} */
  describe(o) {
    const named = this.up(o, (x) => !!x.userData.label_en);
    if (!named) return null;
    const label = String((this.lang === "zh" && named.userData.label_zh) || named.userData.label_en);
    const node = /** @type {string} */ (named.userData.name ?? named.name);
    const s = this.system;
    const unit = this.unitAt(o);
    /** @type {Hover["action"]} */
    let action = "none";
    if (named.userData.key_id !== undefined) action = "press";
    else if (this.under(o, "switch.power") || this.under(o, "tv.power") || this.under(o, "case.flap")) action = "toggle";
    else if (named.userData.knob !== undefined) action = "turn";
    else if (unit && !s.machine.powered) action = s.motion.get(unit)?.target ? "putBack" : "takeOut";
    return { node, label, action, unit: !!unit };
  }

  /** @private */
  bindPointer() {
    const canvas = this.viewer.canvas;
    const s = this.system;
    /** @type {string | null} */
    let held = null;
    /** @type {{ which: Knob, x: number, y: number, v: number } | null} */
    let turning = null;
    let downAt = { x: 0, y: 0, button: 0 };
    /** @param {THREE.Object3D | null} o @returns {Knob | null} */
    const knobAt = (o) => /** @type {Knob | null} */ (this.up(o, (x) => x.userData.knob !== undefined)?.userData.knob ?? null);
    canvas.addEventListener("pointerdown", (e) => {
      downAt = { x: e.clientX, y: e.clientY, button: e.button };
      if (e.button !== 0) return;
      const o = this.pick(e);
      const keyObj = this.up(o, (x) => x.userData.key_id !== undefined);
      const knob = knobAt(o);
      if (keyObj) {
        this.viewer.controls.enabled = false;
        const id = keyObj.userData.key_id;
        s.holds.sync(e);
        if (s.keyDown(id, "pointer")) this.on.heldModifier?.(id);
        else held = id;
      } else if (knob) {
        this.viewer.controls.enabled = false;
        turning = { which: knob, x: e.clientX, y: e.clientY, v: s.tv[knob] };
      }
    });
    // a Mac's Ctrl-click is the browser's right click: no menu over the machine
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointermove", (e) => {
      if (turning) {
        s.setKnob(turning.which, turning.v + (e.clientX - turning.x - (e.clientY - turning.y)) / 200);
        return;
      }
      if (e.pointerType !== "mouse" || e.buttons) {
        this.on.hover?.(null, 0, 0);
        return;
      }
      const at = this.hit(e.clientX, e.clientY);
      const h = at && !this.amongKeys(e.clientX, e.clientY, at) ? this.describe(at.object) : null;
      canvas.style.cursor = h && h.action !== "none" ? (h.action === "turn" ? "grab" : "pointer") : "";
      this.on.hover?.(h, e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => this.on.hover?.(null, 0, 0));
    canvas.addEventListener(
      "wheel",
      (e) => {
        const knob = knobAt(this.pick(e));
        if (!knob) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        s.setKnob(knob, s.tv[knob] - Math.sign(e.deltaY) * 0.05);
      },
      { capture: true, passive: false },
    );
    const release = () => {
      this.viewer.controls.enabled = true;
      if (turning) {
        turning = null;
        return true;
      }
      if (held) {
        const id = held;
        held = null;
        // a moment down at least, so a quick tap is seen and read
        setTimeout(() => s.keyUp(id, "pointer"), 60);
        return true;
      }
      return false;
    };
    canvas.addEventListener("pointerup", (e) => {
      if (release()) return;
      if (downAt.button !== 0 || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      this.click(this.pick(e));
    });
    canvas.addEventListener("pointercancel", () => release());
    canvas.addEventListener("dblclick", (e) => {
      const o = this.pick(e);
      const knob = knobAt(o);
      if (knob) return void s.resetKnob(knob);
      if (this.under(o, "tv.screen")) return void this.on.screenDoubleClick?.();
      // not on what a click works (a key, a switch, the flap, a unit that comes out while the
      // computer is off): there the two clicks have already done their work
      if (!o || this.describe(o)?.action !== "none") return;
      // nor between the keys, where a double-click is two missed keys
      const at = this.hit(e.clientX, e.clientY);
      if (at && this.amongKeys(e.clientX, e.clientY, at)) return;
      if (this.under(o, "tv")) this.on.partDoubleClick?.("tv");
      else if (this.under(o, "keyboard") || this.up(o, (x) => x.name.startsWith(nodeName("case.")))) this.on.partDoubleClick?.("computer");
    });
  }

  /** @private A click (not a drag) on a part. @param {THREE.Object3D | null} o */
  click(o) {
    const s = this.system;
    if (!o || this.up(o, (x) => x.userData.key_id !== undefined) || this.under(o, "tv.screen")) return;
    if (this.under(o, "switch.power")) return void s.power(!s.machine.powered);
    if (this.under(o, "tv.power")) return void s.tvPower(!s.tv.on);
    if (this.under(o, "case.flap") && !this.inside) {
      this.flapTarget = this.flapTarget ? 0 : 1;
      return void s.say({ key: this.flapTarget ? "flap.open" : "flap.closed" });
    }
    const unit = this.unitAt(o);
    if (unit && !s.machine.powered) return void s.toggleUnit(unit);
    const h = this.describe(o);
    if (h) this.on.info?.(h.label);
  }
}

/** Drawn: it and every parent visible. @param {THREE.Object3D} o */
function shown(o) {
  for (let x = /** @type {THREE.Object3D | null} */ (o); x; x = x.parent) if (!x.visible) return false;
  return true;
}

/**
 * A point along a unit's path (the model's extras "path": points in mm, glTF's frame), f 0..1.
 * @param {number[]} flat
 * @param {number} f
 */
function along(flat, f) {
  /** @type {THREE.Vector3[]} */
  const pts = [];
  for (let i = 0; i < flat.length; i += 3) pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).multiplyScalar(0.001));
  if (pts.length < 2) return new THREE.Vector3();
  const seg = pts.length - 1;
  const t = f * seg;
  const i = Math.min(seg - 1, Math.floor(t));
  return pts[i].clone().lerp(pts[i + 1], t - i);
}
