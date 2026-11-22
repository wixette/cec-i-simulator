// SPDX-License-Identifier: Apache-2.0
//
// The release videos, `pnpm video`: short clips of the machine at work, for posts, in one or
// more languages. 1920 x 1080, H.264 in MP4, with the machine's own sound in AAC. After the
// TRS-80 simulator's tools/video.mjs.
//
//     pnpm video                          into ~/Downloads/cec-i-simulator-v<version>-media/videos/<lang>/
//     pnpm video --lang zh,en             each language into its own folder
//     pnpm video --only organ --fps 60
//
// Frame by frame, not in real time: before the page loads, its clock (requestAnimationFrame,
// performance.now, Date.now, setTimeout, setInterval) is replaced by one this tool moves on
// by exactly one frame at a time, then takes the frame. Everything that moves runs on that
// clock: the 6502, which runs the cycles a frame's time is worth at 1.02 MHz, the typist's
// keys, the disk turning, the camera's flights and the parts coming apart. So a clip is
// smooth, and the machine runs at its own speed in it, however slowly the frames are taken.
// Needs ffmpeg and Chrome (or CHROME set to its path).
//
// The sound is the page's own, taken where the page would play it. Each frame the page hands
// its speaker (js/sim/sound.js, Speaker.frame) the machine's clicks of $C030 for the machine
// time just run. While recording, Speaker.frame is replaced: the same clicks are rendered by
// the same render(), the cone's side and the high-pass filter carried on, into a track at
// their place on the frame clock rather than played. The power-on beep, the bell, MUSIC and
// the games' sounds keep to the picture, however slowly the frames are taken. As on the page,
// there is sound at the real speed only (no fast typing, no slowed clock), so a clip types at
// a person's pace.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { findChrome, ROOT, serve, sleep, start } from "../tests/browser/harness.mjs";
import { bootDisk } from "../tests/disks.js";
import { HELPERS } from "./page-helpers.mjs";

const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** A 1280 x 720 page at one and a half times: 1920 x 1080 frames, its words big enough to read. */
const SIZE = { width: 1280, height: 720, scale: 1.5 };

/** Installed before the page's own scripts: a clock that runs in real time until started. */
const CLOCK = `(() => {
  const real = { now: performance.now.bind(performance), date: Date.now, frame: window.requestAnimationFrame.bind(window),
    timeout: window.setTimeout.bind(window), clear: window.clearTimeout.bind(window),
    interval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window) };
  let manual = false, t = 0, dateAt = 0, nextId = 1e6, frames = [];
  const timers = new Map();
  performance.now = () => (manual ? t : real.now());
  Date.now = () => (manual ? Math.round(dateAt + t) : real.date());
  window.requestAnimationFrame = (cb) => {
    if (manual) { frames.push(cb); return ++nextId; }
    return real.frame((ts) => (manual ? frames.push(cb) : cb(ts)));
  };
  const later = (cb, ms, args, every) => {
    if (!manual) return (every ? real.interval : real.timeout)(cb, ms, ...args);
    const id = ++nextId;
    timers.set(id, { cb, at: t + Math.max(1, ms || 0), args, every: every ? Math.max(1, ms || 0) : 0 });
    return id;
  };
  window.setTimeout = (cb, ms, ...args) => later(cb, ms, args, false);
  window.setInterval = (cb, ms, ...args) => later(cb, ms, args, true);
  window.clearTimeout = (id) => (timers.has(id) ? timers.delete(id) : real.clear(id));
  window.clearInterval = (id) => (timers.has(id) ? timers.delete(id) : real.clearInterval(id));
  window.__clock = {
    start() { t = real.now(); dateAt = real.date() - t; manual = true; },
    // moves time on: every timer due by then, in order, then the frame
    advance(ms) {
      const end = t + ms;
      for (let guard = 0; guard < 200000; guard++) {
        let first = null;
        for (const [id, timer] of timers) if (timer.at <= end && (!first || timer.at < first[1].at)) first = [id, timer];
        if (!first) break;
        const [id, timer] = first;
        t = Math.max(t, timer.at);
        if (timer.every) timer.at += timer.every; else timers.delete(id);
        try { timer.cb(...timer.args); } catch (e) { console.error(e); }
      }
      t = end;
      const due = frames;
      frames = [];
      for (const cb of due) cb(t);
    },
  };
})();`;

