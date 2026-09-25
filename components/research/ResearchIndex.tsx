import type { Locale } from "@/content/types";
import { getResearchCopy } from "@/content/research";
import type { ResearchListItem } from "@/sanity/lib/research";
import { ResearchLibrary } from "./ResearchLibrary";

type ResearchIndexProps = {
  locale: Locale;
  items: ResearchListItem[];
};

export function ResearchIndex({ locale, items }: ResearchIndexProps) {
  const copy = getResearchCopy(locale);

  return (
    <div className="research-shell">
      <header className="research-header">
        <p className="section-kicker">Snacksmate</p>
        <h1>{copy.pageTitle}</h1>
        <p className="section-lead">{copy.pageDescription}</p>
      </header>
      <ResearchLibrary locale={locale} items={items} />
    </div>
  );
}
