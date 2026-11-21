# UI design

This document holds the principles the simulator's page is laid out by, and the reasons for them. Where a control ends up, and what it looks like, is the code's business. These rules decide it, so that the next change can follow them, or argue with them in the open. They follow the TRS-80 and Altair 8800 simulators' (by the same author), adapted to a machine with a TV and a Chinese system.

**If a change needs to break a principle, change the principle here first, with its reason.**
- Principles are P1, P2, …
- Decisions are U1, U2, …

The machine's own decisions (D1, D2, …) are in [../design/decisions.md](../design/decisions.md).

**Status:** as built for v0.0.2 (first written for v0.0.1).

## Part 1. Principles

### P1. The machine is the one primary surface

It is always on screen, in 3D or in 2D, and nothing covers it. The **picture** on the TV is always visible, in any view and with any tab open: it is the machine's state.

### P2. A control has one home

If a control is wanted somewhere else, move it, or make both places visible at once. Don't make a second copy.

*Not copies:*
- keyboard shortcuts, which take no room;
- the **helper strip** at the stage's foot (U4): the computer's power switch, Ctrl-Reset and the TV's power. On the machine they are on its left side, two keys at the keyboard's two ends, and a small button on the TV. The strip is another way to reach the same controls, in both views.

### P3. Tools live in one dock, one at a time

The four instruments (CPU & Memory, Screen, Keyboard, Chinese), Start and References, and the lessons as they come, share one dock under the stage. You choose which one it shows, how big it is, and whether it is open at all.

### P4. Occasional actions go in menus and dialogs

Space that is always there is for things that change while you watch: the picture, the keys, the lamps. Type in, opening and saving a program, the display, the language and About go in the top bar.

### P5. Each surface keeps its voice

| Surface | Case and language | Font |
|---|---|---|
| The machine: the screen, the key legends (中文, 西文, Reset, Test…), the TV's printing (亮度, 饱和度), BASIC | as the machine has them, never translated | the machine's own (the character ROM, the font chips, the legends) |
| The instrument: top bar, stage band, strip, dock, dialogs, status line | the page's language, sentence case | Roboto Flex for Latin, the system's fonts for Chinese; code in monospace |

### P6. Unavailable is greyed and explained, never hidden

A control that cannot be used right now stays where it is, greyed. When used, it answers in the status line with the reason. *Taken apart* while the computer runs says "switch off first"; *Save the program* with none in memory says so.

### P7. One status line, always visible

It says what just happened, and why something is greyed. It keeps one line's height: a longer message rises over the foot of the dock, so that the stage never changes size because of a message.

### P8. A link is a public contract, from 1.0.0

Once released, a link field is never renamed, dropped or read differently; new fields may be added. It lives in one module with nothing of the page in it (`js/app/link.js`), and its own test pins it down (`tests/link.test.js`).

| In the address | What | Values |
|---|---|---|
| `#view=` | the view the page opens in | `3d`, `2d`; anything else is ignored |
| `?lang=` | the language (U11) | `zh`, `en`, or a tag that maps to one (`zh-CN`, `en-GB`); else the visitor's choice or the browser's, else `zh` |

`?debug` and `?selftest` are for development ([development.md](development.md)), not part of the contract.

### P9. A phone gets the same app, not a different one

Same regions, same order: the stage across the width, the dock below, the top bar packed down. Nothing depends on hover, and nothing needs a precise drag. On a phone 2D is the way to type, so the status line says so the first time a phone opens the page in 3D.

### P10. One component for each kind of thing

Each kind of control is one component, used the same way everywhere (`js/ui/components.js`):
- **Menu:** choosing one thing. Items only; one open at a time; an item that cannot be used is greyed, with why at its right.
- **Dialog:** anything that needs explaining. A title band with its close button, then the body, then the actions at the bottom right, the one it is for filled.
- **Icon button:** always with a tooltip and a screen-reader name.
- **Tabs:** the dock's. They follow the WAI-ARIA tabs pattern.
- **Segmented button:** 2D | 3D.
- **Tonal toggle:** the 2D view's Keyboard drawer.

Icons are Material Symbols, as inline SVG. There are no icon fonts, and no fonts or scripts from a CDN: the page needs no network but its own site. Every control can be reached with Tab and has a visible focus ring. Motion (camera flights, the cross-fade) honours `prefers-reduced-motion`.

### P11. Material 3's tokens, not its components

Every control takes its colours, corners, type and states from one set of design tokens in `css/theme.css`: Material 3's roles in a dark scheme, the TRS-80 simulator's own. No Material library is loaded.

