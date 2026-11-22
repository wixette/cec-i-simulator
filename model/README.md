# The 3D model

`cec-i.glb` is the CEC-I and a TV of its time, built by Blender scripts from measured parameters: nothing in it is modelled by hand, so it can be rebuilt and checked.

| File | What |
|---|---|
| `params/machine.json` | every dimension and angle, in mm and degrees, each with its source (`src`) and how it is known (`conf`: measured, from a photograph, estimated, or our design) |
| `params/keyboard.json` | the 69 keys' places and shapes, generated from `machine.json` by `model/tools/make_keyboard.py` |
| `params/keyboard_matrix.json` | each key's place in the keyboard matrix, read from the keyboard ROM U26 by `model/tools/make_matrix.py` |
| `params/board.json` | the main board's parts, read off its photograph by `model/tools/make_board.py` |
| `blender/scripts/build_machine.py` | builds the model from the params (`pnpm build:model`) |
| `blender/scripts/render_previews.py` | check renders, into `blender/out/` (not committed) |
| `assets/stickers/` | the nameplate, the maker's plate and the mains warning, drawn as SVG |
| `assets/fonts/` | the subsets of Noto Sans SC, Noto Serif SC and Arimo the keys and stickers are lettered in (SIL OFL 1.1) |

```
pnpm build:model                  # Blender 4.2 or later, headless; BLENDER names its binary
python3 -I model/tools/make_keyboard.py   # after changing the keyboard in machine.json
```

## The node contract

The page finds the model's parts by name; `tests/model.test.js` fails if one goes missing.

| Node | What the page does with it |
|---|---|
| `case.base`, `case.lid`, `keyboard`, `board.main` | the units; the lid and the board move along their `path` (extras, mm), the keyboard turns over forward on its cable |
| `key.<id>` | each key (`key_id`, `axis`, `travel` in mm; Caps Lock `latching`, `latched_drop`) |
| `switch.power`, `led.power` | the rocker (`axis`, `on_deg`) and the power lamp |
| `case.flap` | the expansion slot's flap (`axis`, `max_deg`) |
| `cable.ribbon`, `keyboard.cable_plug` | the keyboard's flat cable (`ribbon_rest` and its ends), redrawn as the keyboard comes out |
| `tv`, `tv.screen`, `tv.screen_rim`, `tv.power`, `tv.lamp`, `tv.knob.brightness`, `tv.knob.colour` | the TV: the picture is drawn on `tv.screen` (UV 0..1, v = 0 at the top); the knobs turn about their z |
| `part.<ref>` | the main board's parts, by designator (`part.u33`, `part.j9`) |

Every part with a label carries it as `label_en` and `label_zh` (extras): the page shows the one in its language when the pointer rests on it. Materials named in `params/machine.json`, `colours` (the case, the keys, the flap, the feet) are recoloured by the page for *as found*; the stickers' materials (`sticker_*`) yellow with them.
