// SPDX-License-Identifier: Apache-2.0
//
// The 2D keyboard's keys, drawn from the 3D model itself: the model's keycaps
// rendered once straight down onto the plate, lit evenly from above, into a picture the 2D
// view lays over its case. So the legends (their fonts, sizes and places as on the real
// keys), the arrow keys' triangles, the caps' shapes and corners, the gaps between
// them and the Return key are the 3D view's exactly. Rendered again when the finish changes.

import * as THREE from "three";

/** Picture pixels a millimetre. */
const BAKE_PX_MM = 10;

/**
 * @param {THREE.Object3D} keyboard the model's keyboard node: its keys are its children with
 *   userData.key_id, in its frame x = across (m), z = -(front to back) (m), y up from the plate
 * @param {string} [keyColour] the keycaps' colour as the 3D view renders them (sRGB), else their material's
 * @returns {{ canvas: HTMLCanvasElement, pxPerMm: number, x0: number, y1: number }} the picture,
 *   and where its top-left corner is in the keyboard's flat frame (model/params/keyboard.json, mm)
 */
export function bakeKeys(keyboard, keyColour) {
  const scene = new THREE.Scene();
  const box = new THREE.Box3();
  for (const k of keyboard.children) {
    if (k.userData.key_id === undefined) continue;
    const c = k.clone(true);
    c.traverse((o) => {
      const m = /** @type {THREE.Mesh} */ (o);
      if (!m.isMesh) return;
      // a matte copy of each material in its colour now: even, no highlights
      // the keycaps in the colour given (as the 3D view shows them under its lights), the rest as they are
      const flat = (/** @type {THREE.Material} */ mat) => new THREE.MeshLambertMaterial({ color: keyColour && mat.name === "key_tan" ? new THREE.Color(keyColour) : /** @type {THREE.MeshStandardMaterial} */ (mat).color });
      m.material = Array.isArray(m.material) ? m.material.map(flat) : flat(m.material);
    });
    scene.add(c);
    box.expandByObject(c);
  }
  // from above: the caps' tops at their own colour, their sloping sides a little darker (three.js's
  // lights are physical: a Lambert surface under an intensity of pi shows its own colour)
  scene.add(new THREE.AmbientLight(0xffffff, 0.72 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI);
  sun.position.set(-0.2, 1, 0.35);
  scene.add(sun);
  const pad = 0.002;
  const x0 = box.min.x - pad;
  const x1 = box.max.x + pad;
  const z0 = box.min.z - pad; // the back (json y largest)
  const z1 = box.max.z + pad;
  const w = Math.round((x1 - x0) * 1000 * BAKE_PX_MM);
  const h = Math.round((z1 - z0) * 1000 * BAKE_PX_MM);
  const cam = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 0.001, 1);
  cam.position.set(0, 0.5, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  // the camera looks down -y with -z up: its right is +x, its top is -z (the back)
  cam.left = x0;
  cam.right = x1;
  cam.top = -z0;
  cam.bottom = -z1;
  cam.updateProjectionMatrix();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.render(scene, cam);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d")).drawImage(renderer.domElement, 0, 0);
  renderer.dispose();
  renderer.forceContextLoss();
  scene.traverse((o) => {
    const m = /** @type {THREE.Mesh} */ (o);
    if (m.isMesh) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
  });
  return { canvas, pxPerMm: BAKE_PX_MM, x0: x0 * 1000, y1: -z0 * 1000 };
}
