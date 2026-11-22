// SPDX-License-Identifier: Apache-2.0
//
// The page's languages (docs/ui-design.md, U11): ten, as the TRS-80 simulator's, 简体中文
// first, each named as it names itself, since a visitor who needs another language cannot be
// expected to recognise its name in the one on the screen. Which one a visit uses: the
// address's ?lang=, else the one chosen before, else the first of the browser's languages
// that is here, else 简体中文 (design/decisions.md, D9: most of the machine's users read
// Chinese). Pure logic, no DOM.

/** @typedef {"zh" | "en" | "zh-TW" | "ja" | "ko" | "es" | "fr" | "de" | "it" | "pt-BR"} Locale */

/** @type {readonly Locale[]} */
export const LOCALES = ["zh", "en", "zh-TW", "ja", "ko", "es", "fr", "de", "it", "pt-BR"];

/** What each language calls itself, for the menu. @type {Record<Locale, string>} */
export const LOCALE_NAMES = {
  zh: "简体中文",
  en: "English",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "pt-BR": "Português (Brasil)",
};

/** What the language button shows: short, beside an icon that already says "language". @type {Record<Locale, string>} */
export const LOCALE_SHORT = { zh: "简", en: "EN", "zh-TW": "繁", ja: "日", ko: "한", es: "ES", fr: "FR", de: "DE", it: "IT", "pt-BR": "PT" };

/** Each language's tag for the page (the html element's lang: its fonts, its hyphenation). @type {Record<Locale, string>} */
export const LOCALE_TAGS = { zh: "zh-Hans", en: "en", "zh-TW": "zh-Hant", ja: "ja", ko: "ko", es: "es", fr: "fr", de: "de", it: "it", "pt-BR": "pt-BR" };

/** The language when nothing else decides. */
export const FALLBACK = /** @type {Locale} */ ("zh");

/** Where the visitor's choice is remembered. */
export const LOCALE_STORE = "ceci.lang";

/**
 * The locale a language tag stands for here, or null: an exact match first ("pt-BR"), then
 * Chinese by its script, else its region (zh-Hant, zh-TW, zh-HK, zh-MO are traditional; a
 * stated zh-Hans, zh-Hans-HK say, simplified; any other Chinese simplified), then the base
 * language ("fr-CA" is French, "pt-PT" is Portuguese, as Brazil's).
 * @param {string | null | undefined} tag
 * @returns {Locale | null}
 */
export function matchLocale(tag) {
  if (!tag) return null;
  const lower = tag.toLowerCase().replace(/_/g, "-");
  const exact = LOCALES.find((l) => l.toLowerCase() === lower);
  if (exact) return exact;
  const [base, ...rest] = lower.split("-");
  // the script, when the tag names one, before the region: zh-Hans-HK is simplified
  if (base === "zh") return rest.includes("hans") ? "zh" : rest.some((p) => ["hant", "tw", "hk", "mo"].includes(p)) ? "zh-TW" : "zh";
  if (base === "pt") return "pt-BR";
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
