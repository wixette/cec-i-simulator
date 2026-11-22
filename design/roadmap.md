# The road to 1.0.0

**Agreed:** 2026-11-21. Each release is built on its own branch, `dev-v<x.y.z>`, and reaches `main` by a pull request only when it is ready ([../docs/development.md](../docs/development.md)). Each pre-release is checked by the owner before it is released.

| Release | What it is |
|---|---|
| **v0.0.1** | The machine, on desktop and phone ([v0.0.1.md](v0.0.1.md)): the page's frame after the TRS-80 simulator's, 简体中文 and English, the 3D and 2D views, the working machine (the computer and its TV), Type in, Open and Save a BASIC program |
| **v0.0.2** | Instruments in the dock, showing how it works: the 6502 and memory (registers, disassembly, a memory map, a dump, Pause, Step, Run to, a slow clock); the screen's memory (text, lo-res, hi-res pages, a cell inspector); the keyboard (the matrix and the keyboard ROM); the path of a Chinese character (a string's bytes, the $C0B0 latch and the font window, its 32 bytes, its dots on the hi-res page); Inside's chips lit by their memory traffic |
| **v0.0.3** | Programs of our own, in BASIC, machine code and LOGO, showing what the machine could do: Chinese input and output, lo-res and hi-res colour games, learning, a 1980s word processor and other utilities, music. Each with a test that runs it |
| **v0.0.4** | Six short lessons built round those programs and the instruments, for a class or a self-learner: meeting the machine, BASIC, its Chinese system, the screen as memory and LOGO, the keyboard and sound, the processor and machine code (teacher notes and a lesson on your own name's bytes were dropped at the owner's review: little value) |
| **v0.0.5** | Disks and files ([v0.0.5.md](v0.0.5.md)): a disk drive on the CEC-I's own floppy interface, with no 3D model, booting the Apple II disks the visitor brings (`.dsk`, `.do`, `.po`, `.nib`, `.woz`) and saving what is written to them; programs saved with a name; LOGO procedures opened from and saved to files; the Text editor saving on a DOS disk. No cassette recorder (cut at the owner's review: the machine was not sold with one, and few used one), no printer |
| **v0.0.6** | The page in ten languages, as the TRS-80 simulator's ([v0.0.6.md](v0.0.6.md)); translated from English or from the Simplified Chinese, which is itself written in Chinese, not translated (docs/ui-design.md, U11) |
| **v1.0.0** | **Feature frozen** ([v1.0.0.md](v1.0.0.md)): a thorough review of the code, the docs and the resources, and fixes; the README in full, with screenshots, and shot and video tools; the link format frozen; accessibility, browsers, load size; the GitHub page |
| **After v1.0.0** | A joystick on the game port, for the era's own games loaded by the visitor; not needed by our own programs (built in v0.0.3, taken out at the owner's review: it slowed the arrows in our games and added a control; the machine's game port itself stays, reading as nothing plugged in) |

## Decided

- **The UI follows the TRS-80 simulator's** (its layout, its components, its theme), adapted to this machine.
- **The ROMs are one machine's set** (design/decisions.md, D2).
- **Photographs:** only the six cleared ones (images/photos/CREDITS.md), their metadata removed.
- **The manuals are linked, not copied:** the [cec-i-docs](https://github.com/wixette/cec-i-docs) project has them, under its own terms.
- **No cassette recorder; a disk drive with no 3D model** (decisions.md, D15).
- **Apple II software is not hosted here**, and 128 KB IIe software (80 columns, double hi-res) will not run: the CEC-I has no auxiliary RAM.
- **No machine state is kept across visits** (D10).

## Where it stands

- **v0.0.1:** released 2026-11-21 as a pre-release ([the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.1)), live at <https://wixette.github.io/cec-i-simulator/>. Checked by the owner; the full 6502 suite, the unit tests and the browser checks pass.
- **v0.0.2:** released 2026-11-21 as a pre-release ([v0.0.2.md](v0.0.2.md), [the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.2)). Checked by the owner; the full 6502 suite, the unit tests and the browser checks pass.
- **v0.0.3:** released 2026-11-22 as a pre-release ([v0.0.3.md](v0.0.3.md), [the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.3)). Checked by the owner; the unit tests and the browser checks pass (the 6502 unchanged since v0.0.2).
- **v1.0.0:** being built on `dev-v1.0.0` ([v1.0.0.md](v1.0.0.md)); the review's findings in [v1.0.0-review.md](v1.0.0-review.md).
- **v0.0.6:** released 2026-11-22 as a pre-release ([v0.0.6.md](v0.0.6.md), [the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.6)). Checked by the owner; the unit tests and the browser checks pass.
- **v0.0.5:** released 2026-11-22 as a pre-release ([v0.0.5.md](v0.0.5.md), [the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.5)). Checked by the owner; the unit tests and the browser checks pass; disks of our own boot in the tests, and the owner's own DOS 3.3 and games by hand.
- **v0.0.4:** released 2026-11-22 as a pre-release ([v0.0.4.md](v0.0.4.md), [the release](https://github.com/wixette/cec-i-simulator/releases/tag/v0.0.4)). Checked by the owner; the unit tests and the browser checks pass (the 6502 unchanged since v0.0.2).
