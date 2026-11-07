import Link from "next/link";
import type { Locale } from "@/content/types";
import { getResearchCopy } from "@/content/research";
import { RESEARCH_HUB_APP_LINK } from "@/lib/exercise-snacks-app";
import type { ResearchListItem } from "@/sanity/lib/research";
import { LatinParentheticals } from "@/components/site/LatinParentheticals";
import { PublicationShell } from "@/components/site/PublicationShell";
import { ResearchLibrary } from "./ResearchLibrary";

type ResearchIndexProps = {
  locale: Locale;
  items: ResearchListItem[];
};

export function ResearchIndex({ locale, items }: ResearchIndexProps) {
  const copy = getResearchCopy(locale);

  return (
    <PublicationShell locale={locale} researchActive>
      <div className="research-shell">
        <header className="research-header">
          <p className="section-kicker">{copy.navLabel}</p>
          <h1>{copy.pageTitle}</h1>
          <p className="section-lead">
            <LatinParentheticals text={copy.pageDescription} />
          </p>
          {locale === "en" ? (
            <p className="section-lead research-hub-app">
              {RESEARCH_HUB_APP_LINK.before}
              <Link className="text-link" href={RESEARCH_HUB_APP_LINK.href}>
                {RESEARCH_HUB_APP_LINK.label}
              </Link>
              {RESEARCH_HUB_APP_LINK.after}
            </p>
          ) : null}
        </header>
        <ResearchLibrary locale={locale} items={items} />
      </div>
    </PublicationShell>
  );
}
