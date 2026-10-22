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

export function isHebrewLanguageTag(tag: string): boolean {
  const normalized = tag.toLowerCase();
  return normalized === "he" || normalized.startsWith("he-");
}

export function langFromBrowser(): Locale {
  const tags =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  for (const item of tags) {
    if (isHebrewLanguageTag(String(item || ""))) return "he";
  }
  return "en";
}

export function detectPreferredLang(): Locale {
  return storedLang() ?? langFromBrowser();
}

export function localeFromCookie(value: string | null | undefined): Locale | null {
  if (value && isLocale(value)) return value;
  return null;
}

// Accept-Language is the request equivalent of navigator.languages.
// The legacy gate returned Hebrew when any tag was `he` or `he-*`,
// including when English was listed first.
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return "en";
  const tags = header.split(",");
  for (const part of tags) {
    const tag = part.split(";")[0]?.trim() ?? "";
    if (tag && isHebrewLanguageTag(tag)) return "he";
  }
  return "en";
}

export function preferredLocale(input: {
  cookie: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): Locale {
  return localeFromCookie(input.cookie) ?? localeFromAcceptLanguage(input.acceptLanguage);
}

export function localeHomePath(locale: Locale, search = ""): string {
  const query = search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `/${locale}/${query}`;
}
