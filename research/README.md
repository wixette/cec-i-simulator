# How the CEC-I works, and what was measured on it

What the simulator is built on, in brief. The machine's own books are transcribed in the [cec-i-docs](https://github.com/wixette/cec-i-docs) project (in Chinese); they are cited here by book and section, and not copied: (1) the *CEC-I User Manual* (2nd edition, 1988), (2) *Principles, Use and Maintenance of the China Educational Computer* (Tsinghua University Press), (3) the *Software Technical Reference* and (4) the *Hardware Technical Reference* (both by the CEC-I joint design group, Tsinghua University Press).

## The machine

- **What it is.** An Apple IIe compatible in one box with its keyboard, launched in 1987 by a joint design group led by Tsinghua University: a 6502 at about 1.02 MHz, 64 KB of RAM (48 KB plus the language card's 16 KB), a PAL picture for a home TV (or a monitor), a cassette interface, and Applesoft BASIC (CEC-BASIC, with `MUSIC`, `PLAY`, `LG` and `GAME` added), MIT LOGO and the monitor with its mini-assembler in ROM (Books 1 and 4).
- **What it adds: Chinese.** Two 1-Mbit mask ROMs (U33, U34) hold the national character set GB 2312, 7,445 characters, as 16 × 16 dots, 32 bytes a character; a 27256 (U35) holds the code tables and the Chinese system, which starts at the press of the 中文 key, with no disk (Books 1, 3 and 4).

## How a Chinese character reaches the screen

1. **The key:** in Chinese mode, pinyin (F2) or 区位 (F3, four digits: the character's row and place in GB 2312) picks a character (Book 1 §2.5).
2. **The internal code:** in a BASIC string it is three bytes: 127, then the row and the place, each n + 28 moved past `"`, `,` and `:`, so that no code byte cuts a string or a `DATA` item. 中 (row 54, place 48) is `127 85 79`, which lists as `▒UO` in Western mode (Book 1 §3.9.4; checked on the machine).
3. **The window:** the 256 KB font is read through a 16 KB window at aux $4000–$7FFF; the bank is the low four bits of the latch U32 at $C0B0, written only. Bit 4 of the same latch lets colour through to the picture (off in Chinese mode); bit 5 picks the table bank at aux $8000 (Book 4 §3.11).
4. **The dots:** the Chinese system copies the character's 32 bytes and draws them on hi-res page 2 ($4000–$5FFF), where a 16-dot character spans three 7-dot bytes a line; the screen holds 10 lines of 17 characters and a status line (Book 3, part 4).

## The memory map, in brief

The IIe's, with no auxiliary RAM: aux $0000–$3FFF is main RAM again; aux $4000–$7FFF the font window; aux $8000–$BFFF a table bank (U35's or U7's low half); aux $D000–$FFFF the Chinese system (U35's high 12 KB), seen with ALTZP and the language card set to read RAM; $C300 and $C600 come from U35. `js/sim/machine.js` has the whole map (design/decisions.md, D4).

## Measured on a real machine

A working CEC-I of 1987 (serial 87010305, main board ZH-1(875), ROM version 1.1) was measured, photographed and timed, and the simulator is tested against it (`tests/machine.test.js`):

| What | On the machine | Test |
|---|---|---|
| Switching on | a beep of about 935 Hz for 0.1 s; `ZHONG HUA XUE XI JI`, `VERSION 1.1`, BASIC's prompt `]`; $C0B0 = $10 | *switching on* |
| The frame | 3,000 fields of $C019 in 60 s: 50 a second, 312 lines of 65 cycles | *timing* |
| Speed | 1,700 中 printed between two beeps in 42.03 s | *timing* (within 5 %) |
| Flashing text | 20 flashes in 12.8 s | *timing* |
| The ROMs as read | checksums of the main ROM, the tables, the Chinese ROM, the language card and every page from $C100 to $FFFF | *the ROMs as the machine reads them* |
| $C0B0 | reads 191 ($BF, the floating bus) | *the ROMs…* |
| The internal code | `A$="中华学习机"`: `LEN` 15, its bytes, `RIGHT$(A$,5)`, its listing in Western mode | *Chinese* |
| Input | pinyin `zhong` gives 中盅忠钟衷终 in that order; 区位 1601 gives 啊 | *Chinese* |
| The Chinese screen | hi-res, colour off; HIMEM 49152, then 37376, and 37376 back in Western mode | *Chinese* |
| The self-test | Ctrl-Reset-TEST, and `C007:0`, `CB80G` in the monitor: every line OK | *the self-test…* |
| Ctrl-Reset | the program kept; from Chinese mode, back to Western with a beep | *the self-test…* |
| The keys | each key's code as `GET` reads it: F1–F5 1, 12, 23, 20, 6; Quit 3; 西文 17; 中文 31; TEST 22; the arrows 8, 21, 11, 10 | `tests/keyboard.test.js` |
| `MUSIC` | `MUSIC 192,110` sounds A3 (220 Hz), `MUSIC 128,110` E4 (330 Hz) | *sound* |
| The picture | Western BASIC's text green (a darker green field, pale characters) on a clean video path; LOGO's and the Chinese system's white; `POKE 49328,0` turns the green picture white | *LOGO and the green picture* |
| The case, the keys, the board | every dimension of the 3D model | `model/params/machine.json`, each value with its source |

## Other sources

- MAME's CEC-I driver (`src/mame/apple/apple2e.cpp`) and its ROM set, against which the ROMs here are checked (roms/NOTICE).
- Tom Harte's [SingleStepTests](https://github.com/SingleStepTests/65x02) for the 6502, which `js/sim/cpu6502.js` passes in full.
- The Apple IIe's own references, for what the CEC-I keeps of it.
