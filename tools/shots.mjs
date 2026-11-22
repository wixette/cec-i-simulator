// SPDX-License-Identifier: Apache-2.0
//
// The release screenshots, `pnpm shots`: the README's pictures, and a set for posts (the
// machine in 3D from several sides, inside, taken apart, Chinese on its screen, our programs
// and games, the lessons, the instruments, a phone), in one language or several; and the
// GitHub page's social preview. After the TRS-80 simulator's tools/shots.mjs. Short clips for
// posts are `pnpm video` (tools/video.mjs).
//
//     pnpm shots                     into ~/Downloads/cec-i-simulator-v<version>-media/shots/<lang>/
//     pnpm shots --only lesson       the shots whose name holds "lesson"
//     pnpm shots --readme            and the README's, into screenshots/zh/ and screenshots/en/
//     pnpm shots --lang zh,en,ja     in these languages, each into its own folder (U11)
//
// Headless Chrome with its GPU (tests/browser/harness.mjs), 1600 x 900 at twice the pixels,
// written as JPEGs. Each shot opens the page afresh, as a first visit, and sets it up through
// the page's own handles (?debug), as a visitor would leave it. The README's copies need
// ffmpeg, to scale them.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { findChrome, ROOT, serve, sleep, start } from "../tests/browser/harness.mjs";
import { HELPERS } from "./page-helpers.mjs";

const QUALITY = 90;

/**
 * A JPEG with nothing but its picture: every APP1 to APP15 segment (EXIF, XMP, an ICC profile,
 * IPTC) and every comment dropped, JFIF's APP0 kept (tests/photos.test.js).
 * @param {Buffer} jpeg
 */
