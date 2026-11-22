// SPDX-License-Identifier: Apache-2.0
//
// Helpers run in the page for `pnpm shots` and `pnpm video` (the page opened with ?debug, so
// its handles `cec` and `app` are within reach): BASIC's prompt waited for, one of our
// programs typed in as Type it in types it, keys and Chinese typed, a view, a tab, the dock's
// height or fold, the camera panned, and Programs opened on a section. Nothing here names a
// label in a language, so a setup works in each of the ten. After the TRS-80 simulator's.

export const HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 30000) => { const end = Date.now() + ms; while (!f() && Date.now() < end) await sleep(100); };
  const samples = await import("./js/sim/samples.js");
  const { t } = await import("./js/l10n/l10n.js");
  const screen = () => cec.machine.screenText();
  const typed = async () => { await until(() => !cec.typist.busy, 180000); await sleep(600); };
  // BASIC's prompt, after the ROM has looked for a disk
  const ready = async () => { await until(() => screen().some((l) => /^\\]/.test(l)), 30000); await sleep(300); };
  // one of our programs, typed in from wherever the machine is, as its dialog's Type it in does
  const program = async (id) => {
    const sm = samples.SAMPLES.find((x) => x.id === id);
    cec.typeProgram(sm, t("sample." + id + ".title"));
    await typed();
  };
  // keys on the machine's own keyboard ({name} a key), and text with Chinese, through 区位
  const type = async (keys) => { cec.type(keys); await typed(); };
  const typeIn = async (text) => { cec.typeIn(text); await typed(); };
  // a key of the machine's held a moment, as a finger presses it (an id of js/sim/keyboard.js)
  const press = async (id, ms = 120) => { cec.keyDown(id, "key"); await sleep(ms); cec.keyUp(id, "key"); };
  const shows = (re) => screen().some((l) => re.test(l));
  // the hi-res picture finished: its page's memory unchanged for a while
  const drawn = async (quiet = 1500, ms = 40000) => {
    const sum = () => { let h = 0; const r = cec.machine.ram; for (let a = 0x2000; a < 0x6000; a++) h = (h * 31 + r[a]) | 0; return h; };
    const end = Date.now() + ms;
    let last = sum(), since = Date.now();
    while (Date.now() < end && Date.now() - since < quiet) { await sleep(250); const now = sum(); if (now !== last) { last = now; since = Date.now(); } }
  };
  const view = async (v) => { app.stage.goTo(v); await sleep(200); await until(() => !app.viewer.isFlying(), 8000); await sleep(500); };
  const tab = (id) => app.dock.show(id);
  const dockHeight = (px) => { app.dock.folded = false; app.dock.choose(px); };
  const fold = () => { app.dock.folded = true; app.dock.apply(); };
  // slides the picture across the stage by so many pixels (+: right), as a camera's lens
  // shifts, so that the machine is seen just as before, only further across
  const pan = (px) => {
    const v = app.viewer, { width, height } = v.size();
    v.camera.setViewOffset(width, height, -px, 0, width, height);
    v.camera.updateProjectionMatrix();
  };
  // Programs, open on its n-th section (0 Learn, 1 Chinese, 2 Games, 3 Utilities, 4 Music, 5 LOGO)
  const programsMenu = async (section) => {
    document.getElementById("programs").click();
    await sleep(300);
    document.querySelectorAll(".menu [role=menuitem]")[section]?.click();
    await sleep(300);
  };
  // the status line as a first visit has it, not a setup's last message
  const welcome = () => cec.say({ key: cec.machine.powered ? "status.welcome" : "status.welcomeOff" });
  await until(() => !app.viewer || app.model() !== null);
`;