/** The sound track's sample rate, and its loudness against the page's full scale. */
const RATE = 48000;
const GAIN = 1.6;

/** Run in the page when recording starts: the camera's drift, frame-by-frame time, and the sound taken. */
const RECORDER = `(async () => {
  const rec = { drift: [0, 0, 1] };
  const { Speaker, render } = await import("./js/sim/sound.js");
  const RATE = ${RATE};
  const chunks = [];
  let cursor = 0, hp = { x: 0, y: 0 }, level = 0, t0 = 0;
  // the page's speaker, rendering into the track instead of playing: the same clicks, the same
  // render(), the cone's side and the filter carried on from frame to frame
  Speaker.prototype.frame = function (m, from, play = true) {
    const to = m.cycles;
    const toggles = m.speaker.splice(0, m.speaker.length);
    const side = level;
    level = (level + toggles.length) & 1;
    if (this.muted || !play || to <= from) return;
    if (!toggles.length && Math.abs(hp.y) < 1e-4) return;
    const d = render(toggles, from, to, side, RATE, hp);
    if (!d.length) return;
    const duration = d.length / RATE;
    // the machine time just run ends now; a frame's picture is taken after its time has run,
    // so the sound goes one frame earlier. Back to back with the last chunk where it meets it.
    let at = (performance.now() - t0) / 1000 - duration - rec.frameS;
    if (Math.abs(at - cursor) < 0.05) at = cursor;
    chunks.push([Math.round(at * RATE), d]);
    cursor = at + duration;
  };
  // the track, so many seconds long: 16-bit PCM, base64
  rec.audio = (secs, gain) => {
    const N = Math.round(secs * RATE), mix = new Float32Array(N);
    for (const [s, d] of chunks) for (let i = Math.max(0, -s); i < d.length && s + i < N; i++) mix[s + i] += d[i];
    const pcm = new Int16Array(N);
    for (let i = 0; i < N; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, mix[i] * gain)) * 32767);
    const bytes = new Uint8Array(pcm.buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  // turns the camera by degrees across (+: to the machine's right) and up, and scales its distance
  rec.orbit = (across, up, zoom) => {
    const v = app.viewer;
    if (!v || v.isFlying()) return;
    const c = v.camera, target = v.controls.target, o = c.position.clone().sub(target), r = o.length() * zoom;
    const theta = Math.atan2(o.x, o.z) + (across * Math.PI) / 180;
    const phi = Math.min(Math.max(Math.acos(o.y / o.length()) - (up * Math.PI) / 180, 0.1), 1.9);
    c.position.copy(target).add(o.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)).multiplyScalar(r));
    c.lookAt(target);
    app.stage.fitted = null;
  };
  rec.frame = (dt) => {
    rec.frameS = dt;
    const [a, u, z] = rec.drift;
    if (a || u || z !== 1) rec.orbit(a * dt, u * dt, z ** dt);
    __clock.advance(dt * 1000);
  };
  // keys typed in a clip go at a person's pace, with the sound on, not Type in's eight times
  cec.fastTyping = false;
  window.__rec = rec;
  rec.frameS = 0;
  __clock.start();
  t0 = performance.now();
})()`;

/**
 * What a scene's script can do, frame-exact. Page code runs between frames, as a visitor's
 * presses would.
 * @typedef {object} Take
 * @property {(js: string) => Promise<unknown>} run runs page code now
 * @property {(seconds: number) => Promise<void>} hold records this long
 * @property {(seconds?: number) => Promise<void>} settle records until the camera has landed and the parts are at rest
 * @property {(across: number, up?: number, zoom?: number) => Promise<void>} drift turns the camera on its own: degrees across and up, and a zoom, a second
 * @property {(view: string, seconds?: number) => Promise<void>} view flies to a view, and records the flight and a little after
 * @property {(keys: string) => Promise<void>} type types on the machine's keys ({name} a key), and records until it is typed
 * @property {(text: string) => Promise<void>} typeIn types text with Chinese, through 区位, and records until it is typed
 * @property {(js: string, seconds?: number) => Promise<void>} until records until page code is true (or for at most so long)
 * @property {(key: string, seconds?: number) => Promise<void>} tap presses a key of the machine's (an id: "space", "1", "right") for a moment
 * @property {(notes: string, beat?: number) => Promise<void>} play plays keys of the machine's in time: "3 3 5 6 >1 1 <6 5:2" (a key, and its length in beats after a colon; > and < press → and ← first)
 */

