// SPDX-License-Identifier: Apache-2.0
//
// The TV's two knobs as functions on colour, and the tube's glass for each set, with no
// three.js: for the 3D tube (js/scene/tv.js) and the 2D view (js/flat/flat.js).

/**
 * The tube's glass, unlit and lit, sRGB, for each set (design/decisions.md, D6): a colour TV's
 * and a green monitor's a dark grey-green, as the tubes' glass was; a black-and-white TV's a
 * neutral grey, so that the set reads as black and white at a glance. Lit, the glass reads
 * darker: the eye adapts to the picture.
 * @type {Record<import("../sim/video.js").Display, { off: [number, number, number], lit: [number, number, number] }>}
 */
export const GLASS = {
  colour: { off: [0x4b, 0x58, 0x56], lit: [0x16, 0x24, 0x21] },
  bw: { off: [0x55, 0x55, 0x55], lit: [0x1e, 0x1e, 0x1e] },
  green: { off: [0x4b, 0x58, 0x56], lit: [0x16, 0x24, 0x21] },
};

/**
 * The knobs as a function on a colour. Colour (0..1, 0.75 as set up): the saturation, scaled
 * about the colour's own grey (its luma, BT.601), 0 a black-and-white picture. Brightness
 * (0..1, 0.5 as set up): the gain, and above the middle a lift of the black level, as a set's
 * brightness control raises the picture's black.
 * @param {number} brightness @param {number} colour
 */
export function knobTable(brightness, colour) {
  const sat = colour / 0.75;
  const gain = 0.5 + brightness;
  const lift = Math.max(0, brightness - 0.5) * 70;
  const clamp = (/** @type {number} */ v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  return (/** @type {number} */ r, /** @type {number} */ g, /** @type {number} */ b) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    return [clamp((y + (r - y) * sat) * gain + lift), clamp((y + (g - y) * sat) * gain + lift), clamp((y + (b - y) * sat) * gain + lift)];
  };
}
