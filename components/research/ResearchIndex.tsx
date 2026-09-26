import type { Locale } from "@/content/types";
import { getResearchCopy } from "@/content/research";
import type { ResearchListItem } from "@/sanity/lib/research";
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
          <p className="section-lead">{copy.pageDescription}</p>
        </header>
        <ResearchLibrary locale={locale} items={items} />
      </div>
    </PublicationShell>
  );
}
