import Link from "next/link";
import type { Locale } from "@/content/types";

type LanguageSwitchProps = {
  locale: Locale;
  ariaLabel: string;
};

export function LanguageSwitch({ locale, ariaLabel }: LanguageSwitchProps) {
  return (
    <div className="lang-switch" role="group" aria-label={ariaLabel}>
      {/* aria-pressed matches the legacy language switcher markup. */}
      <Link
        className={locale === "he" ? "lang-btn is-active" : "lang-btn"}
        href="/he"
        aria-pressed={locale === "he"}
        data-set-lang="he"
      >
        עב
      </Link>
      <Link
        className={locale === "en" ? "lang-btn is-active" : "lang-btn"}
        href="/en"
        aria-pressed={locale === "en"}
        data-set-lang="en"
      >
        EN
      </Link>
    </div>
  );
}
