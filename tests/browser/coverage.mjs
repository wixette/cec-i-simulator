// SPDX-License-Identifier: Apache-2.0
//
// What of the page's own code the browser checks reach (design/v1.0.0-review.md, T2):
// `pnpm test:browser --coverage`. V8's precise coverage, taken through the DevTools Protocol
// before each page load and at the end of each check, is merged by file: a byte counts as run
// if any check ran it. A line is unrun when no character of code on it ran; comment and blank
// lines are not counted. The page's modules only (`js/`), not vendor/.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** @typedef {{ functions: { ranges: { startOffset: number, endOffset: number, count: number }[] }[], url: string }} ScriptCoverage */

/** Per file (its path from the repository's root), which bytes ran. @type {Map<string, Uint8Array>} */
const ran = new Map();

/** The repository path of a script's address, or null for what is not the page's own code. @param {string} url */
function pathOf(url) {
  const m = /^https?:\/\/[^/]+\/(js\/[^?#]+\.js)/.exec(url);
  return m ? m[1] : null;
}

/**
 * Adds a snapshot of V8's precise coverage. Ranges come outer first, an inner range's count
 * overriding its function's, so each byte takes the count of the last range over it.
 * @param {ScriptCoverage[]} scripts
 */
export function addCoverage(scripts) {
  for (const s of scripts) {
    const path = pathOf(s.url);
    if (!path) continue;
    let size = 0;
    for (const f of s.functions) for (const r of f.ranges) size = Math.max(size, r.endOffset);
    const counts = new Int32Array(size);
    for (const f of s.functions) for (const r of f.ranges) counts.fill(r.count, r.startOffset, r.endOffset);
    const into = ran.get(path) ?? new Uint8Array(size);
    const merged = into.length >= size ? into : Uint8Array.from({ length: size }, (_, i) => into[i] ?? 0);
    for (let i = 0; i < size; i++) if (counts[i] > 0) merged[i] = 1;
    ran.set(path, merged);
  }
}

/** Whether there is anything to report. */
export const hasCoverage = () => ran.size > 0;

/**
 * Each file's lines of code, how many ran, and the unrun ones as ranges ("12-15"), the least
 * covered first.
 * @returns {{ path: string, lines: number, covered: number, unrun: string[] }[]}
 */
export function coverageReport() {
  /** @type {{ path: string, lines: number, covered: number, unrun: string[] }[]} */
  const out = [];
  for (const [path, bytes] of ran) {
    const text = readFileSync(ROOT + path, "utf8");
    // offsets are of the source as V8 has it; a non-ASCII character is one UTF-16 unit there, as in a JS string
    let lines = 0;
    let covered = 0;
    /** @type {number[]} */
    const unrunLines = [];
    let at = 0;
    let inComment = false;
    text.split("\n").forEach((line, n) => {
      const start = at;
      at += line.length + 1;
      const t = line.trim();
      if (inComment) {
        if (t.includes("*/")) inComment = false;
        return;
      }
      if (t.startsWith("/*") && !t.includes("*/")) {
        inComment = true;
        return;
      }
      if (!t || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      lines++;
      let any = false;
      for (let i = start; i < start + line.length; i++) {
        if (line[i - start] !== " " && bytes[i]) {
          any = true;
          break;
        }
      }
      if (any) covered++;
      else unrunLines.push(n + 1);
    });
    /** @type {string[]} */
    const unrun = [];
    for (let i = 0; i < unrunLines.length; i++) {
      let j = i;
      while (j + 1 < unrunLines.length && unrunLines[j + 1] === unrunLines[j] + 1) j++;
      unrun.push(i === j ? `${unrunLines[i]}` : `${unrunLines[i]}-${unrunLines[j]}`);
      i = j;
    }
    out.push({ path, lines, covered, unrun });
  }
  return out.sort((a, b) => a.covered / a.lines - b.covered / b.lines);
}

/** Prints the report: each file's share of lines run, and where the unrun ones are. */
export function printCoverage() {
  const rows = coverageReport();
  let lines = 0;
  let covered = 0;
  console.log("\nCoverage of the page's code by the browser checks (lines of code run):");
  for (const r of rows) {
    lines += r.lines;
    covered += r.covered;
    const pct = ((100 * r.covered) / Math.max(1, r.lines)).toFixed(1).padStart(5);
    const where = r.unrun.slice(0, 12).join(" ") + (r.unrun.length > 12 ? ` … (${r.unrun.length} runs)` : "");
    console.log(`  ${pct}%  ${r.path.padEnd(32)} ${where}`);
  }
  console.log(`  ${((100 * covered) / Math.max(1, lines)).toFixed(1).padStart(5)}%  all files (${covered} of ${lines} lines)`);
}
