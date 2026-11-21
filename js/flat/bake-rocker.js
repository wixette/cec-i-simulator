// SPDX-License-Identifier: Apache-2.0
//
// The 2D view's power switch, drawn from the 3D model's rocker: the rocker
// rendered in its two positions from above (as the 2D view looks), a little from the left, the same
// shape, the same white pit, the same light, so the 2D switch reads as the 3D one: on, the end
// with the pit is pressed in and the back end stands out; off, the other way round.

import * as THREE from "three";

const PX_MM = 9;

/**
 * @param {THREE.Object3D} rocker the model's switch.power (turns about userData.axis; on is
 *   userData.on_deg from its off pose)
 * @returns {{ off: HTMLCanvasElement, on: HTMLCanvasElement, pxPerMm: number }} each picture
 *   with the front at the bottom, the case's side at the right
 */
export function bakeRocker(rocker) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // only what stands out of the case's left side (the rest is inside the wall, hidden in 3D)
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)];
  /** @param {boolean} on */
  const shot = (on) => {
    const scene = new THREE.Scene();
    const c = rocker.clone(true);
    c.position.set(0, 0, 0);
    const a = rocker.userData.axis ?? [0, 1, 0];
    c.quaternion.copy(rocker.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(a[0], a[1], a[2]), on ? THREE.MathUtils.degToRad(rocker.userData.on_deg ?? 24) : 0));
    scene.add(c);
    // the 3D view's light: from above, the left and the front, with a soft fill
    scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x202326, 0.9 * Math.PI));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1 * Math.PI);
    sun.position.set(-0.8, 1.6, 1.0);
    scene.add(sun);
    // seen from above as the 2D keyboard is, tipped 20 degrees towards the left so that the
    // face and its pit show beside the profile; the back at the top of the picture
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 1);
    cam.position.set(-0.1 * Math.sin(Math.PI / 9), 0.1 * Math.cos(Math.PI / 9), 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    // one square frame for both positions, centred on the pivot: 16 mm each way holds the
    // rocker (24 mm long, standing at most 8 mm out)
    const r = 0.016;
    const hw = r;
    cam.left = -hw;
    cam.right = hw;
    cam.top = r;
    cam.bottom = -r;
    cam.updateProjectionMatrix();
    const w = Math.round(2 * hw * 1000 * PX_MM);
    const h = Math.round(2 * r * 1000 * PX_MM);
    renderer.setSize(w, h, false);
    renderer.render(scene, cam);
    // the picture's left half: the pivot, on the wall, at its right edge
    const out = document.createElement("canvas");
    out.width = Math.round(w / 2);
    out.height = h;
    /** @type {CanvasRenderingContext2D} */ (out.getContext("2d")).drawImage(renderer.domElement, 0, 0);
    return out;
  };
  const off = shot(false);
  const on = shot(true);
  renderer.dispose();
  renderer.forceContextLoss();
  return { off, on, pxPerMm: PX_MM };
}
