import { cache } from "react";
import type { PortableTextBlock } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";

import { isLocale, type Locale } from "@/content/types";
import { client } from "./client";
import { urlFor } from "./image";
import {
  articleByLanguageAndSlugQuery,
  articleTranslationQuery,
  articlesByLanguageQuery,
  publishedArticleParamsQuery,
  publishedArticlesSitemapQuery,
} from "./queries";

export const ARTICLES_REVALIDATE_SECONDS = 60;

const publishedFetchOptions = {
  perspective: "published" as const,
  next: { revalidate: ARTICLES_REVALIDATE_SECONDS },
};

export type ArticleImage = SanityImageSource & {
  alt?: string;
  asset?: {
    _ref?: string;
    _type?: string;
  };
};

export type ArticleReference = {
  _key: string;
  title?: string;
  source?: string;
  url?: string;
  doi?: string;
  year?: number;
};

export type ArticleListItem = {
  _id: string;
  title: string;
  slug: string;
  language: Locale;
  excerpt: string;
  topic?: string;
  author?: string;
  publishedAt: string;
  updatedAt?: string;
  mainImage?: ArticleImage | null;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
};

export type Article = ArticleListItem & {
  body?: PortableTextBlock[] | null;
  references?: ArticleReference[] | null;
  translationSlug?: string;
};

export type ArticleTranslation = {
  slug: string;
  language: Locale;
  canonicalUrl?: string;
  translationSlug?: string;
};

export type SitemapArticle = {
  slug: string;
  language: Locale;
  publishedAt?: string;
  updatedAt?: string;
  canonicalUrl?: string;
  translationSlug?: string;
};

export type PublishedArticleParams = {
  slug: string;
  language: Locale;
};

function hasImageAsset(image?: ArticleImage | null): image is ArticleImage {
  if (!image || typeof image !== "object") return false;
  if (!("asset" in image) || !image.asset) return false;
  return Boolean(image.asset._ref || image.asset._type);
}

export function articleImageUrl(
  image: ArticleImage | null | undefined,
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

export function articleImageAlt(
  image: ArticleImage | null | undefined,
  fallback: string,
): string {
  const alt = image && "alt" in image ? image.alt : undefined;
  return alt?.trim() || fallback;
}

export const getArticlesByLanguage = cache(async (language: Locale) => {
  return client.fetch<ArticleListItem[]>(
    articlesByLanguageQuery,
    { language },
    publishedFetchOptions,
  );
});

export const getArticleByLanguageAndSlug = cache(
  async (language: Locale, slug: string) => {
    return client.fetch<Article | null>(
      articleByLanguageAndSlugQuery,
      { language, slug },
      publishedFetchOptions,
    );
  },
);

export const getPublishedArticleParams = cache(async () => {
  return client.fetch<PublishedArticleParams[]>(
    publishedArticleParamsQuery,
    {},
    publishedFetchOptions,
  );
});

export const getPublishedArticlesForSitemap = cache(async () => {
  return client.fetch<SitemapArticle[]>(
    publishedArticlesSitemapQuery,
    {},
    publishedFetchOptions,
  );
});

export const getArticleTranslation = cache(
  async (language: Locale, slug: string, translationSlug: string) => {
    const key = translationSlug.trim();
    if (!key) return null;

    const translation = await client.fetch<ArticleTranslation | null>(
      articleTranslationQuery,
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

export function pickRelatedArticles(
  articles: ArticleListItem[],
  current: { _id: string; slug: string; topic?: string },
  limit = 3,
): ArticleListItem[] {
  const others = articles.filter(
    (article) => article._id !== current._id && article.slug !== current.slug,
  );
  const topic = current.topic?.trim();
  if (!topic) return others.slice(0, limit);

  const sameTopic = others.filter((article) => article.topic === topic);
  const otherTopics = others.filter((article) => article.topic !== topic);
  return [...sameTopic, ...otherTopics].slice(0, limit);
}

export function pickArticlesByTopic(
  articles: ArticleListItem[],
  topic: string | undefined,
  limit = 1,
): ArticleListItem[] {
  const key = topic?.trim();
  if (!key) return [];
  return articles.filter((article) => article.topic === key).slice(0, limit);
}
