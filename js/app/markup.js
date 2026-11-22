// SPDX-License-Identifier: Apache-2.0
//
// The marks a message may carry (docs/conventions.md, "Text"): `code`, the machine's own text;
// **bold**, a word to notice (the lessons); [[Key]], a key on a keyboard (References). No DOM:
// tests/markup.test.js runs them.

/**
 * A lesson's text as HTML: escaped first, then `code` and **bold**.
 * @param {string} s
 */
export function markup(s) {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** @typedef {{ kind: "text" | "code" | "key", text: string }} Part */

/**
 * A message's text in parts: plain text, `code` and [[keys]], in order.
 * @param {string} s
 * @returns {Part[]}
 */
export function parts(s) {
  return s
    .split(/(`[^`]+`|\[\[[^\]]+\]\])/)
    .filter(Boolean)
    .map((p) => (p.startsWith("`") ? { kind: "code", text: p.slice(1, -1) } : p.startsWith("[[") ? { kind: "key", text: p.slice(2, -2) } : { kind: "text", text: p }));
}
