// SPDX-License-Identifier: Apache-2.0
//
// The keyboard's flat cable, in two states: folded under the keyboard as the model has it (as
// photographed), and drawn out with the keyboard
// turned over on the table: straight out of the keyboard's plug past the plate's edge, then
// one smooth curve to J9. Hidden while the keyboard moves.

import * as THREE from "three";

/** Points along the ribbon (the model's rest line has the same count). */
const N = 80;
/** How far the drawn-out cable rises straight out of J9 before it curves (m). */
const RISE = 0.02;

/**
 * A cubic Bezier's points, N of them, evenly in its parameter.
 * @param {THREE.Vector3} a @param {THREE.Vector3} b @param {THREE.Vector3} c @param {THREE.Vector3} d
 */
function bezier(a, b, c, d) {
  /** @type {THREE.Vector3[]} */
  const out = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const u = 1 - t;
    out.push(new THREE.Vector3()
      .addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t)
      .addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t));
  }
  return out;
}

/**
 * n points evenly along a polyline.
 * @param {THREE.Vector3[]} pts @param {number} n
 */
function resample(pts, n) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  /** @type {THREE.Vector3[]} */
  const out = [];
  let k = 0;
  for (let q = 0; q < n; q++) {
    const target = (acc[acc.length - 1] * q) / (n - 1);
    while (k < pts.length - 2 && acc[k + 1] < target) k++;
    const t = (target - acc[k]) / Math.max(1e-12, acc[k + 1] - acc[k]);
    out.push(pts[k].clone().lerp(pts[k + 1], Math.min(1, Math.max(0, t))));
  }
  return out;
}

/** The cable's wires and their colours: 26, the last (u near 1, the rear edge) red. */
const WIRES = 26;
/** @type {{ color: THREE.DataTexture, normal: THREE.DataTexture } | null} */
let textures = null;

/**
 * The colour and normal maps across the cable, made once: 32 texels a wire across,
 * 4 along (they repeat along it). Each wire a rounded ridge: its normal tilts across the
 * wire as on a cylinder's top, flattening into the shallow groove between two wires.
 */
function ribbonTextures() {
  if (textures) return textures;
  const per = 32;
  const W = WIRES * per;
  const H = 4;
  const col = new Uint8Array(W * H * 4);
  const nor = new Uint8Array(W * H * 4);
  for (let x = 0; x < W; x++) {
    const wire = Math.floor(x / per);
    const s = ((x % per) + 0.5) / per * 2 - 1;         // -1..1 across one wire
    const red = wire === WIRES - 1;
    // the ridge: a flattened round top; the slope's x part of the normal
    const k = 0.85;
    const nx = Math.max(-0.9, Math.min(0.9, s * k / Math.sqrt(Math.max(0.05, 1 - (s * k) ** 2))));
    const len = Math.hypot(nx, 1);
    const shade = 1 - 0.28 * Math.pow(Math.abs(s), 6);   // darker in the grooves
    const base = red ? [178, 32, 32] : [176, 176, 172];
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 4;
      col.set([Math.round(base[0] * shade), Math.round(base[1] * shade), Math.round(base[2] * shade), 255], o);
      nor.set([Math.round((nx / len * 0.5 + 0.5) * 255), 128, Math.round((1 / len * 0.5 + 0.5) * 255), 255], o);
    }
  }
  const color = new THREE.DataTexture(col, W, H, THREE.RGBAFormat);
  color.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.DataTexture(nor, W, H, THREE.RGBAFormat);
  for (const t of [color, normal]) {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  }
  textures = { color, normal };
  return textures;
}

/** @param {THREE.Vector3[]} pts */
function polylineLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]);
  return s;
}

/**
 * The ribbon between start S (leaving along dS) and end E (entering along -dE, that is,
 * leaving the end plug along dE), as long as `length` if it can be: the handles' length is
 * found by bisection.
 * @param {THREE.Vector3} S @param {THREE.Vector3} dS @param {THREE.Vector3} E @param {THREE.Vector3} dE
 * @param {number} length
 */
function freeShape(S, dS, E, dE, length) {
  let lo = 0;
  let hi = length;
  /** @type {THREE.Vector3[]} */
  let pts = [];
  for (let k = 0; k < 40; k++) {
    const h = (lo + hi) / 2;
    pts = bezier(S, S.clone().addScaledVector(dS, h), E.clone().addScaledVector(dE, h), E);
    if (polylineLength(pts) > length) hi = h;
    else lo = h;
  }
  return pts;
}

