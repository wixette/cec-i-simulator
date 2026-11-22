// SPDX-License-Identifier: Apache-2.0
//
// The browser checks: the page itself, in a headless Chrome, for what the Node tests cannot
// reach: clicks, keys, menus, dialogs, the 3D and 2D views, the layout at a phone's width.
//
//     pnpm test:browser                   every check
//     pnpm test:browser boot disk         just these
//     pnpm test:browser --coverage        and what of the page's code they reach
//
// They need Chrome (or CHROME set to its path) and take several minutes, so they are run on a
// developer's machine before each release, not in CI, which stays fast (docs/development.md).
// Each check gets a fresh browser profile. As the TRS-80 simulator's.

import { existsSync } from "node:fs";
import { hasCoverage, printCoverage } from "./coverage.mjs";
import { findChrome, killAll, serve, start } from "./harness.mjs";

const CHECKS = ["boot", "keys", "typein", "views", "labels", "flat", "programs", "lessons", "disk", "tools", "layout", "dialogs", "access", "lang"];

const chrome = findChrome();
if (!chrome || !existsSync(chrome)) {
  console.error(`${chrome ? `Chrome is not at ${chrome}.` : "Chrome was not found."} Set CHROME to its path, e.g.\n  CHROME=/usr/bin/chromium pnpm test:browser`);
  process.exit(2);
}
for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM"])) {
  process.on(signal, () => {
    killAll();
    process.exit(130);
  });
}
const coverage = process.argv.includes("--coverage");
const wanted = process.argv.slice(2).filter((a) => a !== "--coverage");
const unknown = wanted.filter((n) => !CHECKS.includes(n));
if (unknown.length) {
  console.error(`No such check: ${unknown.join(", ")}. The checks are: ${CHECKS.join(", ")}`);
  process.exit(2);
}
const server = await serve();
let passed = 0;
let failed = 0;
for (const name of wanted.length ? wanted : CHECKS) {
  console.log(name);
  /** @type {{ default: (h: import("./harness.mjs").Harness) => Promise<void> }} */
  const module = await import(`./${name}.mjs`);
  /** @type {import("./harness.mjs").Harness | null} */
  let h = null;
  try {
    h = await start(chrome, server.url, "", { coverage });
    await module.default(h);
  } catch (e) {
    if (!h) {
      console.log(`  FAIL the browser started  | ${e instanceof Error ? e.message : e}`);
      failed++;
      continue;
    }
    h.verify("ran to the end", false, e instanceof Error ? e.stack : String(e));
  } finally {
    await h?.stop();
  }
  if (!h) continue;
  if (h.errors.length) h.verify("no errors in the page", false, h.errors);
  passed += h.results.filter((r) => r.ok).length;
  failed += h.results.filter((r) => !r.ok).length;
}
server.close();
if (coverage && hasCoverage()) printCoverage();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
