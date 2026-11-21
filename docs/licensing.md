# Licensing and attribution

## Our own work

| What | Licence |
|---|---|
| Code: JavaScript, CSS, HTML, the Blender and generator scripts, configuration | **Apache-2.0** |
| Content: docs, design and research notes, `model/params/`, the 3D model, the stickers' artwork, the logo, the photographs, the screenshots | **CC BY-SA 4.0** |

The repository follows the [REUSE](https://reuse.software) specification. `REUSE.toml` sets these defaults and lists every exception, and the licence texts are in `LICENSES/`. CI runs `reuse lint`.

## Third-party material

- **Vendored libraries** in `vendor/`, each with its own licence file, copied unchanged from npm: three.js (MIT), the Roboto Flex font (SIL Open Font License 1.1), and the Material Symbols icons (Apache-2.0), gathered into one module as they are.
- **The ROMs** in `roms/` are not under any licence of ours: their copyright is the CEC-I's makers' (`LicenseRef-HistoricalROM`). [`roms/NOTICE`](../roms/NOTICE) says where they came from and offers to remove them on request (design/decisions.md, D2).
- **The fonts of the 3D model** in `model/assets/fonts/`: subsets of Noto Sans SC and Noto Serif SC, and of Arimo, all under the SIL Open Font License 1.1, which is kept beside them.
- **Tom Harte's SingleStepTests** (MIT): a sample of its cases is in `tests/data/harte6502-sample.json`; the rest is fetched by `pnpm test:6502` and not committed.
- **The manuals** are not copied here. They are transcribed in the [cec-i-docs](https://github.com/wixette/cec-i-docs) project, under its own terms, and linked from the page and the docs; what this repository says about the machine is written in its own words.

Each third-party path gets its own annotation in `REUSE.toml`, and its licence text goes in `LICENSES/`.

"CEC-I" and 中华学习机 name the machine simulated. This project is not affiliated with the CEC-I's designers or makers. The 凯歌 (Kaige) lettering on the 3D model's nameplate is drawn from a font, not the maker's logo.
