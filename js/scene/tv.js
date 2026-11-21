// SPDX-License-Identifier: Apache-2.0
//
// The TV's screen in 3D: the machine's picture (js/sim/video.js) drawn on a canvas, the
// TV's knobs applied (js/scene/knobs.js), as the emissive map of the model's tube glass
// (tv.screen, UV-mapped 0..1 across it, v = 0 at the top). Grey-green glass when off, darker
// when lit, its reflections turned down while it shows a picture; with no signal (the
// computer off), the lit glass alone. Drawn again only when the picture or a knob changed.

import * as THREE from "three";
import { GLASS, knobTable } from "./knobs.js";

/** The canvas: 640 x 480, the screen's 4:3. */
const W = 640;
const H = 480;
/** Where the picture lies on the glass's canvas: 85 % across, 4:3, the rest the tube's overscan. */
const PIC = { x: 48, y: 36, w: 544, h: 408 };

/**
 * @typedef {object} Picture what the TV shows
 * @property {boolean} on the TV's power
 * @property {boolean} signal the computer's power: a picture to show
 * @property {Uint8ClampedArray} pixels the video's RGBA picture
 * @property {number} width @property {number} height its size
 * @property {readonly number[]} border the colour round the picture
 * @property {number} brightness @property {number} colour the knobs, 0..1
 * @property {import("../sim/video.js").Display} display the set: its glass (knobs.js, GLASS)
 */

export class TvScreen {
  /**
   * @param {THREE.Object3D} glass the model's tv.screen (a mesh, or a group holding it)
   */
  constructor(glass) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext("2d"));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshPhysicalMaterial({
      color: rgb(GLASS.colour.off),
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.25,
      emissive: 0xffffff,
      emissiveMap: this.texture,
      emissiveIntensity: 0,
    });
    glass.traverse((o) => {
      if (/** @type {THREE.Mesh} */ (o).isMesh) /** @type {THREE.Mesh} */ (o).material = this.material;
    });
    /** @private the machine's picture at its own size */
    this.frame = document.createElement("canvas");
    /** @private @type {ImageData | null} */
    this.frameData = null;
    /** @private the picture last drawn, and its settings @type {Uint8ClampedArray | null} */
    this.last = null;
    /** @private */
    this.lastKey = "";
  }

  /** Shows a picture, if anything changed. @param {Picture} s */
  show(s) {
    const m = this.material;
    // the material's colour under the 3D lights: the lit glass a little lighter than the
    // flat view's, which shows it as it is
    const g = GLASS[s.display];
    m.color.set(s.on ? rgb(g.lit.map((v) => Math.min(255, v + 20))) : rgb(g.off));
    m.emissiveIntensity = s.on ? 1.6 : 0;
    // lit, the glass's reflections are turned down: their grey sheen would wash over the text
    m.clearcoat = s.on ? 0.15 : 0.5;
    m.envMapIntensity = s.on ? 0.08 : 0.25;
    if (!s.on) {
      this.last = null;
      return;
    }
    const key = `${s.signal}|${s.display}|${s.brightness}|${s.colour}|${s.border.join(",")}`;
    if (this.last && this.lastKey === key && (!s.signal || samePixels(this.last, s.pixels))) return;
    this.lastKey = key;
    if (!this.last || this.last.length !== s.pixels.length) this.last = new Uint8ClampedArray(s.pixels.length);
    this.last.set(s.pixels);
    const c = this.ctx;
    const t = knobTable(s.brightness, s.colour);
    if (!s.signal) {
      const [r, g, b] = t(4, 5, 5);
      c.fillStyle = `rgb(${r}, ${g}, ${b})`;
      c.fillRect(0, 0, W, H);
      this.texture.needsUpdate = true;
      return;
    }
    if (!this.frameData || this.frameData.width !== s.width) {
      this.frame.width = s.width;
      this.frame.height = s.height;
      this.frameData = new ImageData(s.width, s.height);
    }
    const out = this.frameData.data;
    const px = s.pixels;
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = t(px[i], px[i + 1], px[i + 2]);
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
    /** @type {CanvasRenderingContext2D} */ (this.frame.getContext("2d")).putImageData(this.frameData, 0, 0);
    const [br, bg, bb] = t(s.border[0], s.border[1], s.border[2]);
    c.fillStyle = `rgb(${br}, ${bg}, ${bb})`;
    c.fillRect(0, 0, W, H);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.frame, PIC.x, PIC.y, PIC.w, PIC.h);
    this.texture.needsUpdate = true;
  }
}

/** A colour for three.js from sRGB bytes. @param {readonly number[]} c */
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Whether two pictures are the same, 32 bits at a time. @param {Uint8ClampedArray} a @param {Uint8ClampedArray} b */
export function samePixels(a, b) {
  if (a.length !== b.length) return false;
  const x = new Uint32Array(a.buffer, a.byteOffset, a.length >> 2);
  const y = new Uint32Array(b.buffer, b.byteOffset, b.length >> 2);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
