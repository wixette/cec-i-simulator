// SPDX-License-Identifier: Apache-2.0
//
// The disk drive and saving (design/v0.0.5.md): a disk image of our own dropped on the page
// is inserted, the dialog offers to start from it, and it boots (the drive on the strip,
// always there, its lamp lit while it reads); Save the disk image is offered; Eject empties the drive; a blank
// disk goes in without starting; Save the program asks for a name, its first REM line's, and
// saves under the name asked; the disk image is saved under its name; a BASIC file and a .logo
// file dropped on the page are typed in; the sound button.

import { bootDisk } from "../disks.js";

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  h.verify("the drive is on the strip with no disk in it, and its button opens the Disk menu", (await h.js("!document.querySelector('.strip-body .drive').closest('.strip-group').hidden && document.querySelector('.strip-body .drive').textContent.includes('No disk')")) && (await h.js("(document.querySelector('.strip-body .drive').click(), true)")) && (await h.until("[...document.querySelectorAll('.menu [role^=menuitem]')].some((b) => b.textContent.startsWith('Insert a disk image'))", 1000)));
  await h.key("Escape");
  // a disk dropped on the page
  await h.js(`(() => {
    const f = new File([new Uint8Array(${JSON.stringify([...bootDisk()])})], "ours.dsk");
    const dt = new DataTransfer();
    dt.items.add(f);
    document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  })()`);
  h.verify("a disk image dropped on the page goes in the drive, and the dialog offers to start from it", (await h.until("document.querySelector('dialog[open]') !== null", 3000)) && (await h.js("cec.disk?.name")) === "ours.dsk");
  h.verify("the drive shows on the strip, with the disk's name", await h.js("!document.querySelector('.strip-body .drive').closest('.strip-group').hidden && document.querySelector('.strip-body .drive').textContent.includes('ours.dsk')"));
  await h.pressText("dialog[open] .dialog-actions button", "Start from the disk");
  h.verify("Start from the disk: the drive's lamp lights", await h.until("document.querySelector('.drive-lamp.on') !== null", 3000));
  h.verify("… and our disk boots", await h.until("cec.machine.screenText().some((l) => l.includes('BOOTED FROM A DISK OF OUR OWN'))", 15000), await h.screen());
  await h.press("#programs");
  await h.sleep(200);
  await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].find((b) => b.textContent.startsWith('Disk')).click()");
  await h.sleep(200);
  h.verify("Save the disk image is offered while a disk is in", await h.js("[...document.querySelectorAll('.menu [role=menuitem]')].some((b) => b.textContent.startsWith('Save the disk image') && b.getAttribute('aria-disabled') !== 'true')"));
  await h.key("Escape");
  await h.key("Escape");
  await h.choose("#programs", "Disk ▸ Eject");
  h.verify("Eject empties the drive, and the strip's drive says so", (await h.until("cec.disk === null", 1000)) && (await h.until("document.querySelector('.strip-body .drive').textContent.includes('No disk')", 1000)));
  // a blank disk, the machine left as it is
  await h.choose("#programs", "Disk ▸ Insert a blank disk");
  await h.until("document.querySelector('dialog[open]') !== null", 2000);
  await h.pressText("dialog[open] .dialog-actions button", "Just insert it");
  h.verify("a blank disk goes in, the machine as it was", (await h.js("cec.disk?.name")) === "blank.dsk" && (await h.js("cec.machine.powered")));
  // Save the program: a name, the first REM line's
  // our disk's code loops for ever: Ctrl-Reset, back to BASIC
  await h.js("cec.ctrlReset()");
  await h.until("cec.machine.screenText().some((l) => /^\\]$/.test(l))", 8000);
  await h.choose("#programs", "Type in");
  await h.js(`document.querySelector('dialog[open] textarea').value = '10 REM MY GAME\\n20 PRINT "HI"\\n'`);
  await h.pressText("dialog[open] .dialog-actions button", "Type it in");
  await h.typed(60000);
  await h.choose("#programs", "Save the program");
  h.verify("Save the program asks for a name: the first REM line's", await h.until("document.querySelector('dialog[open] .name-box')?.value === 'MY GAME'", 2000), await h.js("document.querySelector('dialog[open] .name-box')?.value"));
  // saved: the file handed over is named as asked (a download, recorded here, not made)
  await h.js(`(() => { window.saved = []; HTMLAnchorElement.prototype.click = function () { window.saved.push(this.download); }; })()`);
  await h.js("document.querySelector('dialog[open] .name-box').value = 'my game.bas'");
  await h.pressText("dialog[open] .dialog-actions button", "Save");
  h.verify("… and the file is named as asked", await h.until("window.saved.includes('my game.bas')", 2000), await h.js("window.saved"));
  // the disk image saved, under its own name
  await h.choose("#programs", "Disk ▸ Save the disk image");
  h.verify("Save the disk image hands over the disk under its name", await h.until("window.saved.includes('blank.dsk')", 2000), await h.js("window.saved"));
  // a BASIC file dropped on the page is typed in; a .logo file goes into LOGO
  const drop = (/** @type {string} */ name, /** @type {string} */ text) =>
    h.js(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)})); document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); })()`);
  await drop("hello.bas", '10 PRINT "FROM A FILE"\n');
  await h.typed(60000);
  h.verify("a BASIC file dropped on the page is typed in", ((await h.js("cec.listing()")) ?? "").includes("FROM A FILE"), await h.js("cec.listing()"));
  await drop("square.logo", "TO SQUARE\nREPEAT 4 [FD 30 RT 90]\nEND\n");
  await h.typed(120000);
  h.verify("a .logo file dropped on the page goes into LOGO", await h.until("cec.logoRunning", 10000));
  // the sound button turns the sound off and on, and says so
  await h.press("#sound");
  const off = await h.status();
  await h.press("#sound");
  h.verify("the sound button turns the sound off and on again, and says so", /Sound off/.test(off) && /Sound on/.test(await h.status()), [off, await h.status()]);
}
