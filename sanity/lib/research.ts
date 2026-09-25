import { cache } from "react";
import type { PortableTextBlock } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";

import { isLocale, type Locale } from "@/content/types";
import { client } from "./client";
import { urlFor } from "./image";
import {
  publishedResearchParamsQuery,
  publishedResearchSitemapQuery,
  researchByLanguageAndSlugQuery,
  researchByLanguageQuery,
  researchTranslationQuery,
} from "./queries";

export const RESEARCH_REVALIDATE_SECONDS = 60;

const publishedFetchOptions = {
  perspective: "published" as const,
  next: { revalidate: RESEARCH_REVALIDATE_SECONDS },
};

export type ResearchImage = SanityImageSource & {
  alt?: string;
  asset?: {
    _ref?: string;
    _type?: string;
  };
};

export type ResearchReference = {
  _key: string;
  title?: string;
  source?: string;
  url?: string;
  doi?: string;
  year?: number;
};

export type ResearchListItem = {
  _id: string;
  title: string;
  slug: string;
  language: Locale;
  excerpt: string;
  topic?: string;
  studyDesign?: string;
  journal?: string;
  year?: number;
  sampleSize?: number;
  publishedAt: string;
  updatedAt?: string;
  mainImage?: ResearchImage | null;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
};

export type Research = ResearchListItem & {
  translationSlug?: string;
  studyAuthors?: string[] | null;
  studyPublishedAt?: string;
  doi?: string;
  studyUrl?: string;
  population?: string;
  intervention?: PortableTextBlock[] | null;
  duration?: string;
  comparator?: string;
  outcomes?: string[] | null;
  mainFindings?: PortableTextBlock[] | null;
  practicalInterpretation?: PortableTextBlock[] | null;
  limitations?: PortableTextBlock[] | null;
  snacksmateRelevance?: PortableTextBlock[] | null;
  summaryAuthor?: string;
  references?: ResearchReference[] | null;
};

export type ResearchTranslation = {
  slug: string;
  language: Locale;
  canonicalUrl?: string;
  translationSlug?: string;
};

export type SitemapResearch = {
  slug: string;
  language: Locale;
  publishedAt?: string;
  updatedAt?: string;
  canonicalUrl?: string;
  translationSlug?: string;
};

export type PublishedResearchParams = {
  slug: string;
  language: Locale;
};

function hasImageAsset(image?: ResearchImage | null): image is ResearchImage {
  if (!image || typeof image !== "object") return false;
  if (!("asset" in image) || !image.asset) return false;
  return Boolean(image.asset._ref || image.asset._type);
}

export function researchImageUrl(
  image: ResearchImage | null | undefined,
  width: number,
  height?: number,
): string | null {
  if (!hasImageAsset(image)) return null;
  let builder = urlFor(image).width(width).auto("format");
  if (height) {
    builder = builder.height(height).fit("crop");
  }
  return builder.url();
}

export function researchImageAlt(
  image: ResearchImage | null | undefined,
  fallback: string,
): string {
  const alt = image && "alt" in image ? image.alt : undefined;
  return alt?.trim() || fallback;
}

export const getResearchByLanguage = cache(async (language: Locale) => {
  return client.fetch<ResearchListItem[]>(
    researchByLanguageQuery,
    { language },
    publishedFetchOptions,
  );
});

export const getResearchByLanguageAndSlug = cache(
  async (language: Locale, slug: string) => {
    return client.fetch<Research | null>(
      researchByLanguageAndSlugQuery,
      { language, slug },
      publishedFetchOptions,
    );
  },
);

export const getPublishedResearchParams = cache(async () => {
  return client.fetch<PublishedResearchParams[]>(
    publishedResearchParamsQuery,
    {},
    publishedFetchOptions,
  );
});

export const getPublishedResearchForSitemap = cache(async () => {
  return client.fetch<SitemapResearch[]>(
    publishedResearchSitemapQuery,
    {},
    publishedFetchOptions,
  );
});

export const getResearchTranslation = cache(
  async (language: Locale, slug: string, translationSlug: string) => {
    const key = translationSlug.trim();
    if (!key) return null;

    const translation = await client.fetch<ResearchTranslation | null>(
      researchTranslationQuery,
      {
        language: language === "en" ? "he" : "en",
        slug,
        translationSlug: key,
      },
      publishedFetchOptions,
    );

    if (
      !translation?.slug?.trim() ||
      !isLocale(translation.language) ||
      translation.language === language
    ) {
      return null;
    }

    return translation;
  },
);

export function pickRelatedResearch(
  items: ResearchListItem[],
  current: { _id: string; slug: string; topic?: string },
  limit = 3,
): ResearchListItem[] {
  const others = items.filter(
    (item) => item._id !== current._id && item.slug !== current.slug,
  );
  const topic = current.topic?.trim();
  if (!topic) return others.slice(0, limit);

  const sameTopic = others.filter((item) => item.topic === topic);
  const otherTopics = others.filter((item) => item.topic !== topic);
  return [...sameTopic, ...otherTopics].slice(0, limit);
}
