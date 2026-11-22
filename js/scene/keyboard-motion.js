// SPDX-License-Identifier: Apache-2.0
//
// The keyboard's take-apart motion: lifted straight up first, then
// turned over forward about a line in front of the case, landing upside down on the table.
// Shared by the page and the acceptance checks, so both pose it the same way.

import * as THREE from "three";

/** How far it lifts before it turns (m). */
const LIFT = 0.03;
/** The part of the motion spent lifting (the rest is the turn). */
const LIFT_PART = 0.25;

export class KeyboardMotion {
  /**
   * @param {THREE.Object3D} kbd the keyboard node, at rest
   * @param {number} caseDepthMm the case's depth (model/params/machine.json, case.depth)
   */
  constructor(kbd, caseDepthMm) {
    this.kbd = kbd;
    this.p0 = kbd.position.clone();
    this.q0 = kbd.quaternion.clone();
    const box = new THREE.Box3().setFromObject(kbd);
    // just in front of the lid's front edge, at a height that lands the keycaps on the table
    this.pivot = new THREE.Vector3(0, (box.max.y + LIFT) / 2 + 0.001, caseDepthMm / 2000 + 0.004);
  }

  /**
   * The motion's two phases for f in 0..1 (eased): how far lifted, how far turned (0..1).
   * @param {number} f
   */
  static phases(f) {
    const e = f * f * (3 - 2 * f);
    return { e, lift: Math.min(1, e / LIFT_PART), turn: Math.max(0, (e - LIFT_PART) / (1 - LIFT_PART)) };
  }

  /** @param {number} f */
  pose(f) {
    const { lift, turn } = KeyboardMotion.phases(f);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), turn * Math.PI);
    const p = this.p0.clone();
    p.y += LIFT * lift;
    p.sub(this.pivot).applyQuaternion(q).add(this.pivot);
    this.kbd.position.copy(p);
    this.kbd.quaternion.copy(q).multiply(this.q0);
    this.kbd.updateMatrixWorld(true);
  }
}
