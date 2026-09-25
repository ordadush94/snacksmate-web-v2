import Link from "next/link";
import type { Locale } from "@/content/types";
import {
  getResearchCopy,
  researchItemPath,
  researchTopicLabel,
  studyDesignLabel,
} from "@/content/research";
import type { ResearchListItem } from "@/sanity/lib/research";

type ResearchCardProps = {
  item: ResearchListItem;
  locale: Locale;
};

export function ResearchCard({ item, locale }: ResearchCardProps) {
  const copy = getResearchCopy(locale);
  const href = researchItemPath(locale, item.slug);
  const topic = researchTopicLabel(item.topic, locale);
  const design = studyDesignLabel(item.studyDesign, locale);
  const details = [
    item.journal?.trim(),
    item.year,
    typeof item.sampleSize === "number"
      ? copy.sampleSizeShort(item.sampleSize)
      : undefined,
  ].filter(Boolean);

  return (
    <article className="research-card">
      <div className="research-card-body">
        {topic || design ? (
          <p className="research-card-chips">
            {topic ? <span className="research-chip">{topic}</span> : null}
            {design ? <span className="research-chip">{design}</span> : null}
          </p>
        ) : null}
        <h2>
          <Link href={href}>{item.title}</Link>
        </h2>
        {item.excerpt ? <p className="article-excerpt">{item.excerpt}</p> : null}
        {details.length > 0 ? (
          <p className="article-meta">{details.join(" · ")}</p>
        ) : null}
        <Link className="article-read-link" href={href}>
          {copy.readResearch}
          <span className="sr-only">: {item.title}</span>
        </Link>
      </div>
    </article>
  );
}