**One colour, one meaning:**
- **The TV's picture** is the brightest thing on the page.
- **Amber:** what to press, and the one action a place is for.
- **Green:** on, and done (the strip's Computer and TV while on).
- **Blue:** the story and the asides.
- **Red:** refused, or a fault.

## Part 2. The layout

```
┌ [logo] CEC-I Simulator   [▤ Programs ▾]                                [🔊] [文A 简 ▾] [ⓘ] ┐  top bar
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                         [▭ Display ▾] [Keyboard] [⌂] [− +] [Front ▾]  [2D | 3D]           │  stage band
│ ╭─────────────────────────────────────────────────────────────────────────────────────╮ │
│ │            THE STAGE: the computer and its TV in 3D, or the TV and keyboard flat     │ │
│ │                                                                  [Put it all back]  │ │
│ ╰─────────────────────────────────────────────────────────────────────────────────────╯ │
│                          [⏻ Computer | ↺ Ctrl-Reset] [▭ TV]                               │  helper strip
├══════════════════════════════════════ drag ═════════════════════════════════════════════┤
│ CPU & Memory  Screen  Keyboard  Chinese   Start  References                            ▾ │  dock
│ …                                                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Ready. Type on your keyboard: Enter is Return, Page Up 中文, Page Down 西文 …             │  status line
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

The page is a fixed frame of top bar, stage, dock and status line, and never scrolls. The dock sits below the stage and can be resized by its top edge, or folded to its tab bar; growing it shrinks the stage, and the 3D view refits. The stage keeps at least 300 px on a desktop; on a phone (700 px wide or less) at least 55 % of the height, and in a window 520 px tall or less 65 %.

## Part 3. Decisions

### U1. 3D is the way in; 2D and 3D are one toggle

- **3D is the default** on a first visit. After that the choice is remembered, and a link can carry it (`#view=3d`, `#view=2d`). A link's view wins over the remembered one.
- **Going to 2D, the camera flies** to the TV's screen, then the flat view cross-fades in. Going back, it fades out and the camera flies back. With `prefers-reduced-motion`, both are a cut. A double-click on the TV's screen in 3D goes to 2D.
- **Under 2D the 3D scene stops rendering.** The machine keeps running.
- **The band** holds **Display** (U8) and the 2D | 3D toggle in both views, the 3D view's own tools (⌂, zoom, Views) in 3D, and the Keyboard drawer's toggle in 2D: everything that changes what is seen. The helper strip is under the stage in both.

### U2. The 3D views

- **Views** (a menu naming the view on show): Front (the way in: straight on from 32 degrees above, the TV and the computer framed together, the whole screen over the computer, ready to type), Screen (next, as the view most often wanted), Keyboard, Three-quarter, Back (the sockets, past the TV), **Inside** and **Taken apart**. ⌂ goes to Front, with every part back. Each view frames its parts on the stage as it is now (`js/scene/framing.js`).
- **The TV turns to glass** whenever it stands between the camera and the computer, so that nothing hides the machine.
- **Inside** turns the lid and the keyboard to glass: the main board, the power supply and the speaker. The machine keeps running.
- **Taken apart** takes the computer apart in the real order (U3). While the computer is on, it is greyed in the menu with "switch off first" beside it (P6).
- **The camera:** drag to orbit, right-drag or two fingers to pan, wheel or pinch to zoom; damped and limited. Reached by Tab, the view shows the amber focus ring, and the arrows pan, + and − zoom and Home goes home; otherwise it has no focus, and every key is the machine's. A click on the view never focuses it.
- **Labels:** hovering a part shows its name and what it does, after 400 ms (a part a click does nothing to, after 1 s), beside the pointer, in the page's language (the model carries every label in English and Chinese); a tap writes it in the status line. Between the keys (the keyboard's plate or the lid's surround within about half a key of a key) no label shows: the pointer is aiming at the keys there.

### U3. Taking it apart

With the computer off, a click on the lid, the keyboard or the main board takes it out; anything in its way comes out first, in order. A second click puts it back, with whatever sits on it first. **Put it all back** stands on the stage whenever anything is out. The power switch refuses while anything is out, and names it (D11). The slot's flap swings open on a click at any time.

### U4. The helper strip

A strip of its own, centred at the stage's foot, just above the dock: *Computer* (the power switch, lit green while on), *Ctrl-Reset* (Ctrl and RESET held together a moment, then let go), *TV* (its power, lit green while on). The machine's own controls stay clickable where they are too: the rocker on the computer's left side, the TV's button and knobs (a drag sideways or the wheel turns a knob, a double-click puts it back). A tab on the strip's top edge folds it away; the choice is remembered, and in a short window (a phone on its side) it starts folded. In a narrow window the buttons keep their icons and lose their names.

### U5. Typing

- **The machine starts switched on,** the computer and the TV, at `ZHONG HUA XUE XI JI` and BASIC's prompt: a first visit opens on a live machine. After that both are as the visitor left them.
- **The visitor's keyboard is the CEC-I's** whenever no menu, dialog or text box has it (D7). A held key holds the machine's key; the machine repeats it, as its own keyboard does.
- **The machine's keys** can be clicked or tapped, in 3D and in 2D. Ctrl, Shift and TEST clicked stay down for the next key, so that Ctrl-Reset and Ctrl-Reset-TEST can be clicked.
- **The keys' legend** is in the Start tab and in the first status message.

### U6. The dock's tabs

The instruments first (U12), from the CPU out to the Chinese screen; then the reading: **Start** (the default on a first visit): what the machine is, a first few minutes, the machine's keys on the visitor's, and how Chinese goes in; **References:** further reading first, then what the simulator is built on and its source, and last, folded, what it simplifies. The lessons (v0.0.4) will join the reading. The dock remembers its tab, its height and whether it is folded; what the machine does never switches its tab.

### U7. Type in, Open, Save

**Programs** in the top bar holds three items (D8):
- **Type in…** opens a dialog with a text box: what is written or pasted there is typed on the machine's keys when *Type it in* is pressed.
- **Open a BASIC file…** types a text file (UTF-8, or GB 2312/GBK) in, after `NEW`.
- **Save the program as a file** hands over the BASIC program in memory as `program.bas`; greyed, with why, when there is none.
All three need the computer on, and say so.

### U8. The top bar

- **Left (the machine):** the logo and the title; **Programs** (U7).
- **Display**, not in the top bar but at the band's left, beside the views, as it changes what is seen: the set the computer is plugged into (a colour TV, a black-and-white TV, a green monitor, D6), and the case as found today (the plastic, the keys and the stickers yellowed together: the default, as the machine looks to today's visitors) or as new. Both remembered. A finish chosen while the computer is out of sight brings it into sight (the 2D view's keyboard drawer opened; in 3D, the front view if the screen's was on show), so that the choice is seen to do something.

