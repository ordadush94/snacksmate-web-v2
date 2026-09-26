import Link from "next/link";
import type { Locale } from "@/content/types";

type LanguageSwitchProps = {
  locale: Locale;
  ariaLabel: string;
  alternateHref?: string;
};

export function LanguageSwitch({
  locale,
  ariaLabel,
  alternateHref,
}: LanguageSwitchProps) {
  function hrefFor(lang: Locale) {
    if (lang === locale) return `/${locale}/`;
    return alternateHref ?? `/${lang}/`;
  }

  return (
    <div className="lang-switch" role="group" aria-label={ariaLabel}>
      <Link
        className={locale === "he" ? "lang-btn is-active" : "lang-btn"}
        href={hrefFor("he")}
        hrefLang="he"
        lang="he"
        aria-pressed={locale === "he"}
        data-set-lang="he"
      >
        עב
      </Link>
      <Link
        className={locale === "en" ? "lang-btn is-active" : "lang-btn"}
        href={hrefFor("en")}
        hrefLang="en"
        lang="en"
        aria-pressed={locale === "en"}
        data-set-lang="en"
      >
        EN
      </Link>
    </div>
  );
}
