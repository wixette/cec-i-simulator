// SPDX-License-Identifier: Apache-2.0
//
// A first visit: the computer and the TV are on, the banner and BASIC's prompt show (U5),
// BASIC runs what is typed on the visitor's own keys, the strip's Computer, Ctrl-Reset and
// TV work, what was switched off stays off, the page's own checks pass, and without the ROMs
// the status line says so.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  h.verify("the page loads with its 3D model", await h.until("app.model() !== null", 30000));
  h.verify("the computer and the TV start on, at the banner and BASIC's prompt", (await h.js("cec.machine.powered && cec.tv.on")) && (await h.until("cec.machine.screenText().some((l) => l.includes('ZHONG HUA XUE XI JI')) && cec.machine.screenText().some((l) => l.startsWith(']'))", 20000)));
  h.verify("the status line welcomes the visitor", /Page Up/.test(await h.status()), await h.status());
  await h.typeHost("PRINT 2+2\n");
  h.verify("PRINT 2+2 typed on the visitor's keys prints 4", await h.until("cec.machine.screenText().some((l) => l === ' 4' || l === '4')", 15000), await h.screen());
  await h.typeHost('10 PRINT "HI"\nRUN\n');
  h.verify("a program typed in runs", await h.until("cec.machine.screenText().some((l) => l === 'HI')", 15000), await h.screen());
  // the strip's Computer: off and on again
  await h.pressText("#helper-strip button", "Computer");
  h.verify("the strip's Computer switches it off", await h.until("!cec.machine.powered", 3000));
  await h.pressText("#helper-strip button", "Computer");
  h.verify("and on again, at the banner", await h.until("cec.machine.powered && cec.machine.screenText().some((l) => l.includes('ZHONG HUA XUE XI JI'))", 20000));
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 10000);
  await h.typeHost("10 GOTO 10\nRUN\n");
  await h.sleep(1000);
  await h.pressText("#helper-strip button", "Ctrl-Reset");
  h.verify("Ctrl-Reset stops a running program, back at the prompt, the program kept", await h.until("/^\]/.test(cec.machine.screenText().filter((l) => l.trim()).at(-1)) && cec.listing().includes('GOTO')", 8000), await h.screen());
  await h.pressText("#helper-strip button", "TV");
  h.verify("the strip's TV switches the TV off", await h.until("!cec.tv.on", 2000));
  // remembered: off stays off after a reload
  await h.pressText("#helper-strip button", "Computer");
  await h.open({ keep: true });
  h.verify("switched off, the computer and the TV stay off after a reload", !(await h.js("cec.machine.powered || cec.tv.on")));

  // ?selftest: the page's own checks all pass
  await h.send("Page.navigate", { url: `${h.base}?debug&selftest` });
  await h.until("window.__selftest?.done", 30000);
  const st = await h.js("window.__selftest");
  h.verify("?selftest: the page's own checks all pass", st?.failed?.length === 0 && st.passed.length > 0, st?.failed);

  // no ROMs: the status line says so, and the computer will not start
  await h.js("localStorage.setItem('ceci.power', JSON.stringify({ computer: true, tv: true }))");
  await h.block("*u13.9433c*");
  await h.open({ keep: true });
  await h.sleep(800);
  h.verify("without a ROM, the status line names it, and the computer stays off", /u13/.test(await h.status()) && !(await h.js("cec.machine.powered")), await h.status());
}
