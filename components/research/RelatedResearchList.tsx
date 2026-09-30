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
import {
  ResearchSummaryList,
  studySource,
  type ResearchSummaryItem,
} from "@/components/research/ResearchSummaryList";

type RelatedResearchListProps = {
  items: ResearchListItem[];
  locale: Locale;
  heading?: string;
};

export function RelatedResearchList({
  items,
  locale,
  heading,
}: RelatedResearchListProps) {
  const studies = items.slice(0, 3);
  if (studies.length === 0) return null;

  const copy = getResearchCopy(locale);
  const summaries: ResearchSummaryItem[] = studies.map((item) => {
    const topic = researchTopicLabel(item.topic, locale);
    const design = studyDesignLabel(item.studyDesign, locale);

    return {
      id: item._id,
      href: researchItemPath(locale, item.slug),
      title: researchReaderTitle(item),
      label: topic || design,
      source: studySource(item.journal, item.year),
      design: topic && design ? design : undefined,
      readLabel: copy.relatedRead,
    };
  });

  return (
    <section className="related-studies" aria-labelledby="related-research">
      <h2 id="related-research">{heading ?? copy.relatedHeading}</h2>
      <ResearchSummaryList items={summaries} />
      <p className="related-studies-all">
        <Link className="text-link" href={researchPath(locale)}>
          {copy.relatedAll}
        </Link>
      </p>
    </section>
  );
}
