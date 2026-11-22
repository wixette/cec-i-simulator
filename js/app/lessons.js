// SPDX-License-Identifier: Apache-2.0
//
// The Lessons tab (docs/ui-design.md, U13), as the TRS-80 simulator's: a bar of numbered
// lessons, one shown at a time; "Lesson 3 of 6", its title and lead; then its steps, each with
// its text, a photograph, the program it types as the machine's own text, its chips (Type it,
// one of our programs to open, Show me), a tick once the machine shows it done, and a "Going
// further" aside, folded. Steps tick in order: a step is checked once the ones before it have
// ticked, or once one of its own chips is used, so that a step skipped never holds the rest
// back. A step with a program ticks once it is typed in and started; one with Show me alone,
// once it is shown. Show me points at what a step is about and never works the machine; an
// instrument it opens goes beside the lesson, so that the lesson stays in view. The lesson open
// and each step's tick are remembered.

import { t } from "../l10n/l10n.js";
import { LESSONS } from "../lessons/lessons.js";
import { el, icon, setTip, tabs } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../lessons/lessons.js").Show} Show */

const STORE = "ceci.lessons";
/** How often the steps are checked, ms. */
const CHECK_MS = 250;

/**
 * A message's text as HTML: escaped, then `code` and **bold**.
 * @param {string} s
 */
export function markup(s) {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** @returns {{ lesson?: string, done?: Record<string, string[]> }} */
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "{}");
    if (!v || typeof v !== "object") return {};
    const done = Object.fromEntries(Object.entries(v.done ?? {}).filter(([, ids]) => Array.isArray(ids)));
    return { lesson: typeof v.lesson === "string" ? v.lesson : undefined, done };
  } catch {
    return {};
  }
}

export class LessonsTool {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   * @param {(show: Show) => void} show what Show me does: the page points at it
   * @param {(id: string) => void} program opens one of our programs' dialogs (Programs)
   * @param {() => void} typing what to do as a step's Type it starts (the page turns to the screen)
   */
  constructor(host, system, show, program, typing) {
    this.system = system;
    this.typing = typing;
    this.host = host;
    /** The open lesson's steps whose chips were used: they are checked out of order. @type {Set<string>} */
    this.touched = new Set();
    this.showMe = show;
    this.openProgram = program;
    const saved = load();
    /** The steps done, by lesson. @type {Record<string, Set<string>>} */
    this.done = Object.fromEntries(LESSONS.map((l) => [l.id, new Set(saved.done?.[l.id] ?? [])]));
    this.lessonId = saved.lesson && LESSONS.some((l) => l.id === saved.lesson) ? saved.lesson : LESSONS[0].id;
    this.bar = el("div", { class: "lesson-bar", role: "tablist", "aria-label": t("lessons.bar") });
    for (const [i, l] of LESSONS.entries()) {
      const b = el("button", { class: "lesson-tab", role: "tab", id: `lesson-tab-${l.id}`, type: "button" }, [el("b", { text: String(i + 1) }), el("span", { text: t(`lesson.${l.id}.title`) })]);
      b.setAttribute("data-tip-describes", "");
      setTip(b, t(`lesson.${l.id}.title`));
      this.bar.append(b);
    }
    this.page = el("article", { class: "lesson" });
    /** Where Show me puts an instrument beside the lesson. */
    this.companion = el("aside", { class: "lesson-companion", hidden: true });
    /** What to do when the instrument beside the lesson is closed (it goes back to its tab). @type {(() => void) | null} */
    this.onClose = null;
    host.append(el("div", { class: "lessons" }, [this.bar, el("div", { class: "lesson-body" }, [this.page, this.companion])]));
    this.select = tabs(this.bar, (id) => this.open(id.replace(/^lesson-tab-/, "")));
    // when the lessons' names do not all fit the bar, the others show their numbers alone
    const fit = () => {
      this.bar.classList.remove("compact");
      if (this.bar.scrollWidth > this.bar.clientWidth + 1) this.bar.classList.add("compact");
    };
    new ResizeObserver(fit).observe(this.bar);
    this.bar.addEventListener("click", () => requestAnimationFrame(fit));
    this.select(`lesson-tab-${this.lessonId}`);
    /** @private */
    this.last = 0;
  }

  /** @private A chip: an icon, a label, a tip, what it does. @param {string} cls @param {import("../ui/components.js").IconName} ic @param {string} label @param {string} tip @param {() => void} run */
  chip(cls, ic, label, tip, run) {
    const b = el("button", { class: `chip ${cls}`, type: "button" }, [icon(ic), el("span", { text: label })]);
    b.setAttribute("data-tip-describes", "");
    setTip(b, tip);
    b.addEventListener("click", () => {
      this.touched.add(/** @type {HTMLElement} */ (b.closest(".step")).dataset.step ?? "");
      run();
    });
    return b;
  }

