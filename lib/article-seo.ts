import type { Locale } from "@/content/types";
import { articlePath } from "@/content/articles";
import { absoluteUrl, BRAND_NAME, LOGO_SRC, SITE_URL } from "@/lib/site";

const PUBLISHER_LOGO_WIDTH = 112;
const PUBLISHER_LOGO_HEIGHT = 112;

export type ArticleSeoIdentity = {
  slug: string;
  language: Locale;
  canonicalUrl?: string;
  translationSlug?: string;
};

export function articleCanonicalUrl(
  locale: Locale,
  article: { slug: string; canonicalUrl?: string },
): string {
  const explicit = article.canonicalUrl?.trim();
  if (explicit) return explicit;
  return absoluteUrl(articlePath(locale, article.slug));
}

export function articleHreflangLanguages(
  article: ArticleSeoIdentity,
  translation?: ArticleSeoIdentity | null,
): Record<string, string> {
  const languages: Record<string, string> = {
    [article.language]: articleCanonicalUrl(article.language, article),
  };

  const key = article.translationSlug?.trim();
  if (
    key &&
    translation?.slug?.trim() &&
    translation.language !== article.language
  ) {
    languages[translation.language] = articleCanonicalUrl(
      translation.language,
      translation,
    );
  }

  languages["x-default"] = languages.en ?? languages[article.language];
  return languages;
}

export function publisherJsonLd() {
  return {
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(LOGO_SRC),
      width: PUBLISHER_LOGO_WIDTH,
      height: PUBLISHER_LOGO_HEIGHT,
    },
  };
}

export function articleJsonLd(input: {
  locale: Locale;
  title: string;
  description?: string;
  imageUrl?: string | null;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  canonicalUrl: string;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.canonicalUrl,
    },
    inLanguage: input.locale,
    publisher: publisherJsonLd(),
  };

  const description = input.description?.trim();
  if (description) data.description = description;

  if (input.imageUrl) data.image = [input.imageUrl];

  const author = input.author?.trim();
  if (author) {
    data.author = {
      "@type": "Person",
      name: author,
    };
  }

  if (input.publishedAt?.trim()) data.datePublished = input.publishedAt;
  if (input.updatedAt?.trim()) data.dateModified = input.updatedAt;

  return data;
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