function bare(jpeg) {
  const parts = [jpeg.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= jpeg.length && jpeg[i] === 0xff) {
    const marker = jpeg[i + 1];
    if (marker === 0xda) break; // the scan: the rest is the picture
    const end = i + 2 + jpeg.readUInt16BE(i + 2);
    if (!((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe)) parts.push(jpeg.subarray(i, end));
    i = end;
  }
  parts.push(jpeg.subarray(i));
  return Buffer.concat(parts);
}
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** The sizes a shot is taken at. */
const SIZES = {
  desktop: { width: 1600, height: 900, phone: false, scale: 2 },
  phone: { width: 390, height: 844, phone: true, scale: 3 },
  // GitHub's social preview: 1280 x 640
  social: { width: 1280, height: 640, phone: false, scale: 1 },
};

/**
 * A shot: its file name, its size, its setup (run in the page with HELPERS), how long to let
 * it settle, and its name in screenshots/ if the README shows it.
 * @typedef {{ name: string, size?: keyof typeof SIZES, setup: string, wait?: number, readme?: string }} Shot
 */

/** @type {Shot[]} */
const SHOTS = [
  // the first picture: the machine and its TV in 3D, Chinese on the screen (a big 中 drawn from
  // the font chips), the lessons below
  {
    name: "app-3d-lessons",
    readme: "app",
    wait: 3000,
    setup: `await ready(); await program("bigchar"); await until(() => shows(/QUWEI/)); await type("5448\\n"); await drawn();
      dockHeight(330); tab("lessons"); await view("front");`,
  },
  // Chinese typed through the machine's own system, and the Chinese instrument reading it
  {
    name: "chinese-tool",
    readme: "chinese",
    wait: 2000,
    setup: `await ready(); await typeIn('A$="中华学习机":PRINT A$\\n'); dockHeight(470); tab("hanzi"); await view("screen");`,
  },
  // a lesson: Talk to BASIC, its first program typed by Type it, run, and ticked
  {
    name: "lesson-basic",
    readme: "lessons",
    wait: 1500,
    setup: `await ready(); dockHeight(470); tab("lessons"); document.getElementById("lesson-tab-basic").click(); await sleep(300);
      document.querySelector('#pane-lessons .step[data-step="first"] .chip.type-it').click(); await typed();
      await until(() => document.querySelector('#pane-lessons .step[data-step="first"]').classList.contains("done"), 8000);
      document.querySelector('#pane-lessons .step[data-step="loop"] .chip.type-it').click(); await typed();
      await until(() => document.querySelector('#pane-lessons .step[data-step="loop"]').classList.contains("done"), 8000);
      document.querySelector('#pane-lessons .lesson').scrollIntoView({ block: "start" }); await view("screen");`,
  },
  // Programs: our own, in sections, with Games open (the machine moved right, clear of the menu)
  {
    name: "programs-menu",
    readme: "programs",
    setup: `await ready(); await program("kaleidoscope"); await sleep(5000); dockHeight(330); tab("lessons"); await view("front");
      pan(380); await sleep(300); await programsMenu(2);`,
  },
  // games and programs on the screen, close up
  { name: "screen-snake", wait: 3000, setup: `fold(); await ready(); await program("snake"); await view("screen"); await press("space"); await sleep(1800);` },
  { name: "screen-bricks", wait: 3000, setup: `fold(); await ready(); await program("bricks"); await view("screen"); await press("space"); await sleep(1500);` },
  { name: "screen-kaleidoscope", wait: 9000, setup: `fold(); await ready(); await program("kaleidoscope"); await view("screen");` },
  { name: "screen-numbers", wait: 1500, setup: `fold(); await ready(); await program("numread"); await view("screen"); await type("123456789\\n"); await sleep(3000);` },
  { name: "screen-clock", wait: 25000, setup: `fold(); await ready(); await program("clock"); await view("screen"); await type("10\\n"); await type("9\\n"); await type("30\\n");` },
  { name: "screen-minehunt", wait: 2000, setup: `fold(); await ready(); await program("minehunt"); await view("screen"); await press("space"); await sleep(1200); await press("return"); await sleep(2500);` },
  // the 2D view: the TV and its keyboard drawn out, Bricks under way
  { name: "2d-drawer", readme: "2d", wait: 2500, setup: `fold(); await ready(); await program("bricks"); app.stage.setMode("2d"); await sleep(1500); if (!app.flat.drawerOpen) app.flat.setDrawer(true); await press("space");` },
  // inside, the chips lit as a program runs
  { name: "3d-inside", readme: "inside", wait: 3000, setup: `fold(); await ready(); await program("kaleidoscope"); await view("inside");` },
  // taken apart
  { name: "3d-apart", readme: "apart", wait: 7000, setup: `fold(); cec.power(false); await view("apart");` },
  { name: "3d-three-quarter", setup: `fold(); await ready(); await program("bigchar"); await until(() => shows(/QUWEI/)); await type("2790\\n"); await drawn(); await view("angle");` },
  { name: "3d-keyboard", setup: `fold(); await ready(); await view("keyboard");` },
  { name: "3d-back", setup: `fold(); await ready(); await view("back");` },
  // the instruments
  { name: "tool-cpu", readme: "cpu", setup: `await ready(); await program("versus"); await sleep(3000); dockHeight(470); tab("cpu"); await sleep(600); cec.pause();` },
  {
    name: "tool-screen",
    setup: `await ready(); await type("HOME:POKE 1029,193\\n"); dockHeight(470); tab("screen"); await sleep(600);
      document.querySelectorAll("#pane-screen .page-cell")[5]?.click();`,
  },
  // on a phone: 2D, where a phone types
  { name: "phone-2d", size: "phone", wait: 2500, setup: `await ready(); await program("snake"); app.stage.setMode("2d"); await sleep(1500); await press("space");` },
  // the GitHub page's preview: the machine and a Chinese screen, the stage alone
  {
    name: "social-preview",
    size: "social",
    wait: 3000,
    setup: `await ready(); await program("bigchar"); await until(() => shows(/QUWEI/)); await type("5448\\n"); await drawn(); fold(); await view("angle"); app.viewer.zoom(0.78); app.stage.fitted = null; await sleep(300);`,
  },
];

const { values: opts } = parseArgs({
  options: {
    out: { type: "string", default: join(homedir(), "Downloads", `cec-i-simulator-v${VERSION}-media`, "shots") },
    only: { type: "string", default: "" },
    lang: { type: "string", default: "zh,en" },
    readme: { type: "boolean", default: false },
  },
});
const chrome = findChrome();
if (!chrome) {
  console.error("Chrome was not found: set CHROME to its path.");
  process.exit(2);
}
const server = await serve();
let failed = 0;
for (const lang of opts.lang.split(",")) {
  const dir = join(opts.out, lang);
  mkdirSync(dir, { recursive: true });
  // the README's pictures: the Chinese README's in Chinese, the English one's in English
  const readmeDir = join(ROOT, "screenshots", lang);
  const forReadme = opts.readme && (lang === "zh" || lang === "en");
  if (forReadme) mkdirSync(readmeDir, { recursive: true });
  for (const shot of SHOTS.filter((s) => s.name.includes(opts.only))) {
    const h = await start(chrome, server.url, `&lang=${encodeURIComponent(lang)}`);
    try {
      const size = SIZES[shot.size ?? "desktop"];
      await h.viewport(size.width, size.height, size.phone, size.scale);
      await h.open();
      await h.js(`(async () => { ${HELPERS} ${shot.setup}; welcome(); })()`);
      await sleep(shot.wait ?? 1500);
      const image = await h.send("Page.captureScreenshot", { format: "jpeg", quality: QUALITY });
      const bytes = Buffer.from(image.result.data, "base64");
      writeFileSync(join(dir, `${shot.name}.jpg`), bytes);
      if (forReadme && shot.readme) {
        // the README's copy, 1600 pixels wide: sharp on GitHub, and light; no metadata
        const made = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-i", "pipe:0", "-vf", "scale=1600:-2", "-q:v", "3", "-map_metadata", "-1", "-flags:v", "+bitexact", join(readmeDir, `${shot.readme}.jpg`)], { input: bytes });
        if (made.status) h.errors.push(`ffmpeg: ${made.stderr}`);
        // ffmpeg keeps Chrome's ICC profile (APP2); the README's copies carry none
        else writeFileSync(join(readmeDir, `${shot.readme}.jpg`), bare(readFileSync(join(readmeDir, `${shot.readme}.jpg`))));
      }
    } catch (e) {
      h.errors.push(String(e));
    } finally {
      await h.stop();
    }
    if (h.errors.length) failed++;
    console.log(`${lang}/${shot.name}.jpg${h.errors.length ? `  ERROR ${h.errors.join("; ")}` : ""}`);
  }
}
server.close();
process.exitCode = failed ? 1 : 0;
