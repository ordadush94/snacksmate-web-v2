import Link from "next/link";
import type { LandingContent, Locale } from "@/content/types";
import { articlesPath, getArticlesCopy } from "@/content/articles";
import { getResearchCopy, researchPath } from "@/content/research";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site";

type SiteFooterProps = {
  content: LandingContent["footer"];
  locale: Locale;
};

export function SiteFooter({ content, locale }: SiteFooterProps) {
  const articlesLabel = getArticlesCopy(locale).navLabel;
  const researchLabel = getResearchCopy(locale).navLabel;

  return (
    <footer>
      <div className="wrap footer-inner">
        <p className="footer-copy">{content.copyright}</p>
        <nav className="footer-groups" aria-label={content.navLabel}>
          <div className="footer-nav">
            <Link href={articlesPath(locale)}>{articlesLabel}</Link>
            <Link href={researchPath(locale)}>{researchLabel}</Link>
            <a href={`/${locale}/#sm-download`}>{content.downloadLabel}</a>
          </div>
          <div className="footer-nav footer-legal">
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              {content.privacyLabel}
            </a>
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
              {content.termsLabel}
            </a>
          </div>
        </nav>
      </div>
    </footer>
  );
}
