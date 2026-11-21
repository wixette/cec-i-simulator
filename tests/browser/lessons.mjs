// SPDX-License-Identifier: Apache-2.0
//
// The lessons (U13): Start's button opens them; a step's Type it types on the machine and the
// step ticks; Show me puts an instrument beside the lesson, and its own tab takes it back;
// Show me for a view moves the camera; the next lesson's button.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("cec.machine.screenText().some((l) => l.startsWith(']'))", 20000);
  await h.js("app.dock.choose(640)");
  await h.press("#tab-start");
  await h.js("document.querySelector('.start-lessons').scrollIntoView({ block: 'center' })");
  await h.pressText("#pane-start button", "Begin the lessons");
  h.verify("Start's button opens the lessons", await h.until("app.dock.current === 'lessons'", 1000));
  await h.press("#lesson-tab-basic");
  await h.js("document.querySelector('#pane-lessons .chip.type-it').click()");
  await h.typed(20000);
  h.verify("Type it types the step's line, and the step ticks", await h.until("document.querySelector('#pane-lessons .step[data-step=\"print\"]').classList.contains('done')", 5000), await h.screen());
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
  await h.js("document.querySelector('#pane-lessons .step[data-step=\"inside\"] .chip.show-me').click()");
  h.verify("Show me for a view: Inside", await h.until("app.stage.view === 'inside'", 3000));
  await h.js("document.querySelector('#pane-lessons .next-lesson').scrollIntoView({ block: 'center' })");
  await h.pressText("#pane-lessons button", "Next: Talk to BASIC");
  h.verify("the next lesson's button", await h.until("document.querySelector('#lesson-tab-basic').getAttribute('aria-selected') === 'true'", 1000));
}
