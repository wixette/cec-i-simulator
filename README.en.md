<p align="center"><img src="images/logo.svg" alt="CEC-I Simulator logo" width="96"></p>

# CEC-I Simulator · 中华学习机模拟器

[![Tests](https://github.com/wixette/cec-i-simulator/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/cec-i-simulator/actions/workflows/test.yml)

**The CEC-I 中华学习机 (China Educational Computer) of 1987, in 3D, in your browser.** Switch it on, write BASIC, type Chinese, and open it up to see how an 8-bit computer shows thousands of Chinese characters.

**[▶ Try it online](https://wixette.github.io/cec-i-simulator/)**: nothing to install, on a computer or a phone, in English and Simplified Chinese. ([中文说明](README.md))

![The simulator: the CEC-I and its TV in 3D, the screen showing a BASIC program's Chinese output, the Start tab below](screenshots/app.jpg)

> A pre-release (v0.0.2). Below the machine, four instruments show how it works: the CPU and memory, the screen as memory, a Chinese character's path from the font chips to the screen, and the keyboard's matrix. Programs, lessons and the cassette recorder are still to come ([roadmap](design/roadmap.md)).

## What was the CEC-I?

In 1984 Deng Xiaoping said that the popularisation of computers should start with children. In answer, a design group led by Tsinghua University made the **CEC-I**, the China Educational Computer, launched in 1987: an Apple IIe compatible built into one box with its keyboard, using a home TV as its screen and a cassette recorder to keep programs, for about 960 yuan. In school computer rooms across China, students wrote their first programs on it.

Its own idea is Chinese. A computer of the time knew 96 letters and signs; the CEC-I carries the whole national character set, GB 2312's 7,445 characters, as 16 × 16 dots in two font chips on its main board, and a Chinese system that starts at the press of a key, with no disk.

This simulator is that machine, part for part:

| | The CEC-I | The simulator |
|---|---|---|
| Processor | 6502 at about 1.02 MHz | the same, every instruction's cycles exact; passes all 1.51 million SingleStepTests cases |
| ROM | the system ROM (monitor, CEC-BASIC, LOGO), the Chinese system, two font chips, the character generator, the keyboard ROM | the full set of a working machine ([roms/NOTICE](roms/NOTICE)) |
| RAM | 64 KB (48 KB and the language card's 16 KB), no auxiliary RAM | the same |
| Chinese | all 7,445 characters of GB 2312; pinyin and 区位 (quwei) input | the same, its own Chinese system running |
| Display | a TV or a monitor: 40 × 24 text, lo-res and hi-res colour graphics | a colour TV of the 1980s; or a black-and-white TV, or a green monitor |
| Sound | a speaker, the `MUSIC` command | the same |
| Not here yet | the cassette recorder, disk drive and printer | |

## Your first minutes

1. **Open the simulator.** The computer and the TV are on: `ZHONG HUA XUE XI JI`, `VERSION 1.1`, then BASIC's prompt `]`.
2. **Type** `PRINT "HELLO"` and press Enter.
3. **Press 中文** (Page Up on your keyboard, or Alt-Z): the Chinese system starts. 西文 (Page Down, or Alt-X) goes back.
4. **Write Chinese:** Programs ▸ Type in, paste a BASIC program with Chinese in it, and Type it in. The simulator types it on the machine's keys, the Chinese through its own 区位 input.
5. **Open it up:** switch it off, and choose Taken apart from the 3D views.

**Your keyboard is the CEC-I's.** Letters, digits and signs where they are; its own keys:

| The CEC-I | Your keyboard | Or |
|---|---|---|
| 中文 | Page Up | Alt-Z |
| 西文 | Page Down | Alt-X |
| F1–F5 | F1–F5 | Alt-1 … Alt-5 |
| Quit | F6 | Alt-Q |
| Test | End | Alt-T |
| Reset | F12 | Alt-R |
| ◁ | Backspace | ← |

Ctrl-Reset is Ctrl-F12. On a phone, switch to 2D and type on the drawn keyboard.

The machine's four books are transcribed (in Chinese) in the [cec-i-docs](https://github.com/wixette/cec-i-docs) project.

---

## For developers

There is nothing to build. Serve the folder over HTTP:

```
git clone https://github.com/wixette/cec-i-simulator.git
cd cec-i-simulator
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. With Node.js and pnpm:

```
pnpm install
pnpm check            # the unit tests, the strict type check and the reference check (what CI runs)
pnpm test:browser     # the page itself in a headless Chrome
```

More: [development](docs/development.md), [conventions](docs/conventions.md), [UI design](docs/ui-design.md), [the machine's decisions](design/decisions.md), [roadmap](design/roadmap.md), [the 3D model](model/README.md), [how it works and what was measured](research/README.md), [contributing](CONTRIBUTING.md), [privacy](docs/privacy.md).

## Licences

- The code is under the [Apache License 2.0](LICENSE).
- The 3D model, the docs, the photographs and the research notes are under [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt).
- The ROMs in `roms/` are not ours: their copyright is the machine's makers'. They are carried as historical artifacts; [roms/NOTICE](roms/NOTICE) says where they came from, and offers to remove them on request.
- Third-party material keeps its own licence: three.js (MIT), the fonts (OFL 1.1), the icons (Apache-2.0). See [docs/licensing.md](docs/licensing.md) and `REUSE.toml`.

"CEC-I" and 中华学习机 name the machine simulated. This project is not affiliated with its designers or makers.

## Credits

- [cec-i-docs](https://github.com/wixette/cec-i-docs): the CEC-I's four books, transcribed, the simulator's main source.
- MAME's CEC-I driver and ROM set, checked against.
- Tom Harte's [SingleStepTests](https://github.com/SingleStepTests/65x02), for the 6502.
- [three.js](https://threejs.org/), and the Noto Sans SC and Noto Serif SC fonts.
- The page follows the author's [TRS-80 Simulator](https://github.com/wixette/trs-80-simulator).
