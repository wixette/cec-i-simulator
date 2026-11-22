# Conventions

These rules keep the model, the parameters, the code and the tests consistent. Related documents:
- the page's principles: [ui-design.md](ui-design.md)
- licences: [licensing.md](licensing.md)
- working on the simulator: [development.md](development.md)
- the machine's decisions: [../design/decisions.md](../design/decisions.md)

## Units, axes and names

| Where | Unit |
|---|---|
| `model/params/*.json` | millimetres and degrees, each value with its `src` (its source) and `conf` (`meas`, `photo`, `est`, `design`) |
| three.js | metres; the model's build converts once |
| The machine | cycles of the 6502 at 1.0205 MHz (14.31818 MHz × 65 / 912) for time; addresses and bytes as numbers, shown in hex with a `$` ($C0B0) as the manuals write them |

- **The params' frame:** +X runs to the user's right, +Y away from the user, +Z up, in millimetres, the origin at the middle of the case's footprint on the table. The model is exported to glTF's frame (metres, +Y up, the user looking along −Z).
- **Node names** follow `<unit>.<part>[.<index>]`, in lower-case ASCII: `key.zhongwen`, `part.u33`, `tv.knob.colour`. They are the contract between the params, the model and the page, and `tests/model.test.js` holds the page to it ([../model/README.md](../model/README.md)).
- **The machine's names** keep the manuals' spelling: CEC-BASIC, 中文 and 西文, Ctrl-Reset, the chips by their designators (U7, U33, U35).

## Code

- **Plain JavaScript modules, no build step.** Copying the repository to a web server deploys it.
- **Types are JSDoc,** checked strictly by `pnpm typecheck` (TypeScript's checker with `checkJs` and `strict`; nothing is compiled).
- **Vendored libraries:** three.js, Roboto Flex and Material Symbols are copied from `node_modules` into `vendor/` (`tools/vendor.mjs`). The page reaches them through its import map. The ROMs are committed in `roms/`, checked by their hashes.
- **Version stamps:** every local file the page names, and every module in its import map, carries `?v=<version>`. `pnpm stamp` writes them; never edit them by hand.
- **Where code goes:**

  | Folder | Holds | Rule |
  |---|---|---|
  | `js/sim/` | the machine: the 6502, memory and soft switches, video, keyboard, speaker, the disk drive and disk images, the set-up's rules, Chinese text, BASIC listings, the assembler and disassembler, our programs' typing | no DOM, no three.js; runs in Node (sound.js's player aside) |
  | `js/programs/` | our programs: BASIC, machine code as assembly, LOGO | data; no DOM |
  | `js/lessons/` | the lessons: each step's keys, Show me, program and check | data and checks; no DOM |
  | `js/scene/` | the 3D view: viewer, framing, the model's bindings, the TV's screen | three.js |
  | `js/flat/` | the 2D view | DOM |
  | `js/app/` | the page: top bar, stage, strip, dock and its tabs, the lessons' tab, References, status line, About; `files.js`, `markup.js` and `link.js` hold its pure logic, with no DOM, for the tests | DOM |
  | `js/app/tools/` | the four instruments: CPU & Memory, Screen, Chinese, Keyboard | DOM |
  | `js/ui/` | shared components: menu, dialog, tabs, tooltip, icons | DOM |
  | `js/l10n/` | the messages, a file per language | data |

- **Comments say why,** and cite a decision by number (D3, U4) or the source a number comes from.
- **Licence headers:** every JavaScript, CSS and HTML file of ours starts with an SPDX header naming Apache-2.0.
- **Text:** every string a visitor sees is a message key in `js/l10n/en.js`, translated in each other language's file (U11). The machine's own text (the screen, listings, key legends) is data, not a message.
- **Generated files are never edited by hand:** `vendor/material-symbols/icons.js`, `model/params/keyboard.json`, `board.json` and `keyboard_matrix.json` (`model/tools/`), and `model/cec-i.glb` (`pnpm build:model`).

## Tests

- **Node's own runner,** `pnpm test`: `tests/**/*.test.js` and `tools/*.test.mjs`, with `node:assert`. No browser, GPU or network. The full 6502 suite, which downloads about 750 MB once, is opt-in: `pnpm test:6502`.
- **The machine is tested on its own ROMs** against what a real CEC-I does (research/README.md): its banner and beep, its timing, its checksums, its keys' codes, its Chinese.
- **Tests are written from the sources,** not from the code's output. A test's expected value cites its source, or a decision when the value is ours.
- **The browser checks,** `pnpm test:browser`, drive the page in a headless Chrome; they are run locally, the whole set before each release, not in CI ([development.md](development.md)). A logic of the page that needs no DOM goes in a module of its own, so that a unit test can reach it.

## No developer pages

There is one page, `index.html`. Developer options in the address (`?selftest`, `?debug`) are documented in [development.md](development.md) and not linked from the page.

## References

The repository is public. Everything in it must be readable and followable by anyone:
- **Links** stay inside the repository or go to public URLs. A relative link must lead to a file that exists here.
- **No absolute local paths** anywhere.
- **No mention of private material,** such as unpublished repositories or private correspondence.
- **Photographs** are only those cleared for publication, with their metadata removed (`tests/photos.test.js`).
- **Visitor-facing text** names the simulator and the machine, and nothing about how it is developed.

`pnpm check:refs` (`tools/check-refs.mjs`) checks the first three, and CI runs it.
