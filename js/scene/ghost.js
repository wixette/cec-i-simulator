// SPDX-License-Identifier: Apache-2.0
//
// Ghosting a part of the model: its meshes drawn faint and see-through, and passed over by
// clicks (userData.ghost), so that what is behind or inside shows: the Inside view's lid and
// keyboard, and the TV when it stands between the camera and the computer.

import * as THREE from "three";

/** The solid materials of the meshes ghosted now. @type {Map<THREE.Mesh, THREE.Material | THREE.Material[]>} */
const solid = new Map();

/**
 * Ghost the objects (and all below them), or make them solid again.
 * @param {THREE.Object3D[]} objects @param {boolean} on @param {number} [opacity]
 */
export function ghost(objects, on, opacity = 0.14) {
  for (const o of objects) {
    o.traverse((x) => {
      const m = /** @type {THREE.Mesh} */ (x);
      if (!m.isMesh) return;
      if (on) {
        if (solid.has(m)) return;
        solid.set(m, m.material);
        const faint = (/** @type {THREE.Material} */ mat) => {
          const g = mat.clone();
          g.transparent = true;
          g.opacity = opacity;
          g.depthWrite = false;
          return g;
        };
        m.material = Array.isArray(m.material) ? m.material.map(faint) : faint(m.material);
        m.castShadow = false;
        m.userData.ghost = true;
      } else if (solid.has(m)) {
        m.material = /** @type {THREE.Material} */ (solid.get(m));
        solid.delete(m);
        m.castShadow = true;
        m.userData.ghost = false;
      }
    });
  }
}
