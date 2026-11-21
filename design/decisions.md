# The machine's decisions

The decisions about what the simulator simulates, and how. Each says what was decided, why, and what was rejected. The page's own decisions (U1, U2, …) are in [../docs/ui-design.md](../docs/ui-design.md). The code cites both by number.

**If a change needs to go against a decision, change the decision here first, with its reason.**

## D1. One machine: a CEC-I of 1987, version 1.1

The simulator is one real machine, measured and photographed: a CEC-I made by Shanghai No. 4 Radio Factory in 1987 (serial 87010305), main board ZH-1(875), its system ROM version 1.1, the version the 1987–88 manuals show. The 3D model is built from its measurements (model/params/machine.json, each value with its source), and the emulation is checked against what it does: its banner, its beep, its timing, its keys' codes, its checksums (research/README.md).

*Rejected:* a composite of several machines or ROM versions, which would match none.

## D2. The ROMs: that machine's set, and only it

`roms/` holds the six chips of that machine: U7 (the system ROM), U35 (the Chinese system), U33 and U34 (the font), U13 (the character generator), U26 (the keyboard ROM). Five are byte for byte MAME's `ceci` set; U7 is MAME's version 1.1 with 21 bytes changed, reproducing every checksum taken on the machine (roms/NOTICE). They are not ours and not under the repository's licence; roms/NOTICE says whose they are and offers to remove them on request, as the TRS-80 simulator does with its ROM.

*Rejected:* shipping MAME's other versions (1.21, the self-test U7) and the disk controller's PROM: nothing here uses them, and the simulator is the one machine (D1). A ROM selector, for the same reason.

## D3. A 6502 of our own, checked against SingleStepTests

The CPU (`js/sim/cpu6502.js`) is written for this simulator: the NMOS 6502, every documented opcode with its exact cycle count, decimal mode as the NMOS part does it. The open 6502 cores we found are TypeScript, which this stack does not compile. It passes all 1,510,000 cases of Tom Harte's SingleStepTests for the documented opcodes (`pnpm test:6502`); a sample of 1,812 runs with the unit tests. Undocumented opcodes run as NOPs of their length: the CEC-I's ROMs use none.

## D4. The memory map: the Apple IIe's, without aux RAM, with the CEC's own

The machine is the IIe's map and soft switches with what the CEC-I changes (the hardware reference, Book 4): no auxiliary RAM (aux $0000–$3FFF is main RAM again); aux $4000–$7FFF the 16 KB window into the 256 KB font, its bank latched at $C0B0; aux $8000–$BFFF a table bank; aux $D000–$FFFF the Chinese system, seen with ALTZP and the language card reading RAM; $C0B0 written only, reading the floating bus ($BF). The frame is PAL's: 312 lines of 65 cycles, 50 fields a second. Checked by the checksums of every page, as the real machine reads them (tests/machine.test.js).

## D5. The picture on a colour TV

Graphics in the Apple lo-res and hi-res palettes (their order checked on the real machine), and sharp black and white while $C0B0 bit 4 keeps colour off (the Chinese system's screen). Full text mode with colour enabled (Western BASIC) shows a darker green field with pale characters, as the real machine does on a clean video path; text mode with colour off (LOGO, the Chinese system) is white on black. The green is modelled as observed: the circuit's reason for it is not known.

*Rejected:* the stripes and blur of a composite signal on a real set. The picture is drawn sharp, and the simulator says so (References, *What the simulator simplifies*).

## D6. Three sets: a colour TV, a black-and-white TV, a green monitor

The computer was plugged into whatever a school or a home had. Display chooses among a colour TV (D5), a black-and-white TV and a green monitor; on the last two no colour is decoded, so every picture is the sharp black-and-white one, in white or in green. The TV drawn in 3D and in 2D stays the same set: it is a generic 14-inch colour TV of the 1980s, not a model of any one.

## D7. The visitor's keyboard: every key of the machine reachable

Every one of the machine's 69 keys can be pressed from a PC's or a Mac's keyboard, so that no task needs a click (`js/sim/host-keys.js`): the letters, digits and signs where they are, by the key's place (`KeyboardEvent.code`, a US layout, as the machine's); Backspace is ◁; the CEC's own keys on keys a PC has to spare (F1–F5, F6 Quit, Page Up 中文, Page Down 西文, End TEST, F12 RESET, Ctrl-F12 Ctrl-Reset), and the same with Alt (Option), for laptops without those keys: Alt-1…5, Alt-Q, Alt-Z, Alt-X, Alt-T, Alt-R. ⌘ combinations are the browser's; Ctrl with any key is the machine's, Ctrl-C and Ctrl-V included, since a program may read them. Text goes in through Type in (D8), not a paste onto the page. Caps Lock follows the visitor's: each time theirs changes, the machine's toggles.

*Rejected:* typing by character, as the TRS-80 simulator does (its Model I had one layout of its own); the CEC-I's layout is the PC's, so place is simpler and every key, Ctrl and all, behaves as the machine's.

## D8. Type in: text typed on the machine's own keys

Type in (and Open a BASIC file) types text on the machine's keys, as a person would, faster: each code goes into the keyboard's latch once the program has read the last, while the machine runs eight times faster. Letters go in as the keys give them with Caps Lock as it is (down, as the machine starts: capitals). Chinese goes through the Chinese system's own 区位 (quwei) input, four digits a character, F3 before a run of Chinese and F1 after it; if the Chinese system is not on, 中文 is pressed first. A character outside ASCII and GB 2312 refuses the whole text, naming it. Save the program writes the BASIC program in memory as UTF-8 text, its keywords from the ROM's own table (CEC-BASIC's four, MUSIC, PLAY, LG and GAME, included) and its Chinese as Chinese, so that typing it in again gives the same program.

*Rejected:* writing a program into memory directly: the machine would not have seen it typed, and the Chinese system's own way in would be skipped. Pinyin for Chinese: a syllable has several characters, and choosing among them needs the screen; 区位 is exact.

## D9. 简体中文 when nothing else decides

The page speaks 简体中文 and English. A visit uses the language of the address (`?lang=`), else the visitor's choice, else the first of the browser's languages that is here, else 简体中文: most of the machine's users read Chinese.

## D10. The machine's memory is not kept

A reload switches the machine on afresh, as the real one would. What is kept is the page's own state (docs/privacy.md).

*Rejected for now:* saving the memory across visits. A program can be saved as a file (D8).

## D11. Taking it apart only with the computer off

The lid, the keyboard and the main board come out in the real order (the lid's six screws, the keyboard turned over forward on its flat cable, the board lifted), only while the computer is off, and the computer will not switch on until everything is back. Going to 2D puts it back first.

## D12. The 3D model in plain git

`model/cec-i.glb` (about 5 MB) is committed as it is, not in Git LFS: GitHub Pages serves the repository as it is, and does not serve LFS files. It is rebuilt from the parameters by `pnpm build:model` (Blender); `tests/model.test.js` holds it to what the page needs.