  /** @private Opens a lesson. @param {string} id */
  open(id) {
    this.lessonId = id;
    this.touched.clear();
    const i = LESSONS.findIndex((l) => l.id === id);
    const lesson = LESSONS[i];
    const s = this.system;
    /** @type {HTMLElement[]} */
    const steps = lesson.steps.map((st, n) => {
      const key = `lesson.${id}.${st.id}`;
      const chips = el("div", { class: "chips" });
      if (st.type !== undefined || st.text !== undefined) {
        chips.append(
          this.chip("type-it", "keyboard", t("lessons.typeIt"), t("lessons.typeIt.tip"), () => {
            if (!s.machine.powered) return void s.say({ key: "type.off" });
            if (st.fresh) s.typeFresh();
            if (st.type !== undefined) s.type(st.type);
            else s.typeIn(/** @type {string} */ (st.text));
            s.say({ key: "lessons.typing" });
            this.typing();
          }),
        );
      }
      if (st.program) {
        const pid = st.program;
        chips.append(this.chip("open-program", "play_arrow", t("lessons.openProgram", { title: t(`sample.${pid}.title`) }), t("lessons.openProgram.tip"), () => this.openProgram(pid)));
      }
      if (st.show) {
        const show = st.show;
        chips.append(
          this.chip("show-me", "visibility", t("lessons.showMe"), t("lessons.showMe.tip"), () => {
            this.showMe(show);
            // a step that only shows something is done once it is shown
            if (!st.done) this.markDone(st.id);
          }),
        );
      }
      const text = el("div", { class: "step-text" });
      text.innerHTML = markup(t(`${key}.text`));
      const body = el("div", { class: "step-body" }, [el("h4", { text: t(`${key}.title`) })]);
      if (st.photo) {
        const src = new URL(`../../images/photos/${st.photo}`, import.meta.url);
        src.search = new URL(import.meta.url).search;
        body.append(el("figure", { class: "photo" }, [el("img", { src: src.href, alt: t(`${key}.title`), loading: "lazy" })]));
      }
      body.append(text);
      const listing = st.listing ?? (st.type !== undefined && !st.type.includes("{") && !st.type.includes("\x03") ? st.type.trimEnd() : st.text?.trimEnd());
      if (listing) body.append(el("pre", { class: "listing", text: listing }));
      if (chips.childElementCount) body.append(chips);
      if (st.more) {
        const more = el("details", { class: "more" }, [el("summary", { text: t("lessons.more") })]);
        const p = el("div");
        p.innerHTML = markup(t(`${key}.more`));
        more.append(p);
        body.append(more);
      }
      const tick = el("span", { class: "tick", "aria-hidden": "true" }, [icon("check")]);
      const checks = !!(st.done || st.show);
      return el("li", { class: `step${checks ? "" : " no-check"}`, "data-step": st.id }, [el("span", { class: "step-n", text: String(n + 1) }), body, checks ? tick : null]);
    });
    const next = LESSONS[i + 1];
    const foot = next
      ? el("button", { class: "btn tonal has-icon next-lesson", type: "button" }, [el("span", { text: t("lessons.next", { title: t(`lesson.${next.id}.title`) }) }), icon("chevron_right")])
      : el("p", { class: "dim", text: t("lessons.end") });
    if (next) foot.addEventListener("click", () => this.select(`lesson-tab-${next.id}`));
    this.page.replaceChildren(
      el("p", { class: "lesson-of", text: t("lessons.of", { n: i + 1, of: LESSONS.length }) }),
      el("h3", { text: t(`lesson.${id}.title`) }),
      el("p", { class: "lead", text: t(`lesson.${id}.lead`) }),
      el("ol", { class: "steps" }, steps),
      foot,
    );
    // a lesson opens at its top, wherever the last one was scrolled to
    this.host.scrollTop = 0;
    this.save();
    this.paintTicks();
  }

  /**
   * Shows an instrument's content beside the lesson (Show me), or closes it.
   * @param {HTMLElement[] | null} nodes the instrument's content, moved here; null closes
   * @param {(() => void) | null} [onClose] puts it back where it came from
   */
  setCompanion(nodes, onClose = null) {
    if (this.onClose) {
      const back = this.onClose;
      this.onClose = null;
      back();
    }
    this.companion.hidden = !nodes;
    if (!nodes) {
      this.companion.replaceChildren();
      return;
    }
    this.onClose = onClose;
    const close = el("button", { class: "btn icon-only companion-close", type: "button" }, [icon("close")]);
    setTip(close, t("lessons.closeTool"));
    close.addEventListener("click", () => this.setCompanion(null));
    this.companion.replaceChildren(close, el("div", { class: "companion-tool" }, nodes));
  }

  /** @private */
  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ lesson: this.lessonId, done: Object.fromEntries(Object.entries(this.done).map(([k, v]) => [k, [...v]])) }));
    } catch {
      // private browsing: nothing is remembered
    }
  }

  /** @private */
  paintTicks() {
    const done = this.done[this.lessonId];
    for (const li of this.page.querySelectorAll(".step")) li.classList.toggle("done", done.has(/** @type {HTMLElement} */ (li).dataset.step ?? ""));
    for (const l of LESSONS) {
      const tab = document.getElementById(`lesson-tab-${l.id}`);
      const all = l.steps.filter((x) => x.done || x.show).every((x) => this.done[l.id].has(x.id));
      tab?.classList.toggle("complete", all);
    }
  }

  /** @private A step of the open lesson done. @param {string} stepId */
  markDone(stepId) {
    const done = this.done[this.lessonId];
    if (done.has(stepId)) return;
    done.add(stepId);
    this.save();
    this.paintTicks();
  }

  /** Checks the open lesson's steps against the machine, in order (or out of it, once a step's chip is used); called each frame. */
  tick() {
    const now = performance.now();
    if (now - this.last < CHECK_MS) return;
    this.last = now;
    const lesson = LESSONS.find((l) => l.id === this.lessonId);
    if (!lesson || !this.system.machine.powered) return;
    const done = this.done[lesson.id];
    // the first step not yet done is checked, and any step whose chips were used
    let first = true;
    for (const st of lesson.steps) {
      if (!(st.done || st.show) || done.has(st.id)) continue;
      if (st.done && (first || this.touched.has(st.id)) && st.done(this.system)) this.markDone(st.id);
      first = false;
    }
  }
}
