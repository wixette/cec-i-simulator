// SPDX-License-Identifier: Apache-2.0
//
// The theme's tokens (css/theme.css) for what is drawn by script: the TV's glass in 3D
// (docs/ui-design.md, P11).

/** The tokens, by name in camel case: --glass-off is glassOff. */
export function tokens() {
  const css = getComputedStyle(document.documentElement);
  /** @param {string} name @param {string} fallback */
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    glassOff: get("--glass-off", "#4b5856"),
    glassOn: get("--glass-on", "#2a3d39"),
  };
}

/** @typedef {ReturnType<typeof tokens>} Tokens */
