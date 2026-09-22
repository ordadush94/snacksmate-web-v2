import { LANG_COOKIE, LANG_STORAGE_KEY } from "@/lib/site";
import { isLocale, type Locale } from "@/content/types";

export function setLangPreference(lang: Locale) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore private mode / quota errors, matching the legacy script.
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function storedLang(): Locale | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(he|en)(?:;|$)`)
  );
  if (match && isLocale(match[1])) return match[1];
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {
    // Ignore storage access errors.
  }
  return null;
}

export function langFromBrowser(): Locale {
  const tags =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  for (const item of tags) {
    const tag = String(item || "").toLowerCase();
    if (tag === "he" || tag.startsWith("he-")) return "he";
  }
  return "en";
}

export function detectPreferredLang(): Locale {
  return storedLang() ?? langFromBrowser();
}

// Exact legacy redirect from /legacy-site/index (2).html so cookie,
// localStorage, browser language, query, and hash behavior stay the same.
export const LANGUAGE_REDIRECT_SCRIPT = `(function () {
  var COOKIE = "snacksmate_lang";
  var STORAGE_KEY = "snacksmate_landing_lang";

  function stored() {
    var match = document.cookie.match(
      new RegExp("(?:^|;\\\\s*)" + COOKIE + "=(he|en)(?:;|$)")
    );
    if (match) return match[1];
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "he" || saved === "en") return saved;
    } catch (e) {}
    return null;
  }

  function fromBrowser() {
    var tags = (navigator.languages && navigator.languages.length) ?
      navigator.languages : [navigator.language];
    for (var i = 0; i < tags.length; i++) {
      var tag = String(tags[i] || "").toLowerCase();
      if (tag === "he" || tag.indexOf("he-") === 0) return "he";
    }
    return "en";
  }

  // Trailing slash: Hosting 301s /en to /en/, so land there directly.
  var lang = stored() || fromBrowser();
  location.replace("/" + lang + "/" + location.search + location.hash);
})();`;
