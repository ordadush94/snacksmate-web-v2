import type { Locale } from "@/content/types";
import { BrandMark } from "@/components/landing/BrandMark";
import { LanguageSwitch } from "@/components/landing/LanguageSwitch";

type TopbarProps = {
  locale: Locale;
  languageAria: string;
};

export function Topbar({ locale, languageAria }: TopbarProps) {
  return (
    <header className="topbar" id="topbar">
      <div className="wrap topbar-inner">
        <BrandMark variant="topbar" />
        <div className="topbar-actions">
          <LanguageSwitch locale={locale} ariaLabel={languageAria} />
        </div>
      </div>
    </header>
  );
}