export class Ribbon {
  /**
   * @param {THREE.Object3D} root the loaded model
   * @param {THREE.Object3D} cable the model's cable.ribbon node (its rest shape and extras)
   * @param {THREE.Object3D} plug the keyboard's plug (keyboard.cable_plug), with its extras
   */
  constructor(root, cable, plug) {
    this.root = root;
    this.cable = cable;
    this.plug = plug;
    root.updateMatrixWorld(true);
    const flat = /** @type {number[]} */ (cable.userData.ribbon_rest);
    /** the rest line, in the model's root frame */
    this.rest = [];
    for (let i = 0; i < flat.length; i += 3) this.rest.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).applyMatrix4(cable.matrixWorld));
    this.length = cable.userData.ribbon_length / 1000;
    this.width = cable.userData.ribbon_width / 1000;
    this.start = this.rest[0].clone();
    this.startDir = this.rest[1].clone().sub(this.rest[0]).normalize();
    const e = /** @type {number[]} */ (plug.userData.ribbon_end);
    this.endLocal = new THREE.Vector3(e[0], e[1], e[2]);
    this.endDirLocal = new THREE.Vector3(...(/** @type {[number, number, number]} */ (plug.userData.ribbon_end_dir)));
    this.endSideLocal = new THREE.Vector3(...(/** @type {[number, number, number]} */ (plug.userData.ribbon_end_side)));
    this.startSide = new THREE.Vector3(0, 0, -1);
    // the line the drawn-out cable must pass before it turns (root frame, m): past the
    // plate's right edge
    this.riseTo = (cable.userData.ribbon_rise ?? 60) / 1000;
    this.outsideX = (cable.userData.ribbon_outside ?? 188) / 1000;
    // the model's own meshes are replaced by the one built here
    cable.visible = false;
    this.mesh = this.makeMesh();
    /** the current centre line (root frame), for the checks */
    this.line = this.rest.map((p) => p.clone());
    this.update(0);
  }

  /**
   * The ribbon's mesh: its two faces, each a strip across the cable's width (u 0..1 across,
   * v along), and its two thin edges. The 26 wires are drawn by textures, not geometry
   *: a colour map (grey, the last wire red, a shadow in each groove) and a normal
   * map with one rounded ridge per wire, so the light picks out every wire at no cost in
   * triangles.
   */
  makeMesh() {
    const g = new THREE.BufferGeometry();
    const nv = N * 8;                    // per point: top face 2, bottom face 2, two edges 2 each
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    const uv = new Float32Array(nv * 2);
    for (let i = 0; i < N; i++) {
      const v = (i / (N - 1)) * 20;      // the ridges run along it; v only shades nothing
      const us = [0, 1, 1, 0, 0, 0, 1, 1];
      for (let k = 0; k < 8; k++) uv.set([us[k], v], (8 * i + k) * 2);
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    /** @type {number[]} */
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
      const a = 8 * i;
      const b = 8 * (i + 1);
      const quad = (/** @type {number} */ p, /** @type {number} */ q) => idx.push(a + p, b + p, b + q, a + p, b + q, a + q);
      quad(0, 1);   // top face
      quad(2, 3);   // bottom face
      quad(4, 5);   // the u = 0 edge
      quad(6, 7);   // the u = 1 edge
    }
    const e0 = 0;
    const e1 = 8 * (N - 1);
    idx.push(e0, e0 + 2, e0 + 1, e0, e0 + 3, e0 + 2, e1, e1 + 1, e1 + 2, e1, e1 + 2, e1 + 3);
    g.setIndex(idx);
    const { color, normal } = ribbonTextures();
    const mat = new THREE.MeshStandardMaterial({ map: color, normalMap: normal, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
    mat.normalScale.set(1.4, 1.4);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.userData.label_en = this.cable.userData.label_en;
    mesh.userData.name = this.cable.userData.name ?? this.cable.name;
    this.root.add(mesh);
    return mesh;
  }


  /**
   * Reshape for the keyboard's take-apart motion f (0 in place, 1 out and turned over).
   * @param {number} f
   */
  update(f) {
    // two states only: folded with the keyboard in place, drawn out with it
    // turned over on the table; hidden while the keyboard moves
    const state = f <= 0 ? "rest" : f >= 1 ? "out" : "moving";
    this.mesh.visible = state !== "moving";
    if (state === "moving") return;
    this.plug.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert().multiply(this.plug.matrixWorld);
    const E = this.endLocal.clone().applyMatrix4(toRoot);
    const dE = this.endDirLocal.clone().transformDirection(toRoot);
    const sideE = this.endSideLocal.clone().transformDirection(toRoot);
    const line = state === "rest" ? this.rest.map((p) => p.clone()) : this.outShape(E, dE);
    this.line = line;
    this.writeStrip(line, sideE);
  }

  /**
   * The cable drawn out: straight out of the keyboard's plug to the right until
   * it is clear of the plate's edge, then one smooth curve back to J9, leaving J9 upward.
   * @param {THREE.Vector3} E the keyboard plug's end @param {THREE.Vector3} dE out of it
   */
  outShape(E, dE) {
    const S = this.start;
    const lead = Math.max(0.006, this.outsideX - E.x);      // out past the plate's edge
    const P = E.clone().addScaledVector(dE, lead);
    const up = new THREE.Vector3(0, 1, 0);
    // straight up out of J9 first, clear of the case's side wall beside it, then the curve
    const S2 = S.clone().addScaledVector(up, RISE);
    const curve = freeShape(S2, up, P, dE, Math.max(this.length - lead - RISE, S2.distanceTo(P) * 1.05));
    /** @type {THREE.Vector3[]} */
    const rise = [];
    for (let k = 0; k < 6; k++) rise.push(S.clone().lerp(S2, k / 6));
    /** @type {THREE.Vector3[]} */
    const tail = [];
    for (let k = 1; k <= 8; k++) tail.push(P.clone().lerp(E, k / 8));
    return resample([...rise, ...curve, ...tail], N);
  }

  /**
   * The ribbon's sideways direction at each point: carried along the line from
   * the J9 end without twisting (each step turns it only as the line turns), then the twist
   * still needed to meet the keyboard end's direction spread evenly along the ribbon. A plain
   * blend of the two ends' directions passes through zero when they point nearly opposite
   * (the keyboard turned over), and the strip tore there.
   * @param {THREE.Vector3[]} line @param {THREE.Vector3} sideE
   */
  frames(line, sideE) {
    /** @type {THREE.Vector3[]} */
    const tans = line.map((_, i) => line[Math.min(i + 1, N - 1)].clone().sub(line[Math.max(i - 1, 0)]).normalize());
    /** @type {THREE.Vector3[]} */
    const sides = [];
    let s = this.startSide.clone().addScaledVector(tans[0], -this.startSide.dot(tans[0])).normalize();
    sides.push(s.clone());
    const q = new THREE.Quaternion();
    for (let i = 1; i < N; i++) {
      q.setFromUnitVectors(tans[i - 1], tans[i]);
      s = s.clone().applyQuaternion(q);
      s.addScaledVector(tans[i], -s.dot(tans[i])).normalize();
      sides.push(s);
    }
    // the twist left at the end, about the end's tangent, shared out along the ribbon
    const tE = tans[N - 1];
    const want = sideE.clone().addScaledVector(tE, -sideE.dot(tE)).normalize();
    const got = sides[N - 1];
    const ang = Math.atan2(new THREE.Vector3().crossVectors(got, want).dot(tE), got.dot(want));
    // (the twist is taken up in the ribbon's middle, between 30 % and 85 % of its length,
    // where it hangs free, not in the bends by the plugs)
    for (let i = 0; i < N; i++) {
      const u = Math.min(1, Math.max(0, (i / (N - 1) - 0.3) / 0.55));
      const r = new THREE.Quaternion().setFromAxisAngle(tans[i], ang * u * u * (3 - 2 * u));
      sides[i].applyQuaternion(r);
    }
    return sides;
  }

  /** @param {THREE.Vector3[]} line @param {THREE.Vector3} sideE */
  writeStrip(line, sideE) {
    const mesh = this.mesh;
    const pos = /** @type {THREE.BufferAttribute} */ (mesh.geometry.getAttribute("position"));
    const half = 0.00045;
    const sides = this.frames(line, sideE);
    const T = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const w = this.width / 2;
    for (let i = 0; i < N; i++) {
      T.copy(line[Math.min(i + 1, N - 1)]).sub(line[Math.max(i - 1, 0)]).normalize();
      const side = sides[i];
      nrm.crossVectors(T, side).normalize();
      const c = line[i];
      // top (u 0 -> 1), bottom (u 1 -> 0), the u = 0 edge, the u = 1 edge
      const pts = [[-w, half], [w, half], [w, -half], [-w, -half], [-w, -half], [-w, half], [w, half], [w, -half]];
      pts.forEach(([sw, h], k) => {
        pos.setXYZ(8 * i + k, c.x + side.x * sw + nrm.x * h, c.y + side.y * sw + nrm.y * h, c.z + side.z * sw + nrm.z * h);
      });
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();     // for clicks on it in its new shape
    mesh.geometry.computeBoundingBox();
  }
}
