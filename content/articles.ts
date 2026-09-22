import type { Locale } from "./types";

const TOPIC_LABELS: Record<string, Record<Locale, string>> = {
  "exercise-snacks": { en: "Exercise Snacks", he: "נשנושי כושר" },
  research: { en: "Research", he: "מחקר" },
  fitness: { en: "Fitness", he: "כושר" },
  health: { en: "Health", he: "בריאות" },
  vilpa: { en: "VILPA", he: "VILPA" },
  snacksmate: { en: "Snacksmate", he: "Snacksmate" },
};

export const articlesCopy = {
  en: {
    navLabel: "Articles",
    pageTitle: "Articles",
    pageDescription:
      "Articles from Snacksmate about exercise snacks, movement, and everyday fitness.",
    empty: "No articles published yet.",
    readArticle: "Read article",
    publishedLabel: "Published",
    updatedLabel: "Updated",
    referencesHeading: "References",
    backToArticles: "All articles",
    metaTitle: "Articles | Snacksmate",
  },
  he: {
    navLabel: "כתבות",
    pageTitle: "כתבות",
    pageDescription:
      "כתבות של Snacksmate על נשנושי כושר, תנועה ובריאות יומיומית.",
    empty: "עדיין אין כתבות.",
    readArticle: "לקריאה",
    publishedLabel: "פורסם",
    updatedLabel: "עודכן",
    referencesHeading: "מקורות",
    backToArticles: "לכל הכתבות",
    metaTitle: "כתבות | Snacksmate",
  },
} as const;

export function getArticlesCopy(locale: Locale) {
  return articlesCopy[locale];
}

export function topicLabel(topic: string | undefined, locale: Locale) {
  if (!topic) return undefined;
  return TOPIC_LABELS[topic]?.[locale] ?? topic;
}

export function formatArticleDate(value: string, locale: Locale) {
  return new Date(value).toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function articlesPath(locale: Locale) {
  return `/${locale}/articles/`;
}

export function articlePath(locale: Locale, slug: string) {
  return `/${locale}/articles/${slug}/`;
}