/** @typedef {{ name: string, setup: string, script: (t: Take) => Promise<void> }} Scene */

/** @type {Scene[]} */
const SCENES = [
  {
    // the page at a glance: switched on with its beep and banner, BASIC answering, the 中文
    // key and Chinese typed through the machine's own 区位 input, the views of the 3D model,
    // then 2D with the keyboard drawn out, and back to 3D
    name: "01-switch-on-and-tour",
    setup: `fold(); cec.power(false); cec.tvPower(false); await view("angle");`,
    async script(t) {
      await t.drift(-1.5, 0.2);
      await t.hold(1.2);
      await t.run(`cec.tvPower(true); cec.power(true)`);
      await t.until(`cec.machine.screenText().some((l) => /^\\]/.test(l))`, 8);
      await t.drift(0);
      await t.view("screen", 1.4);
      await t.type('PRINT "HELLO FROM 1987"\n');
      await t.hold(1);
      await t.typeIn('PRINT "你好，中华学习机"\n');
      await t.hold(1.5);
      await t.view("keyboard", 2);
      await t.view("inside", 1.2);
      await t.drift(5, 0.3);
      await t.hold(2.5);
      await t.drift(0);
      await t.view("front", 2);
      await t.run(`app.stage.setMode("2d")`);
      await t.until("!app.stage.moving", 6);
      await t.hold(2);
      await t.run(`app.stage.setMode("3d")`);
      await t.until("!app.stage.moving && !app.viewer.isFlying()", 6);
      await t.hold(1.5);
    },
  },
  {
    // Chinese inside: a string of five characters, fifteen bytes, and the Chinese instrument
    // reading each character's dots out of the font chips through the $C0B0 window
    name: "02-chinese-inside",
    setup: `await ready(); dockHeight(330); tab("hanzi"); await view("screen");`,
    async script(t) {
      await t.hold(1);
      await t.typeIn('A$="中华学习机":PRINT A$:PRINT LEN(A$)\n');
      await t.hold(4);
    },
  },
  {
    // a big 中 drawn from the font chips' own 32 bytes, then 机
    name: "03-big-character",
    setup: `fold(); await ready(); await program("bigchar"); await until(() => shows(/QUWEI/)); await view("screen");`,
    async script(t) {
      await t.hold(0.8);
      await t.type("5448\n");
      await t.hold(5);
      await t.drift(1, 0.2);
      await t.until(`cec.machine.screenText().some((l) => /QUWEI/.test(l))`, 20);
      await t.type("2790\n");
      await t.hold(5);
      await t.drift(0);
    },
  },
  {
    // taken apart, every unit out in order, looked round, put back
    name: "04-take-apart",
    setup: `fold(); cec.power(false); await view("angle");`,
    async script(t) {
      await t.drift(2);
      await t.hold(1.2);
      await t.drift(0);
      await t.view("apart", 0.5);
      await t.settle(25);
      await t.drift(9, 0, 0.995);
      await t.hold(5);
      await t.drift(0);
      await t.view("front", 0.5);
      await t.settle(12);
      await t.hold(1);
    },
  },
  {
    // inside: the lid and the keyboard as glass, the chips lit by their traffic as LOGO draws
    name: "05-inside-while-it-runs",
    setup: `fold(); await ready(); await program("kaleidoscope"); await view("inside");`,
    async script(t) {
      await t.drift(6, 0.4);
      await t.hold(8);
      await t.drift(0);
      await t.hold(0.5);
    },
  },
  {
    // the Music box: 茉莉花, written in 简谱 in DATA lines, played by CEC-BASIC's own MUSIC
    name: "06-music-box",
    setup: `fold(); await ready(); await program("musicbox"); await until(() => shows(/WHICH TUNE/)); await view("screen");`,
    async script(t) {
      await t.hold(1);
      await t.tap("1");
      await t.drift(0.6, 0, 0.997);
      await t.hold(14);
      await t.drift(0);
      await t.view("front", 1.8);
      await t.hold(4);
    },
  },
  {
    // 2D only: the Organ played on the keyboard drawn out under the TV, each key going down as
    // it sounds, the note lit on the machine's own screen: the opening of 茉莉花
    name: "07-organ-in-2d",
    setup: `fold(); await ready(); await program("organ"); await until(() => shows(/KEYS 1-7/));
      app.stage.setMode("2d"); await sleep(1500); if (!app.flat.drawerOpen) app.flat.setDrawer(true); await sleep(800);`,
    async script(t) {
      await t.hold(1);
      await t.play("3 3 5 6 >1 1 <6 5:2 5 6 5:3");
      await t.play("3 3 5 6 >1 1 <6 5:2 5 6 5:3");
      await t.hold(1.5);
    },
  },
  {
    // LOGO's turtle drawing the Kaleidoscope, eight times round, in colour
    name: "08-kaleidoscope",
    setup: `fold(); await ready(); await program("kaleidoscope"); await view("screen");`,
    async script(t) {
      await t.drift(1.2, 0.3);
      await t.hold(6);
      await t.drift(0);
      await t.view("front", 1.8);
      await t.drift(-2);
      await t.hold(5);
    },
  },
  {
    // a lesson: Type it types the step's program on the machine's keys, it runs, the step ticks
    name: "09-a-lesson",
    setup: `await ready(); dockHeight(380); tab("lessons"); document.getElementById("lesson-tab-basic").click(); await sleep(400); await view("screen");`,
    async script(t) {
      await t.hold(1.2);
      await t.run(`document.querySelector('#pane-lessons .step[data-step="loop"]').scrollIntoView({ block: "center" })`);
      await t.hold(0.8);
      await t.run(`document.querySelector('#pane-lessons .step[data-step="loop"] .chip.type-it').click()`);
      await t.until("!cec.typist.busy", 40);
      await t.until(`document.querySelector('#pane-lessons .step[data-step="loop"]').classList.contains("done")`, 6);
      await t.hold(3);
    },
  },
  {
    // a disk of our own dropped on the page, started from as the manual starts one: switched
    // off and on, the drive's lamp lit while the ROM reads it
    name: "10-start-from-a-disk",
    setup: `fold(); await ready(); await view("angle");`,
    async script(t) {
      await t.hold(1);
      await t.run(`(() => { const f = new File([new Uint8Array(${JSON.stringify([...bootDisk()])})], "ours.dsk"); const dt = new DataTransfer(); dt.items.add(f); document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); })()`);
      await t.hold(2.5);
      await t.run(`[...document.querySelectorAll("dialog[open] .dialog-actions button")].at(-1).click()`);
      await t.view("screen", 1);
      await t.until(`cec.machine.screenText().some((l) => l.includes("BOOTED FROM A DISK"))`, 15);
      await t.hold(2.5);
    },
  },
];

