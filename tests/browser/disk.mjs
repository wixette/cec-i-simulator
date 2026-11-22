// SPDX-License-Identifier: Apache-2.0
//
// The disk drive and saving (design/v0.0.5.md): a disk image of our own dropped on the page
// is inserted, the dialog offers to start from it, and it boots (the drive on the strip,
// always there, its lamp lit while it reads); Save the disk image is offered; Eject empties the drive; a blank
// disk goes in without starting; Save the program asks for a name, its first REM line's.

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
  await h.key("Escape");
}
