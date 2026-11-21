// SPDX-License-Identifier: Apache-2.0
//
// The page's languages (docs/ui-design.md, U11): 简体中文 and English, each named as it names
// itself. Which one a visit uses: the address's ?lang=, else the one chosen before, else the
// first of the browser's languages that is here, else 简体中文 (design/decisions.md, D9: most
// of the machine's users read Chinese). Pure logic, no DOM.

/** @typedef {"zh" | "en"} Locale */

/** @type {readonly Locale[]} */
export const LOCALES = ["zh", "en"];

/** What each language calls itself, for the menu. @type {Record<Locale, string>} */
export const LOCALE_NAMES = { zh: "简体中文", en: "English" };

/** What the language button shows: short, beside an icon that already says "language". @type {Record<Locale, string>} */
export const LOCALE_SHORT = { zh: "简", en: "EN" };

/** The language when nothing else decides. */
export const FALLBACK = /** @type {Locale} */ ("zh");

/** Where the visitor's choice is remembered. */
export const LOCALE_STORE = "ceci.lang";

/**
 * The locale a language tag stands for here, or null: any Chinese is 简体中文 (the page has
 * no traditional Chinese yet), any English English.
 * @param {string | null | undefined} tag
 * @returns {Locale | null}
 */
export function matchLocale(tag) {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return LOCALES.find((l) => l === base) ?? null;
}

/**
 * The locale for this visit.
 * @param {{ query?: string | null, saved?: string | null, browser?: readonly string[] }} from
 * @returns {Locale}
 */
export function pickLocale(from) {
  for (const tag of [from.query, from.saved, ...(from.browser ?? [])]) {
    const l = matchLocale(tag);
    if (l) return l;
  }
  return FALLBACK;
}