const { values: opts } = parseArgs({
  options: {
    lang: { type: "string", default: "zh,en" },
    out: { type: "string", default: join(homedir(), "Downloads", `cec-i-simulator-v${VERSION}-media`, "videos") },
    only: { type: "string", default: "" },
    fps: { type: "string", default: "30" },
  },
});
const FPS = Number(opts.fps);
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
  for (const scene of SCENES.filter((s) => s.name.includes(opts.only))) {
    const h = await start(chrome, server.url, `&lang=${encodeURIComponent(lang)}`);
    const out = join(dir, `${scene.name}.mp4`);
    const silent = join(dir, `.${scene.name}.video.mp4`);
    const wav = join(dir, `.${scene.name}.wav`);
    let frames = 0;
    try {
      await h.send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });
      await h.viewport(SIZE.width, SIZE.height, false, SIZE.scale);
      await h.open();
      await h.js(`(async () => { ${HELPERS} ${scene.setup}; welcome(); })()`);
      await sleep(800);
      await h.js(RECORDER);
      const encoder = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", silent], { stdio: ["pipe", "ignore", "inherit"] });
      const encoded = new Promise((r) => encoder.on("exit", r));
      const frame = async () => {
        await h.js(`__rec.frame(${1 / FPS})`);
        const shot = await h.send("Page.captureScreenshot", { format: "jpeg", quality: 95 });
        if (!encoder.stdin.write(Buffer.from(shot.result.data, "base64"))) await new Promise((r) => encoder.stdin.once("drain", r));
        frames++;
      };
      /** @param {number} seconds */
      const hold = async (seconds) => {
        for (let i = Math.round(seconds * FPS); i > 0; i--) await frame();
      };
      /** @param {string} id @param {number} seconds */
      const press = async (id, seconds) => {
        await h.js(`cec.keyDown(${JSON.stringify(id)}, "key")`);
        await hold(seconds);
        await h.js(`cec.keyUp(${JSON.stringify(id)}, "key")`);
      };
      /** @type {Take} */
      const take = {
        run: (js) => h.js(js),
        hold,
        async settle(seconds = 10) {
          await frame();
          for (let i = seconds * FPS; i > 0 && (await h.js("app.viewer.isFlying() || [...cec.motion.values()].some((m) => m.f !== m.target)")); i--) await frame();
        },
        drift: async (across, up = 0, zoom = 1) => void (await h.js(`__rec.drift = [${across}, ${up}, ${zoom}]`)),
        async view(v, seconds = 1.5) {
          await h.js(`app.stage.goTo(${JSON.stringify(v)})`);
          await hold(seconds);
        },
        async type(keys) {
          await h.js(`cec.type(${JSON.stringify(keys)})`);
          await frame();
          for (let i = 90 * FPS; i > 0 && (await h.js("cec.typist.busy")); i--) await frame();
        },
        async typeIn(text) {
          await h.js(`cec.typeIn(${JSON.stringify(text)})`);
          await frame();
          for (let i = 120 * FPS; i > 0 && (await h.js("cec.typist.busy")); i--) await frame();
        },
        async until(js, seconds = 30) {
          for (let i = seconds * FPS; i > 0 && !(await h.js(js)); i--) await frame();
        },
        tap: (key, seconds = 0.12) => press(key, seconds),
        async play(notes, beat = 0.42) {
          for (const n of notes.split(/\s+/).filter(Boolean)) {
            const [note, len] = n.split(":");
            for (const ch of note.slice(0, -1)) {
              if (ch === ">" || ch === "<") await press(ch === ">" ? "right" : "left", 0.06);
            }
            const key = note.at(-1) ?? "";
            const beats = Number(len || 1);
            if (key === "-") {
              await hold(beat * beats);
              continue;
            }
            await press(key, beat * beats - 0.08);
            await hold(0.08);
          }
        },
      };
      await scene.script(take);
      encoder.stdin.end();
      await encoded;
      // the sound, as long as the picture, put with it
      writeFileSync(wav, wavFile(Buffer.from(String(await h.js(`__rec.audio(${frames / FPS}, ${GAIN})`)), "base64")));
      await new Promise((resolve, reject) => {
        const mux = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], { stdio: ["ignore", "ignore", "inherit"] });
        mux.on("exit", (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve(undefined)));
      });
    } catch (e) {
      h.errors.push(String(e));
    } finally {
      await h.stop();
      rmSync(silent, { force: true });
      rmSync(wav, { force: true });
    }
    if (h.errors.length) failed++;
    console.log(`${lang}/${scene.name}.mp4  ${(frames / FPS).toFixed(1)} s${h.errors.length ? `  ERROR ${h.errors.join("; ")}` : ""}`);
  }
}
server.close();

/** A mono 16-bit WAV file round PCM samples. @param {Buffer} pcm */
function wavFile(pcm) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}
process.exitCode = failed ? 1 : 0;
