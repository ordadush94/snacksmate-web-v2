import type { LandingContent } from "@/content/types";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site";

type SiteFooterProps = {
  content: LandingContent["footer"];
};

export function SiteFooter({ content }: SiteFooterProps) {
  return (
    <footer>
      <div className="wrap footer-inner">
        <div>{content.copyright}</div>
        <div>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {content.privacyLabel}
          </a>
          {" · "}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
            {content.termsLabel}
          </a>
        </div>
      </div>
    </footer>
  );
}
