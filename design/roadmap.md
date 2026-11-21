# The road to 1.0.0

**Agreed:** 2026-11-21. Each release is built on its own branch, `dev-v<x.y.z>`, and reaches `main` by a pull request only when it is ready ([../docs/development.md](../docs/development.md)). Each pre-release is checked by the owner before it is released.

| Release | What it is |
|---|---|
| **v0.0.1** | The machine, on desktop and phone ([v0.0.1.md](v0.0.1.md)): the page's frame after the TRS-80 simulator's, 简体中文 and English, the 3D and 2D views, the working machine (the computer and its TV), Type in, Open and Save a BASIC program |
| **v0.0.2** | Instruments in the dock, showing how it works: the 6502 and memory (registers, disassembly, a memory map, a dump, Pause, Step, Run to, a slow clock); the screen's memory (text, lo-res, hi-res pages, a cell inspector); the keyboard (the matrix and the keyboard ROM); the path of a Chinese character (a string's bytes, the $C0B0 latch and the font window, its 32 bytes, its dots on the hi-res page); Inside's chips lit by their memory traffic |
| **v0.0.3** | Programs of our own, in BASIC, machine code and LOGO, showing what the machine could do: Chinese input and output, lo-res and hi-res colour games, learning, a 1980s word processor and other utilities, music. Each with a test that runs it. The joystick on the visitor's keys |
| **v0.0.4** | Lessons built round those programs, for a class or a self-learner, with teacher notes: write Chinese on an 8-bit machine and find your name's bytes; the screen as memory; the keyboard; machine code |
| **v0.0.5** | The cassette recorder (an unbranded Chinese single-deck recorder, the TRS-80 simulator's recorder logic and Cassette tool, Apple II tape format, `.wav` both ways); Apple II software the visitor brings: files read out of DOS 3.3 `.dsk` images and loaded without a disk drive, and tapes. No disk drive, no printer |
| **v0.0.6** | The page in ten languages, as the TRS-80 simulator's |
| **v1.0.0** | **Feature frozen:** a thorough review of the code, the docs and the resources, and fixes; the README in full, with screenshots; the link format frozen |

## Decided

- **The UI follows the TRS-80 simulator's** (its layout, its components, its theme), adapted to this machine.
- **The ROMs are one machine's set** (design/decisions.md, D2).
- **Photographs:** only the six cleared ones (images/photos/CREDITS.md), their metadata removed.
- **The manuals are linked, not copied:** the [cec-i-docs](https://github.com/wixette/cec-i-docs) project has them, under its own terms.
- **Apple II software is not hosted here**, and 128 KB IIe software (80 columns, double hi-res) will not run: the CEC-I has no auxiliary RAM.
- **No machine state is kept across visits** (D10).

## Where it stands

- **v0.0.1:** released 2026-11-21 as a pre-release ([the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.1)), live at <https://wixette.github.io/cec-i-simulator/>. Checked by the owner; the full 6502 suite, the unit tests and the browser checks pass.
- **v0.0.2:** released 2026-11-21 as a pre-release ([v0.0.2.md](v0.0.2.md), [the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.2)). Checked by the owner; the full 6502 suite, the unit tests and the browser checks pass.
- **v0.0.3:** built on `dev-v0.0.3` ([v0.0.3.md](v0.0.3.md)), waiting for the owner's check.