*Found in v0.0.1's check:* Display in the top bar read as one of the machine's programs' menus, and the finish chosen in 2D, the drawer closed, changed nothing visible.
- **Right (the app):** **Sound** (a speaker icon, crossed out while off; remembered), the **language** (U11), then **About**.
- On a phone the menus keep their icons and lose their names.

### U9. About

A short dialog: the logo, the version and what the simulator is (and, before 1.0.0, that it is a pre-release); links to the source and to report a problem; the licences, a line each, the ROMs' notice among them; that the project is not affiliated with the machine's makers. At the bottom right, *References* (it opens the tab) and *Close*.

### U10. In 2D, the keyboard is a drawer

The TV takes the stage, its picture large and sharp on the tube's lit glass, its knobs, button and lamp working. The computer, its keys drawn from the 3D model's own (`js/flat/bake-keys.js`) and its power rocker at its left, is a drawer under the TV, opened by *Keyboard* on the band: closed, the picture gets the stage. It is open at first, so that the keys are at hand, and then remembered.

### U11. Two languages

The page speaks 简体中文 and English (D9); v0.0.6 brings ten.
- **What is translated:** every text of the page's own, and the parts' labels. **What is not:** the machine's own words (P5).
- **The language button** is in the top bar's right: a translate icon and the language's short name (简, EN). Its menu lists each language as it names itself. A choice is remembered, and the page opens again in it (the machine starts again, as on any visit).
- **One file per language,** `js/l10n/<locale>.js`, with English's keys. `tests/l10n.test.js` fails while any message is missing, or its placeholders, its `code` or its [[keys]] differ from English's.

### U12. The instruments

*(v0.0.2)* Four tabs of the dock, each a view the real machine never had, and each says so at its head (as the TRS-80 and Altair 8800 simulators' do). They read the running machine; they never change it, but for the CPU tool's clock.
- **CPU & Memory** (after the TRS-80 simulator's): the registers (A, X, Y, S, P, PC) and the flags by letter (N V B D I Z C); the next eight instructions, disassembled in the Apple II monitor's notation; the memory map, ten regions of the 64 KB lit by their share of the traffic, each a button that shows it in the dump; the dump, following PC, the stack or an address. **Pause**, **Step** (one instruction; running, the first press pauses), **Run to** (a hex address), and the clock at real speed, 1/10, 1/100 or 1/1,000. Paused, everything else waits: the picture, the keys, typing. Sound only at real speed.
- **Screen:** the display's soft switches as chips, lit while on, and a line saying what they make the picture show and from where; the text page's 40 × 24 bytes, row by row with each row's address (the interleave in plain sight), lo-res bytes drawn as their two colours; a cell picked: its address, its byte, and the character U13 draws for it (normal, inverse or flashing) or its two blocks; one hi-res line chosen with a slider: its address worked out from the line number, its 40 bytes as 7 dots each, bit 7's half-dot shift marked.
- **Keyboard:** the matrix, X0-X7 by Y0-Y9, each key at its crossing with its legend, lit while down; the keys on lines of their own (Ctrl, the Shifts, Caps Lock, Reset); the latch at $C000 with its strobe; the last key's code worked out in U26, line by line.
- **Chinese:** four cards in the character's order: the string (a variable chosen from the program's; its bytes grouped, each 127 x y a character), the window (the latch's value and bits, the 16 banks with the one in the window lit), the character (its 16 × 16 dots and 32 bytes, its glyph number worked out, where it is in the font and in the window), the screen (where its dots are on the hi-res page, and the 48 bytes they fill).
- **Inside** (U2) lights the chips as they work, as the TRS-80's does: the 6502 while it runs; the RAM U5, U6; U7; U35; the font ROMs U33, U34; the latch U32 as it is written; U13 while text is shown.
- A tab not shown does no work; a tab shown redraws a few times a second, and its cards only when what they show changes.

