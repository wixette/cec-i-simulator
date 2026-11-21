// SPDX-License-Identifier: Apache-2.0
//
// LOGO (design/v0.0.3.md, P1): the machine's own LOGO, started with LG from BASIC. A procedure
// is typed in its editor, which TO opens and Ctrl-C closes, defining all that was typed.

/** @typedef {import("../sim/samples.js").Sample} Sample */

/** @type {Sample[]} */
export const LOGO = [
  {
    id: "kaleidoscope",
    section: "logo",
    mode: "logo",
    text: `TO SHAPE :SIZE :SIDES
REPEAT :SIDES [FD :SIZE RT 360 / :SIDES]
END
TO RING :SIZE :SIDES :FAR
REPEAT 8 [PU FD :FAR PD SHAPE :SIZE :SIDES PU BK :FAR RT 45]
END
TO PICTURE
CS HT .DEPOSIT 49328 16
REPEAT 6 [PC 1 + RANDOM 5 RING 8 + RANDOM 30 3 + RANDOM 4 RANDOM 60]
END
TO KALEIDOSCOPE
FULLSCREEN
REPEAT 50 [PICTURE WAIT 180]
TEXTSCREEN
END`,
    run: "KALEIDOSCOPE\n",
  },
];
