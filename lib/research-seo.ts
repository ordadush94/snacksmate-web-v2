import type { Locale } from "@/content/types";
import { researchItemPath } from "@/content/research";
import { publisherJsonLd } from "@/lib/article-seo";
import { absoluteUrl } from "@/lib/site";

export type ResearchSeoIdentity = {
  slug: string;
  language: Locale;
  canonicalUrl?: string;
  translationSlug?: string;
};

export function researchCanonicalUrl(
  locale: Locale,
  item: { slug: string; canonicalUrl?: string },
): string {
  const explicit = item.canonicalUrl?.trim();
  if (explicit) return explicit;
  return absoluteUrl(researchItemPath(locale, item.slug));
}

export function researchHreflangLanguages(
  item: ResearchSeoIdentity,
  translation?: ResearchSeoIdentity | null,
): Record<string, string> {
  const languages: Record<string, string> = {
    [item.language]: researchCanonicalUrl(item.language, item),
  };

  const key = item.translationSlug?.trim();
  if (key && translation?.slug?.trim() && translation.language !== item.language) {
    languages[translation.language] = researchCanonicalUrl(
      translation.language,
      translation,
    );
  }

  languages["x-default"] = languages.en ?? languages[item.language];
  return languages;
}

export function doiHref(doi?: string): string | undefined {
  const value = doi?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const identifier = value.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, "");
  return identifier ? `https://doi.org/${identifier}` : undefined;
}

export function scholarlyArticleJsonLd(input: {
  title: string;
  studyAuthors?: string[] | null;
  journal?: string;
  year?: number;
  studyPublishedAt?: string;
  doi?: string;
  studyUrl?: string;
}) {
  const authors =
    input.studyAuthors
      ?.map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ "@type": "Person", name })) ?? [];
  const journal = input.journal?.trim();
  const studyPublishedAt = input.studyPublishedAt?.trim();
  const doi = input.doi?.trim();
  const studyUrl = input.studyUrl?.trim();

  if (
    authors.length === 0 &&
    !journal &&
    !input.year &&
    !studyPublishedAt &&
    !doi &&
    !studyUrl
  ) {
    return null;
  }

  const data: Record<string, unknown> = {
    "@type": "ScholarlyArticle",
    name: input.title,
    headline: input.title,
  };

  if (authors.length > 0) data.author = authors;
  if (journal) {
    data.isPartOf = {
      "@type": "Periodical",
      name: journal,
    };
  }
  if (studyPublishedAt) {
    data.datePublished = studyPublishedAt;
  } else if (input.year) {
    data.datePublished = String(input.year);
  }
  if (doi) {
    data.identifier = {
      "@type": "PropertyValue",
      propertyID: "DOI",
      value: doi,
    };
  }
  const url = studyUrl || doiHref(doi);
  if (url) data.url = url;

  return data;
}

export function researchPageJsonLd(input: {
  locale: Locale;
  title: string;
  description?: string;
  imageUrl?: string | null;
  summaryAuthor?: string;
  publishedAt?: string;
  updatedAt?: string;
  canonicalUrl: string;
  scholarlyArticle?: Record<string, unknown> | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.title,
    headline: input.title,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.canonicalUrl,
    },
    inLanguage: input.locale,
    url: input.canonicalUrl,
    publisher: publisherJsonLd(),
  };

  const description = input.description?.trim();
  if (description) data.description = description;
  if (input.imageUrl) data.image = [input.imageUrl];

  const summaryAuthor = input.summaryAuthor?.trim();
  if (summaryAuthor) {
    data.author = {
      "@type": "Person",
      name: summaryAuthor,
    };
  }

  if (input.publishedAt?.trim()) data.datePublished = input.publishedAt;
  if (input.updatedAt?.trim()) {
    data.dateModified = input.updatedAt;
  } else if (input.publishedAt?.trim()) {
    data.dateModified = input.publishedAt;
  }

  if (input.scholarlyArticle) data.about = input.scholarlyArticle;

  return data;
}
