import type { MetadataRoute } from "next";
import { isLocale, locales, type Locale } from "@/content/types";
import { articlePath, articlesPath } from "@/content/articles";
import { researchItemPath, researchPath } from "@/content/research";
import { absoluteUrl } from "@/lib/site";
import {
  getPublishedArticlesForSitemap,
  type SitemapArticle,
} from "@/sanity/lib/articles";
import {
  getPublishedResearchForSitemap,
  type SitemapResearch,
} from "@/sanity/lib/research";

export const revalidate = 60;

type DatedSitemapItem = {
  updatedAt?: string;
  publishedAt?: string;
};

function contentDate(item: DatedSitemapItem): Date | undefined {
  const raw = item.updatedAt?.trim() || item.publishedAt?.trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function latestContentDate(items: DatedSitemapItem[]): Date | undefined {
  let latest: Date | undefined;
  for (const item of items) {
    const date = contentDate(item);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function publishedTimestamp(item: DatedSitemapItem): number {
  const raw = item.publishedAt?.trim() || item.updatedAt?.trim();
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function groupByLanguage<T extends { language: Locale; slug: string }>(
  items: T[],
): Record<Locale, T[]> {
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      items
        .filter((item) => item.language === locale)
        .sort((a, b) => publishedTimestamp(b) - publishedTimestamp(a)),
    ]),
  ) as Record<Locale, T[]>;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [publishedArticles, publishedResearch] = await Promise.all([
    getPublishedArticlesForSitemap(),
    getPublishedResearchForSitemap(),
  ]);

  const articles = publishedArticles.filter(
    (article): article is SitemapArticle & { language: Locale } =>
      isLocale(article.language) && Boolean(article.slug?.trim()),
  );
  const research = publishedResearch.filter(
    (item): item is SitemapResearch & { language: Locale } =>
      isLocale(item.language) && Boolean(item.slug?.trim()),
  );

  const articlesByLanguage = groupByLanguage(articles);
  const researchByLanguage = groupByLanguage(research);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/en/") },
    { url: absoluteUrl("/he/") },
  ];

  for (const locale of locales) {
    const lastModified = latestContentDate(articlesByLanguage[locale]);
    staticEntries.push({
      url: absoluteUrl(articlesPath(locale)),
      ...(lastModified ? { lastModified } : {}),
    });
  }

  for (const locale of locales) {
    const lastModified = latestContentDate(researchByLanguage[locale]);
    staticEntries.push({
      url: absoluteUrl(researchPath(locale)),
      ...(lastModified ? { lastModified } : {}),
    });
  }

  const articleEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    articlesByLanguage[locale].map((article) => {
      const lastModified = contentDate(article);
      return {
        url: absoluteUrl(articlePath(locale, article.slug)),
        ...(lastModified ? { lastModified } : {}),
      };
    }),
  );

  const researchEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    researchByLanguage[locale].map((item) => {
      const lastModified = contentDate(item);
      return {
        url: absoluteUrl(researchItemPath(locale, item.slug)),
        ...(lastModified ? { lastModified } : {}),
      };
    }),
  );

  return [...staticEntries, ...articleEntries, ...researchEntries];
}
