// SPDX-License-Identifier: Apache-2.0
//
// Files to and from the visitor (js/app/topbar.js): a name fit for a file, a program's name
// from its first REM line, a text file's bytes as text. No DOM: tests/files.test.js runs them.

/** Characters a file's name cannot hold on the visitor's systems. */
const UNFIT = /[\\/:*?"<>|\x00-\x1f]/g;

/**
 * A name fit for a file: what a file's name cannot hold taken out, runs of spaces made one,
 * trimmed, at most `max` characters; or `fallback` if nothing is left.
 * @param {string} s @param {string} [fallback] @param {number} [max]
 */
export function fileName(s, fallback = "PROGRAM", max = 40) {
  const name = s.replace(UNFIT, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return name || fallback;
}

/**
 * A program's name for its file: its first REM line's words, else PROGRAM.
 * @param {string} text the listing
 */
export function programName(text) {
  return fileName(/^\d+\s*REM\s*(.+)$/m.exec(text)?.[1] ?? "");
}

/**
 * A text file's bytes as text: UTF-8, else GB18030 (GBK and GB2312 files, common for Chinese
 * listings), else null.
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
export function decodeText(bytes) {
  for (const enc of ["utf-8", "gb18030"]) {
    try {
      return new TextDecoder(enc, { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    } catch {
      // the next
    }
  }
  return null;
}
