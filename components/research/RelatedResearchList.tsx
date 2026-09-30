import Link from "next/link";
import type { Locale } from "@/content/types";
import {
  getResearchCopy,
  researchItemPath,
  researchPath,
  researchTopicLabel,
  studyDesignLabel,
} from "@/content/research";
import { researchReaderTitle } from "@/lib/research-display";
import type { ResearchListItem } from "@/sanity/lib/research";

type RelatedResearchListProps = {
  items: ResearchListItem[];
  locale: Locale;
  heading?: string;
};

function studySource(journal?: string, year?: number) {
  const name = journal?.trim();
  const yearLabel = typeof year === "number" ? String(year) : "";
  if (name && yearLabel) return `${name} · ${yearLabel}`;
  return name || yearLabel || undefined;
}

export function RelatedResearchList({
  items,
  locale,
  heading,
}: RelatedResearchListProps) {
  const studies = items.slice(0, 3);
  if (studies.length === 0) return null;

  const copy = getResearchCopy(locale);

  return (
    <section className="related-studies" aria-labelledby="related-research">
      <h2 id="related-research">{heading ?? copy.relatedHeading}</h2>
      <ul className="related-studies-list">
        {studies.map((item) => {
          const topic = researchTopicLabel(item.topic, locale);
          const design = studyDesignLabel(item.studyDesign, locale);
          const source = studySource(item.journal, item.year);
          const href = researchItemPath(locale, item.slug);

          return (
            <li key={item._id} className="related-study">
              {topic || design ? (
                <p className="related-study-label">{topic || design}</p>
              ) : null}
              <h3 className="related-study-title">
                <Link href={href}>{researchReaderTitle(item)}</Link>
              </h3>
              {source ? (
                <p className="related-study-source">
                  <bdi dir="ltr">{source}</bdi>
                </p>
              ) : null}
              {topic && design ? (
                <p className="related-study-design">{design}</p>
              ) : null}
              <Link className="related-study-link text-link" href={href}>
                {copy.relatedRead}
                <span className="icon-directional" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="related-studies-all">
        <Link className="text-link" href={researchPath(locale)}>
          {copy.relatedAll}
        </Link>
      </p>
    </section>
  );
}
