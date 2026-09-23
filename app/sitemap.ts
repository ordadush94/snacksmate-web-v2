import type { MetadataRoute } from "next";
import { isLocale, locales, type Locale } from "@/content/types";
import { articlePath, articlesPath } from "@/content/articles";
import { absoluteUrl } from "@/lib/site";
import {
  getPublishedArticlesForSitemap,
  type SitemapArticle,
} from "@/sanity/lib/articles";

export const revalidate = 60;

function contentDate(article: {
  updatedAt?: string;
  publishedAt?: string;
}): Date | undefined {
  const raw = article.updatedAt?.trim() || article.publishedAt?.trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function latestContentDate(articles: SitemapArticle[]): Date | undefined {
  let latest: Date | undefined;
  for (const article of articles) {
    const date = contentDate(article);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function publishedTimestamp(article: SitemapArticle): number {
  const raw = article.publishedAt?.trim() || article.updatedAt?.trim();
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = (await getPublishedArticlesForSitemap()).filter(
    (article): article is SitemapArticle & { language: Locale } =>
      isLocale(article.language) && Boolean(article.slug?.trim()),
  );

  const byLanguage = Object.fromEntries(
    locales.map((locale) => [
      locale,
      published
        .filter((article) => article.language === locale)
        .sort((a, b) => publishedTimestamp(b) - publishedTimestamp(a)),
    ]),
  ) as Record<Locale, SitemapArticle[]>;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/en/") },
    { url: absoluteUrl("/he/") },
  ];

  for (const locale of locales) {
    const lastModified = latestContentDate(byLanguage[locale]);
    staticEntries.push({
      url: absoluteUrl(articlesPath(locale)),
      ...(lastModified ? { lastModified } : {}),
    });
  }

  const articleEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    byLanguage[locale].map((article) => {
      const lastModified = contentDate(article);
      return {
        url: absoluteUrl(articlePath(locale, article.slug)),
        ...(lastModified ? { lastModified } : {}),
      };
    }),
  );

  return [...staticEntries, ...articleEntries];
}
