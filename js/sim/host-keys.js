// SPDX-License-Identifier: Apache-2.0
//
// The visitor's own keyboard as the CEC-I's (docs/ui-design.md, U5; design/decisions.md, D7):
// KeyboardEvent.code to a key of model/params/keyboard.json. Every key of the machine can be
// reached from a PC's or a Mac's keyboard, so that nothing needs a click:
//
// - the letters, digits and signs where they are, Return, Esc, Tab, Shift, Ctrl, Caps Lock,
//   the space bar and the four arrows; Backspace is ◁ (the machine's own way to rub out);
// - the CEC's own keys on keys a PC keyboard has spare: F1-F5, F6 Quit, Page Up 中文,
//   Page Down 西文, End TEST, F12 RESET (Ctrl-F12 is Ctrl-Reset);
// - and the same with Alt (Option on a Mac), for keyboards without those keys or where the
//   system takes them: Alt-1 to Alt-5 F1-F5, Alt-Q Quit, Alt-Z 中文, Alt-X 西文, Alt-T TEST,
//   Alt-R RESET (Ctrl-Alt-R Ctrl-Reset).
//
// ⌘ (Meta) combinations are the browser's. Pure logic, no DOM: tests/host-keys.test.js.

/** @typedef {{ code: string, altKey: boolean, metaKey: boolean }} HostKey */

const HOST = /** @type {Record<string, string>} */ ({
  Escape: "esc", Backquote: "grave", Minus: "minus", Equal: "equal", Backslash: "backslash", Tab: "tab",
  BracketLeft: "lbracket", BracketRight: "rbracket", Enter: "return", NumpadEnter: "return", ControlLeft: "ctrl", ControlRight: "ctrl",
  Semicolon: "semicolon", Quote: "quote", ShiftLeft: "lshift", ShiftRight: "rshift", Comma: "comma",
  Period: "period", Slash: "slash", CapsLock: "capslock", Space: "space", ArrowLeft: "left", ArrowRight: "right",
  ArrowUp: "up", ArrowDown: "down", F1: "f1", F2: "f2", F3: "f3", F4: "f4", F5: "f5", F6: "quit",
  Backspace: "left", PageUp: "zhongwen", PageDown: "xiwen", End: "test", F12: "reset",
});

/** The same keys with Alt (Option), where a keyboard lacks the keys above. */
const WITH_ALT = /** @type {Record<string, string>} */ ({
  Digit1: "f1", Digit2: "f2", Digit3: "f3", Digit4: "f4", Digit5: "f5",
  KeyQ: "quit", KeyZ: "zhongwen", KeyX: "xiwen", KeyT: "test", KeyR: "reset",
});

/**
 * The CEC-I key a host key stands for, or null.
 * @param {HostKey} e
 * @returns {string | null}
 */
export function hostKeyId(e) {
  if (e.metaKey) return null;
  if (e.altKey) return WITH_ALT[e.code] ?? null;
  const m = /^Key([A-Z])$/.exec(e.code) ?? /^Digit([0-9])$/.exec(e.code);
  return m ? m[1].toLowerCase() : HOST[e.code] ?? null;
}

/**
 * The legend the page shows (References, the status line): each of the machine's own keys
 * and the host keys that reach it. The names are the keys' own legends (docs/ui-design.md, P5).
 */
export const LEGEND = /** @type {const} */ ([
  ["中文", "Page Up", "Alt-Z"],
  ["西文", "Page Down", "Alt-X"],
  ["F1–F5", "F1–F5", "Alt-1 … Alt-5"],
  ["Quit", "F6", "Alt-Q"],
  ["Test", "End", "Alt-T"],
  ["Reset", "F12", "Alt-R"],
  ["◁", "Backspace", "←"],
]);
