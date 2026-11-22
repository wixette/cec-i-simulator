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

The computer was plugged into whatever a school or a home had. Display chooses among a colour TV (D5), a black-and-white TV and a green monitor; on the last two no colour is decoded, so every picture is the sharp black-and-white one, in white or in green. The tube's glass under the picture is a dark grey-green on the colour TV and the monitor, and a neutral grey on the black-and-white TV, so that the set reads as black and white at a glance (`js/scene/knobs.js`, GLASS). The TV's colour knob (饱和度) works on the colour TV only: a black-and-white TV or a green monitor had no colour control, so there the knob still turns but the picture does not change, and the status line says why (`System.colourKnob`). *Rejected:* making it a contrast knob for those two sets, which would need another label on the one TV, and a control the colour TV does not have. The TV drawn in 3D and in 2D stays the same set: it is a generic 14-inch colour TV of the 1980s, not a model of any one. Its cabinet is silver-grey, as colour sets of the late 1980s often were, with a darker control panel and a dark lip round the screen to frame the picture: a black cabinet beside the computer's off-white case made the set-up glare on the dark stage. For the same reason the case's colour as new is a slightly greyer off-white, and the 3D view's exposure a little lower. The 3D view's key light comes low from the front left, with a faint warm sky and low studio reflections: lit from high above, the case's top came out far lighter than its other faces and no longer read as yellowed plastic. The 2D view's case and keys are drawn in the colours the 3D view renders them in under these lights, as new and as found (`model/params/machine.json`, `flat_case` and `flat_key`, sampled from the Keyboard view), so that the two views look alike; they are sampled again whenever the lights or the materials change.

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

## D13. The instruments read the machine; only the clock is theirs to change

*(v0.0.2)* The four instruments read the running machine through `Machine.peek` (no strobe cleared, no switch flipped), its traffic counters and a watch on the $C0B0 latch and the font window; they never write to it. The CPU tool alone changes something: the clock (Pause, Step, Run to, slower). Paused, the whole machine waits, the picture, the keys and typing with it, so what a visitor sees stays one consistent moment. There is no editing of memory or registers: a lesson can do that in a program, the visible way.

## D14. Our programs typed in from any state, as an owner would

*(v0.0.3)* Type it in starts with Ctrl-Reset, which stops whatever runs and brings BASIC's prompt back; from LOGO it brings the monitor's, and the typist, seeing `*`, starts BASIC afresh (Ctrl-B). Then the program's mode: nothing more for Western BASIC; for the Chinese system, the lines without Chinese typed in Western BASIC first (faster: the Chinese system draws every key it echoes on its hi-res screen), then 中文, which keeps the program, and the lines with Chinese through 区位; for LOGO, `LG`, and the procedures typed in LOGO's editor and defined with Ctrl-C. Our programs are typed with a shorter gap between keys than a visitor's text: the typist still waits for each key to be read. A machine-code routine is kept as assembly beside its BASIC (`js/sim/asm6502.js`, on the CPU's own opcode table) and typed as DATA lines made from it, ended by -1, so the two never disagree.

## D15. A disk drive with no model; no cassette recorder

*(v0.0.5; design/v0.0.5.md)* The CEC-I's floppy interface (U39-U44, Disk II compatible, slot 6) is emulated with one drive: the controller's sixteen switches, the head on quarter tracks, the disk as bits under the head at 4 cycles a bit, the data latch, writing and write protect, so that disks boot through the machine's own ROMs (U7's cold-start look for a disk at $C800, U35's boot code at $C600) and DOS writes them as it formats them. Disk images in: `.dsk`/`.do`, `.po`, `.nib`, `.woz` 1 and 2; out: a sector image as it came, the others as WOZ 2. The drive has no 3D model and changes nothing in the 3D view.

*Rejected:* files read out of `.dsk` images and loaded without a drive (the earlier plan): booting the disk as the machine did runs far more software, DOS and ProDOS among it, and needs nothing but the machine's own ROMs. A drive in the 3D view: it would weigh on the picture and the page. The cassette recorder (the earlier plan for v0.0.5): the machine was not sold with one, few used one with it, and the page would carry a recorder and its controls for little; the TRS-80 simulator is where a recorder fits. Saving the Text editor's text: the machine had no natural way to do it.

