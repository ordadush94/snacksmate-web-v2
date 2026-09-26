import type { Locale } from "@/content/types";
import {
  getResearchCopy,
  researchItemPath,
  researchTopicLabel,
  studyDesignLabel,
} from "@/content/research";
import {
  researchImageAlt,
  researchImageUrl,
  type ResearchListItem,
} from "@/sanity/lib/research";
import { ContentCard } from "@/components/content/ContentCard";

type ResearchCardProps = {
  item: ResearchListItem;
  locale: Locale;
};

export function ResearchCard({ item, locale }: ResearchCardProps) {
  const copy = getResearchCopy(locale);
  const href = researchItemPath(locale, item.slug);
  const topic = researchTopicLabel(item.topic, locale);
  const design = studyDesignLabel(item.studyDesign, locale);
  const imageUrl = researchImageUrl(item.mainImage, 960, 540);
  const details = [
    item.journal?.trim(),
    item.year,
    typeof item.sampleSize === "number"
      ? copy.sampleSizeShort(item.sampleSize)
      : undefined,
  ].filter(Boolean);

  return (
    <ContentCard
      href={href}
      title={item.title}
      linkLabel={copy.readResearch}
      takeaway={item.excerpt}
      chips={[topic, design].filter((chip): chip is string => Boolean(chip))}
      image={
        imageUrl
          ? {
              src: imageUrl,
              alt: researchImageAlt(item.mainImage, item.title),
              width: 960,
              height: 540,
            }
          : undefined
      }
      meta={details.length > 0 ? details.join(" · ") : undefined}
    />
  );
}
