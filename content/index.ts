import { enContent } from "./en";
import { heContent } from "./he";
import type { LandingContent, Locale } from "./types";

export { isLocale, locales } from "./types";

export const contents: Record<Locale, LandingContent> = {
  en: enContent,
  he: heContent,
};

export function getContent(locale: Locale): LandingContent {
  return contents[locale];
}

export type { LandingContent, Locale } from "./types";
