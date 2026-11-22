# Changelog

## v0.0.5 (pre-release)

Disks and files ([design/v0.0.5.md](design/v0.0.5.md)).

- A **disk drive** on the CEC-I's own floppy interface (slot 6), with no model in the 3D view. **Programs ▸ Disk** inserts a disk image (`.dsk`, `.do`, `.po`, `.nib`, `.woz`; or drop it on the page) and starts from it, as the machine did: the system ROM looks for a disk at power-on and boots it. DOS 3.3 and the games on its disks run (ProDOS has not been tried yet); what they write can be saved as a disk image again. A blank disk, to `INIT`. The drive is always on the helper strip too: the disk's name, its lamp, and the same menu.
- **Save the program** asks for a name, the first `REM` line's to start with.
- **LOGO procedures** to and from files: *Open* types a `.logo` file's procedures into LOGO; *Save* reads them as LOGO prints them (`PO ALL`).
- The **Text editor** saves its text on a disk and loads it back, with DOS 3.3 started from a disk (the visitor's own): DOS's `BSAVE` and `BLOAD`, as programs of the time did.
- The cassette recorder is no longer planned.

## v0.0.4 (pre-release)

The lessons ([design/v0.0.4.md](design/v0.0.4.md)).

- A **Lessons** tab: six short lessons (Meet the CEC-I, Talk to BASIC, Chinese inside, Pictures from memory, Keys and sounds, Inside the processor), four to six steps each, every one ending with a program to play.
- A step can type its line for you, open a program, or show what it is about: a 3D view, or an instrument beside the lesson, working. A tick once the machine shows the step done, the step's program runs, or what it shows is shown.
- The Simplified Chinese rewritten, in Chinese for Chinese readers rather than translated from the English: the lessons, the instruments, the menus and the status line.
- The lessons take the Start tab's place: what the machine is and its first minutes are in the first lesson; the machine's keys on yours and how Chinese goes in are in References.

## v0.0.3 (pre-release)

Programs of our own ([design/v0.0.3.md](design/v0.0.3.md)).

- **Programs** lists sixteen of our own in six sections, each typed in on the machine's keys from whatever it is doing, in its mode: **Learn** (Guess my number, Bar chart, Hi-res curves, Big character, BASIC against machine code), **Chinese** (Idiom quiz, Reading numbers), **Games** (Snake, Bricks, Mine hunt on the text screen), **Utilities** (Calendar, an analog Clock that keeps time by the screen's fields, a whole-screen Text editor in machine code), **Music** (a Music box of tunes in 简谱, an Organ), **LOGO** (Kaleidoscope).
- Machine code is kept as readable assembly beside each program and typed as DATA made from it.

## v0.0.2 (pre-release)

Instruments that show how it works ([design/v0.0.2.md](design/v0.0.2.md)): four tabs of the dock, each a view the real machine never had.

- **CPU & Memory:** the registers and flags, the next instructions disassembled, the memory map lit by its traffic, a memory dump; Pause, Step, Run to an address, and the clock 10, 100 or 1,000 times slower.
- **Screen:** the display's soft switches; the text page's 40 × 24 bytes at their interleaved addresses, a cell's byte drawn from the character ROM U13; a hi-res line's address worked out and its bytes as dots.
- **Chinese:** a string's bytes (127 and two more a character), the latch at $C0B0 and the font bank in its 16 KB window, the last character's 32 bytes as 16 × 16 dots with its glyph number and place in the font, and where its dots landed on the hi-res page.
- **Keyboard:** the X-by-Y key matrix lit as keys go down, the latch at $C000 and its strobe, and the last key's code worked out in the keyboard ROM U26.
- **Inside** lights the chips as they work: the 6502, the RAM, U7, U35, the font ROMs, the latch U32, the character ROM.
- A new logo and favicon: the CEC-I from the front, in flat shapes.
- Display ▸ Reset the knobs puts brightness and colour back where they start. A double-click brings the TV (the Screen view) or the computer (the Keyboard view) close.
- The case as new by default again; as found today (yellowed) is left in Display for the visitor to find.
- Fewer labels in the way: none between the keys, and a part a click does nothing to waits a second before saying what it is. The 3D key light no longer shows in the TV's glass.

## v0.0.1 (pre-release)

The first pre-release: the machine, on desktop and phone ([design/v0.0.1.md](design/v0.0.1.md)).

- The CEC-I running its own ROMs (version 1.1) on a 6502 that passes all of SingleStepTests: Western BASIC, the Chinese system with pinyin and 区位 input, LOGO, the monitor and mini-assembler, the self-test, the speaker.
- The computer and a TV of its time in 3D, from measurements of a real machine: seven views, Inside, taken apart in the real order; every part named on hover.
- A 2D view: the TV's picture large and sharp, the keyboard a drawer.
- Every key of the machine on the visitor's keyboard, or clicked; Ctrl, Shift and TEST held for the next key.
- Type in (pasted text typed on the machine's keys, Chinese through 区位), Open a BASIC file, Save the program.
- A colour TV, a black-and-white TV or a green monitor; the case as new or as found.
- A silver-grey TV of the late 1980s beside the computer; the case as found today (yellowed) by default; soft 3D lighting, and the 2D view in the colours the 3D view shows.
- Display (the set, the finish) beside the views; on a black-and-white TV the glass is grey, and the colour knob does nothing there or on the green monitor.
- The page in 简体中文 and English; on a desktop and on a phone.
