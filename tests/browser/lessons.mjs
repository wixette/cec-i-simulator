// SPDX-License-Identifier: Apache-2.0
//
// The lessons (U13): the dock's first tab on a first visit; a step's Type it types on the machine and the
// step ticks; Show me puts an instrument beside the lesson, and its own tab takes it back;
// Show me for a view moves the camera, the stage answers, and a step that only shows ticks; the
// program typed in from a lesson, watched on the screen, ticks its step; the next lesson's
// button, which opens it at its top.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.js("app.dock.choose(640)");
  h.verify("the lessons are the dock's tab on a first visit", await h.until("app.dock.current === 'lessons'", 1000));
  await h.press("#lesson-tab-basic");
  await h.js("document.querySelector('#pane-lessons .chip.type-it').click()");
  await h.typed(20000);
  h.verify("Type it types the step's line, and the step ticks", await h.until("document.querySelector('#pane-lessons .step[data-step=\"first\"]').classList.contains('done')", 5000), await h.screen());
  await h.press("#lesson-tab-cpu");
  await h.js("document.querySelector('#pane-lessons .step[data-step=\"pause\"] .chip.show-me').click()");
  h.verify("Show me puts the CPU tab beside the lesson", await h.until("!document.querySelector('.lesson-companion').hidden && document.querySelector('.lesson-companion .cpu-tool') !== null", 2000));
  await h.sleep(500);
  await h.js("document.querySelector('.lesson-companion .cpu-controls').scrollIntoView({ block: 'center' })");
  await h.sleep(300);
  await h.pressText(".lesson-companion button", "Pause");
  h.verify("… working: its Pause pauses, and the step ticks", (await h.until("cec.paused", 1000)) && (await h.until("document.querySelector('#pane-lessons .step[data-step=\"pause\"]').classList.contains('done')", 3000)));
  await h.pressText(".lesson-companion button", "Run");
  await h.press("#tab-cpu");
  h.verify("its own tab takes it back", await h.until("document.querySelector('#pane-cpu .cpu-tool') !== null && document.querySelector('.lesson-companion').hidden", 2000));
  await h.press("#tab-lessons");
  await h.press("#lesson-tab-meet");
  await h.js("document.querySelector('#pane-lessons .step[data-step=\"machine\"] .chip.show-me').click()");
  h.verify("Show me answers on the stage, and a step that only shows ticks", (await h.js("document.getElementById('stage-view').classList.contains('pointed')")) && (await h.until("document.querySelector('#pane-lessons .step[data-step=\"machine\"]').classList.contains('done')", 1000)));
  await h.js("document.querySelector('#pane-lessons .step[data-step=\"inside\"] .chip.show-me').click()");
  h.verify("Show me for a view: Inside", await h.until("app.stage.view === 'inside'", 3000));
  await h.js("document.querySelector('#pane-lessons .step[data-step=\"play\"] .chip.open-program').click()");
  await h.until("document.querySelector('dialog[open]') !== null", 2000);
  await h.pressText("dialog[open] .dialog-actions button", "Type it in");
  h.verify("a program the lesson types in turns the camera to the screen", await h.until("app.stage.view === 'screen'", 3000));
  await h.typed(120000);
  h.verify("… and its step ticks once it runs", await h.until("document.querySelector('#pane-lessons .step[data-step=\"play\"]').classList.contains('done')", 3000));
  await h.js("document.querySelector('#pane-lessons .next-lesson').scrollIntoView({ block: 'center' })");
  await h.pressText("#pane-lessons button", "Next: Talk to BASIC");
  h.verify("the next lesson's button", await h.until("document.querySelector('#lesson-tab-basic').getAttribute('aria-selected') === 'true'", 1000));
  h.verify("… opens it at its top", (await h.js("document.getElementById('pane-lessons').scrollTop")) === 0);
}
