// SPDX-License-Identifier: Apache-2.0
//
// `pnpm test:6502`: runs Tom Harte's SingleStepTests for the NMOS 6502 (MIT) against
// js/sim/cpu6502.js: all 10,000 cases of each of the 151 documented opcodes, checking the
// registers, the memory and the cycle count. The opcode files (about 5 MB each) are
// downloaded once, at a pinned commit, into tests/.cache/harte6502/ (not committed).
//
//   node tools/harte6502.mjs [--sample]
//
// --sample also rewrites tests/data/harte6502-sample.json (the first SAMPLE cases of each
// opcode), which tests/cpu6502.test.js runs with the unit tests.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Cpu6502, DOCUMENTED } from "../js/sim/cpu6502.js";

const COMMIT = "2f6980a2d95757486c7bee24355c360e40e2a224";
const BASE = `https://raw.githubusercontent.com/SingleStepTests/65x02/${COMMIT}/6502/v1/`;
const SAMPLE = 12;

/**
 * @typedef {object} CpuState
 * @property {number} pc @property {number} s @property {number} a @property {number} x
 * @property {number} y @property {number} p @property {[number, number][]} ram
 */
/** @typedef {{ name: string, initial: CpuState, final: CpuState, cycles: number | unknown[] }} Case */

/** @param {Case} t one test case @returns {string | null} what differs, or null */
export function runCase(t) {
  /** @type {Map<number, number>} */
  const ram = new Map(t.initial.ram);
  const cpu = new Cpu6502({ read: (a) => ram.get(a) ?? 0, write: (a, v) => void ram.set(a, v) });
  Object.assign(cpu, { pc: t.initial.pc, s: t.initial.s, a: t.initial.a, x: t.initial.x, y: t.initial.y, p: t.initial.p });
  const cyc = cpu.step();
  const f = t.final;
  const bad = [];
  for (const k of /** @type {const} */ (["pc", "s", "a", "x", "y", "p"])) if (cpu[k] !== f[k]) bad.push(`${k} ${cpu[k]} != ${f[k]}`);
  for (const [a, v] of f.ram) if ((ram.get(a) ?? 0) !== v) bad.push(`[${a}] ${ram.get(a)} != ${v}`);
  const want = typeof t.cycles === "number" ? t.cycles : t.cycles.length;
  if (cyc !== want) bad.push(`cycles ${cyc} != ${want}`);
  return bad.length ? bad.join(", ") : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cache = fileURLToPath(new URL("../tests/.cache/harte6502/", import.meta.url));
  mkdirSync(cache, { recursive: true });
  /** @type {Case[]} */
  const sample = [];
  let total = 0;
  let failed = 0;
  for (let op = 0; op < 256; op++) {
    if (!DOCUMENTED[op]) continue;
    const name = `${op.toString(16).padStart(2, "0")}.json`;
    const file = join(cache, name);
    // fetched once, with a few tries: the files are large and a connection may drop
    for (let tries = 1; !existsSync(file); tries++) {
      try {
        const r = await fetch(BASE + name);
        if (!r.ok) throw new Error(`${name}: ${r.status}`);
        const data = Buffer.from(await r.arrayBuffer());
        writeFileSync(`${file}.part`, data);
        renameSync(`${file}.part`, file);
      } catch (e) {
        if (tries >= 5) throw e;
        await new Promise((ok) => setTimeout(ok, 2000 * tries));
      }
    }
    /** @type {Case[]} */
    const tests = JSON.parse(readFileSync(file, "utf8"));
    let bad = 0;
    let first = "";
    for (const t of tests) {
      total++;
      const why = runCase(t);
      if (why) {
        bad++;
        if (!first) first = `${t.name}: ${why}`;
      }
    }
    failed += bad;
    if (bad) console.log(`${name}: ${bad} of ${tests.length} failed; the first: ${first}`);
    sample.push(...tests.slice(0, SAMPLE).map((t) => ({ name: t.name, initial: t.initial, final: t.final, cycles: Array.isArray(t.cycles) ? t.cycles.length : t.cycles })));
  }
  console.log(`${total} cases, ${failed} failed`);
  if (process.argv.includes("--sample")) {
    writeFileSync(new URL("../tests/data/harte6502-sample.json", import.meta.url), JSON.stringify(sample));
    console.log(`sample: ${sample.length} cases`);
  }
  if (failed) process.exitCode = 1;
}
