import { cache } from "react";
import type { PortableTextBlock } from "@portabletext/types";
import type { SanityImageSource } from "@sanity/image-url";

import type { Locale } from "@/content/types";
import { client } from "./client";
import { urlFor } from "./image";
import {
  articleByLanguageAndSlugQuery,
  articlesByLanguageQuery,
  publishedArticleParamsQuery,
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
