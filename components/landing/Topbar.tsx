import Link from "next/link";
import type { Locale } from "@/content/types";
import { articlesPath, getArticlesCopy } from "@/content/articles";
import { BrandMark } from "@/components/landing/BrandMark";
import { LanguageSwitch } from "@/components/landing/LanguageSwitch";

type TopbarProps = {
  locale: Locale;
  languageAria: string;
  homeHref?: string;
  articlesActive?: boolean;
  elevated?: boolean;
};

export function Topbar({
  locale,
  languageAria,
  homeHref,
  articlesActive = false,
  elevated = false,
}: TopbarProps) {
  const articlesHref = articlesPath(locale);
  const articlesLabel = getArticlesCopy(locale).navLabel;

  return (
    <header className={elevated ? "topbar is-scrolled" : "topbar"} id="topbar">
      <div className="wrap topbar-inner">
        <BrandMark variant="topbar" href={homeHref} />
        <div className="topbar-actions">
          <Link
            className={
              articlesActive ? "topbar-nav-link is-active" : "topbar-nav-link"
            }
            href={articlesHref}
            aria-current={articlesActive ? "page" : undefined}
          >
            {articlesLabel}
          </Link>
          <LanguageSwitch locale={locale} ariaLabel={languageAria} />
        </div>
      </div>
    </header>
  );
}
